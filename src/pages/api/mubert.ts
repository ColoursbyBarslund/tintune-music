import type { APIRoute } from "astro";

type MubertRequest = {
  params?: {
    energy?: number; // 0..100
    texture?: number; // 0..100 (unused for now)
    space?: number; // 0..100 (unused for now)
  };
  playlist_index?: string;
  custom_id?: string;
};

type CustomerCreds = {
  customerId: string;
  accessToken: string;
};

// Best-effort in-memory cache (works during a warm function instance)
const customerCache = new Map<string, CustomerCreds>();

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function sanitizeHeaderValue(value: string): string {
  // Header values must be ByteString (0..255). Strip common copied “smart quotes” etc.
  const trimmed = String(value ?? "").trim();
  const cleaned = trimmed
    .replace(/[\u201C\u201D\u2018\u2019]/g, "")
    .replace(/^"+|"+$/g, "")
    .replace(/\u00A0/g, " ")
    .trim();

  let out = "";
  for (let i = 0; i < cleaned.length; i++) {
    const code = cleaned.charCodeAt(i);
    if (code <= 255) out += cleaned[i];
  }
  return out.trim();
}

function requireEnv(name: string, raw: string | undefined): string {
  const cleaned = sanitizeHeaderValue(raw ?? "");
  if (!cleaned) throw new Error(`Missing ${name}`);
  return cleaned;
}

function intensityFromEnergy(energy: number): "low" | "medium" | "high" {
  const e = clamp(energy, 0, 100);
  if (e < 34) return "low";
  if (e < 67) return "medium";
  return "high";
}

async function ensureCustomer(companyId: string, licenseToken: string, customId: string): Promise<CustomerCreds> {
  const cached = customerCache.get(customId);
  if (cached) return cached;

  const resp = await fetch("https://music-api.mubert.com/api/v3/service/customers", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "company-id": sanitizeHeaderValue(companyId),
      "license-token": sanitizeHeaderValue(licenseToken),
    },
    body: JSON.stringify({ custom_id: customId }),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Mubert service/customers ${resp.status}: ${text}`);
  }

  const json = (await resp.json().catch(() => null)) as any;

  // Observed v3 response shape:
  // { data: { id, access: { token } } }
  const customerId: string | undefined =
    json?.data?.id || json?.id || json?.data?.customer_id || json?.customer_id;
  const accessToken: string | undefined =
    json?.data?.access?.token || json?.access?.token || json?.token || json?.access_token;

  if (!customerId || !accessToken) {
    const shape = {
      hasData: !!json?.data,
      dataKeys: json?.data ? Object.keys(json.data) : [],
      hasAccess: !!json?.data?.access,
      accessKeys: json?.data?.access ? Object.keys(json.data.access) : [],
    };
    throw new Error(`Mubert service/customers: could not parse creds. shape=${JSON.stringify(shape)} resp=${JSON.stringify(json)}`);
  }

  const creds = { customerId: String(customerId), accessToken: String(accessToken) };
  customerCache.set(customId, creds);
  return creds;
}

async function requestStreamingLink(
  customerId: string,
  accessToken: string,
  playlistIndex: string,
  intensity: "low" | "medium" | "high"
): Promise<string> {
  // IMPORTANT: Node fetch disallows GET bodies; use query params.
  const query = new URLSearchParams({
    playlist_index: playlistIndex,
    bitrate: "320",
    intensity,
    type: "http",
  });

  const url = `https://music-api.mubert.com/api/v3/public/streaming/get-link?${query.toString()}`;

  const resp = await fetch(url, {
    method: "GET",
    headers: {
      "customer-id": sanitizeHeaderValue(customerId),
      "access-token": sanitizeHeaderValue(accessToken),
    },
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Mubert streaming/get-link ${resp.status}: ${text}`);
  }

  const json = (await resp.json().catch(() => null)) as any;

  // Observed common shape: { data: { link } }
  const link: string | undefined =
    json?.data?.link || json?.link || json?.url || json?.data?.url || json?.result?.link || json?.result?.url;

  if (!link) {
    throw new Error(`Mubert streaming/get-link: missing link in response: ${JSON.stringify(json)}`);
  }

  return String(link);
}

export const POST: APIRoute = async ({ request }) => {
  let companyId: string;
  let licenseToken: string;

  try {
    companyId = requireEnv("MUBERT_COMPANY_ID", import.meta.env.MUBERT_COMPANY_ID || process.env.MUBERT_COMPANY_ID);
    licenseToken = requireEnv(
      "MUBERT_LICENSE_TOKEN",
      import.meta.env.MUBERT_LICENSE_TOKEN || process.env.MUBERT_LICENSE_TOKEN
    );
  } catch (err: any) {
    return new Response(err?.message || String(err), { status: 500 });
  }

  let body: MubertRequest;
  try {
    body = (await request.json()) as MubertRequest;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const energy = Number(body?.params?.energy ?? 40);
  const intensity = intensityFromEnergy(energy);
  const playlistIndex = String(body?.playlist_index ?? "1.0.0");
  const customId = String(body?.custom_id ?? "tintune-music-lab");

  try {
    const { customerId, accessToken } = await ensureCustomer(companyId, licenseToken, customId);
    const streamUrl = await requestStreamingLink(customerId, accessToken, playlistIndex, intensity);

    return new Response(JSON.stringify({ streamUrl, playlistIndex, intensity }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (err: any) {
    const msg = err?.message || String(err);
    return new Response(`Mubert proxy error: ${msg}`, { status: 502 });
  }
};

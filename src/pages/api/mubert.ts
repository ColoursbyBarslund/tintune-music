import type { APIRoute } from "astro";

// Minimal Mubert v3 proxy:
// 1) Ensure a customer exists (service auth: company-id + license-token)
// 2) Request a streaming link (public auth: customer-id + access-token)
//
// Sources (curl examples):
// - https://mubert.com/use-cases/developers
// - https://mubertmusicapiv3.docs.apiary.io/ (JS site, but same v3 API)

type MubertRequest = {
  palette?: string[];
  params?: {
    energy?: number; // 0..100
    texture?: number; // 0..100
    space?: number; // 0..100
  };
  // Optional: let client pick a specific playlist/channel.
  playlist_index?: string; // e.g. "1.0.0"
  // Optional: stable identity per browser/user.
  custom_id?: string;
};

type CustomerCreds = {
  customerId: string;
  accessToken: string;
};

// In-memory cache (good enough for MVP; Vercel functions may cold-start).
const customerCache = new Map<string, CustomerCreds>();

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
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

  // Create customer
  const resp = await fetch("https://music-api.mubert.com/api/v3/service/customers", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "company-id": companyId,
      "license-token": licenseToken,
    },
    body: JSON.stringify({ custom_id: customId }),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Mubert service/customers ${resp.status}: ${text}`);
  }

  const json = (await resp.json().catch(() => null)) as any;

  // The API typically returns something like { customer_id, access_token } (names may vary).
  const customerId: string | undefined =
    json?.customer_id ?? json?.customerId ?? json?.data?.customer_id ?? json?.data?.customerId;
  const accessToken: string | undefined =
    json?.access_token ?? json?.accessToken ?? json?.data?.access_token ?? json?.data?.accessToken;

  if (!customerId || !accessToken) {
    throw new Error(`Mubert service/customers: unexpected response: ${JSON.stringify(json)}`);
  }

  const creds = { customerId, accessToken };
  customerCache.set(customId, creds);
  return creds;
}

async function requestStreamingLink(
  customerId: string,
  accessToken: string,
  playlistIndex: string,
  intensity: "low" | "medium" | "high"
) {
  // Docs/examples show GET with JSON body.
  const body = {
    playlist_index: playlistIndex,
    bitrate: 320,
    intensity,
    type: "http",
  };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "customer-id": customerId,
    "access-token": accessToken,
  };

  const url = "https://music-api.mubert.com/api/v3/public/streaming/get-link";

  // Try GET first (as in Mubert examples), then fallback to POST if the platform rejects GET bodies.
  let resp = await fetch(url, {
    method: "GET",
    headers,
    body: JSON.stringify(body),
  });

  if (resp.status === 405 || resp.status === 400) {
    resp = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
  }

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Mubert streaming/get-link ${resp.status}: ${text}`);
  }

  const json = (await resp.json().catch(() => null)) as any;

  // Common field names we’ve seen across Mubert responses.
  const link: string | undefined =
    json?.link ??
    json?.url ??
    json?.data?.link ??
    json?.data?.url ??
    json?.result?.link ??
    json?.result?.url;

  if (!link) {
    throw new Error(`Mubert streaming/get-link: unexpected response: ${JSON.stringify(json)}`);
  }

  return link;
}

export const POST: APIRoute = async ({ request }) => {
  const companyId = import.meta.env.MUBERT_COMPANY_ID || process.env.MUBERT_COMPANY_ID;
  const licenseToken = import.meta.env.MUBERT_LICENSE_TOKEN || process.env.MUBERT_LICENSE_TOKEN;

  if (!companyId || !licenseToken) {
    return new Response("Missing MUBERT_COMPANY_ID or MUBERT_LICENSE_TOKEN", { status: 500 });
  }

  let body: MubertRequest;
  try {
    body = (await request.json()) as MubertRequest;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const energy = Number(body?.params?.energy ?? 40);
  const intensity = intensityFromEnergy(energy);

  // For MVP: default playlist/channel. You can later map palette->playlist.
  const playlistIndex = (body?.playlist_index || "1.0.0").toString();

  // Stable per user: client can send a custom_id; otherwise one shared MVP id.
  const customId = (body?.custom_id || "tintune-music-lab").toString();

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

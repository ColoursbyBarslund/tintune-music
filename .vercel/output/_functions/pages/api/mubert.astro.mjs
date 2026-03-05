export { renderers } from '../../renderers.mjs';

function isAllowedUpstream(urlStr) {
  try {
    const u = new URL(urlStr);
    const host = u.hostname.toLowerCase();
    if (host === "stream.mubert.com") return true;
    if (host === "play.mubert.com") return true;
    if (host.endsWith(".mubert.com")) return true;
    if (host.endsWith(".mubertcdn.com")) return true;
    return false;
  } catch {
    return false;
  }
}
const customerCache = /* @__PURE__ */ new Map();
function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}
function sanitizeHeaderValue(value) {
  const trimmed = String(value ?? "").trim();
  const cleaned = trimmed.replace(/[\u201C\u201D\u2018\u2019]/g, "").replace(/^"+|"+$/g, "").replace(/\u00A0/g, " ").trim();
  let out = "";
  for (let i = 0; i < cleaned.length; i++) {
    const code = cleaned.charCodeAt(i);
    if (code <= 255) out += cleaned[i];
  }
  return out.trim();
}
function requireEnv(name, raw) {
  const cleaned = sanitizeHeaderValue(raw ?? "");
  if (!cleaned) throw new Error(`Missing ${name}`);
  return cleaned;
}
function intensityFromScoreAmbientFirst(score) {
  const s = clamp(score, 0, 100);
  if (s < 52) return "low";
  if (s < 82) return "medium";
  return "high";
}
function parseHexToRgb(hex) {
  const norm = String(hex || "").trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(norm)) return null;
  return {
    r: parseInt(norm.slice(0, 2), 16),
    g: parseInt(norm.slice(2, 4), 16),
    b: parseInt(norm.slice(4, 6), 16)
  };
}
function rgbToHsl(r, g, b) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  const l = (max + min) / 2;
  let h = 0;
  if (d !== 0) {
    if (max === rn) h = (gn - bn) / d % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return { h, s: s * 100, l: l * 100 };
}
function extractWeightedColors(body) {
  const fromParams = Array.isArray(body?.color_params) ? body.color_params : [];
  const validFromParams = fromParams.map((x) => {
    const hex = String(x?.hex || "").trim();
    const parsed = parseHexToRgb(hex);
    if (!parsed) return null;
    const weight = clamp(Number(x?.weight ?? 0), 0, 100);
    return { hex: `#${hex.replace(/^#/, "").toUpperCase()}`, weight };
  }).filter(Boolean);
  const totalParamWeight = validFromParams.reduce((a, c) => a + c.weight, 0);
  if (validFromParams.length > 0 && totalParamWeight > 0) {
    return validFromParams.map((c) => ({
      hex: c.hex,
      weight: c.weight / totalParamWeight * 100
    }));
  }
  const palette = Array.isArray(body?.palette) ? body.palette.slice(0, 3) : [];
  const baseWeight = palette.length ? 100 / palette.length : 0;
  return palette.map((hex) => {
    const parsed = parseHexToRgb(hex);
    if (!parsed) return null;
    return { hex: `#${String(hex).replace(/^#/, "").toUpperCase()}`, weight: baseWeight };
  }).filter(Boolean);
}
function derivePaletteProfile(weightedColors) {
  const hsl = weightedColors.map((c) => {
    const rgb = parseHexToRgb(c.hex);
    if (!rgb) return null;
    return { ...rgbToHsl(rgb.r, rgb.g, rgb.b), weight: c.weight };
  }).filter(Boolean);
  if (hsl.length === 0) {
    return {
      name: "balanced-earth",
      warmth: 0,
      saturation: 50,
      brightness: 50,
      contrast: 25,
      intensityBias: 0
    };
  }
  const saturation = hsl.reduce((a, c) => a + c.s * c.weight, 0) / 100;
  const brightness = hsl.reduce((a, c) => a + c.l * c.weight, 0) / 100;
  const lightMin = hsl.reduce((a, c) => Math.min(a, c.l), 100);
  const lightMax = hsl.reduce((a, c) => Math.max(a, c.l), 0);
  const contrast = clamp(lightMax - lightMin, 0, 100);
  const warmthValues = hsl.map((c) => {
    const rad = c.h * Math.PI / 180;
    return Math.cos(rad) * 100 * (c.weight / 100);
  });
  const warmth = warmthValues.reduce((a, v) => a + v, 0);
  let name = "balanced-earth";
  let intensityBias = 0;
  if (saturation < 26 && brightness < 38) {
    name = "nocturne-drift";
    intensityBias = -18;
  } else if (saturation < 32 && brightness >= 38) {
    name = "mist-ambient";
    intensityBias = -10;
  } else if (warmth > 20 && saturation > 45) {
    name = "sunburst-groove";
    intensityBias = 12;
  } else if (warmth < -20 && saturation > 40) {
    name = "neon-cool";
    intensityBias = 6;
  } else if (contrast > 42) {
    name = "contrast-drive";
    intensityBias = 10;
  }
  return {
    name,
    warmth: Math.round(warmth),
    saturation: Math.round(saturation),
    brightness: Math.round(brightness),
    contrast: Math.round(contrast),
    intensityBias
  };
}
function intensityFromParamsAndPalette(params, weightedColors) {
  const energy = clamp(Number(params?.energy ?? 40), 0, 100);
  const texture = clamp(Number(params?.texture ?? 50), 0, 100);
  const space = clamp(Number(params?.space ?? 60), 0, 100);
  const profile = derivePaletteProfile(weightedColors);
  const spaceAmbientPull = (space - 50) * 0.35;
  const paletteLift = profile.intensityBias + (profile.saturation - 50) * 0.06 + profile.warmth * 0.05;
  const blended = clamp(
    energy * 0.42 + texture * 0.16 - spaceAmbientPull + paletteLift,
    0,
    100
  );
  return {
    intensity: intensityFromScoreAmbientFirst(blended),
    profile,
    blended: Math.round(blended)
  };
}
function chooseAmbientPreset(params, profile) {
  const energy = clamp(Number(params?.energy ?? 40), 0, 100);
  const texture = clamp(Number(params?.texture ?? 50), 0, 100);
  const space = clamp(Number(params?.space ?? 60), 0, 100);
  if (profile.brightness < 30 || profile.contrast > 55 && profile.warmth > 15) {
    return { playlistIndex: "6.5.2", label: "dark-ambient" };
  }
  if (space >= 72 || profile.warmth < -10 && profile.saturation < 42) {
    return { playlistIndex: "6.5.0", label: "atmosphere" };
  }
  if (energy < 42 && texture < 55 && profile.saturation < 45) {
    return { playlistIndex: "3.0.1", label: "ambient-om" };
  }
  return { playlistIndex: "3.0.0", label: "ambient-meditation" };
}
async function ensureCustomer(companyId, licenseToken, customId) {
  const cached = customerCache.get(customId);
  if (cached) return cached;
  const resp = await fetch("https://music-api.mubert.com/api/v3/service/customers", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "company-id": sanitizeHeaderValue(companyId),
      "license-token": sanitizeHeaderValue(licenseToken)
    },
    body: JSON.stringify({ custom_id: customId })
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Mubert service/customers ${resp.status}: ${text}`);
  }
  const json = await resp.json().catch(() => null);
  const customerId = json?.data?.id || json?.id || json?.data?.customer_id || json?.customer_id;
  const accessToken = json?.data?.access?.token || json?.access?.token || json?.token || json?.access_token;
  if (!customerId || !accessToken) {
    const shape = {
      hasData: !!json?.data,
      dataKeys: json?.data ? Object.keys(json.data) : [],
      hasAccess: !!json?.data?.access,
      accessKeys: json?.data?.access ? Object.keys(json.data.access) : []
    };
    throw new Error(`Mubert service/customers: could not parse creds. shape=${JSON.stringify(shape)} resp=${JSON.stringify(json)}`);
  }
  const creds = { customerId: String(customerId), accessToken: String(accessToken) };
  customerCache.set(customId, creds);
  return creds;
}
async function requestStreamingLink(customerId, accessToken, playlistIndex, intensity) {
  const query = new URLSearchParams({
    playlist_index: playlistIndex,
    bitrate: "320",
    intensity,
    type: "http"
  });
  const url = `https://music-api.mubert.com/api/v3/public/streaming/get-link?${query.toString()}`;
  const resp = await fetch(url, {
    method: "GET",
    headers: {
      "customer-id": sanitizeHeaderValue(customerId),
      "access-token": sanitizeHeaderValue(accessToken)
    }
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Mubert streaming/get-link ${resp.status}: ${text}`);
  }
  const json = await resp.json().catch(() => null);
  const link = json?.data?.link || json?.link || json?.url || json?.data?.url || json?.result?.link || json?.result?.url;
  if (!link) {
    throw new Error(`Mubert streaming/get-link: missing link in response: ${JSON.stringify(json)}`);
  }
  return String(link);
}
async function fetchWithSafeRedirects(startUrl, init, maxHops = 5) {
  let current = startUrl;
  for (let hop = 0; hop <= maxHops; hop++) {
    const resp = await fetch(current, { ...init, redirect: "manual" });
    if (resp.status >= 300 && resp.status < 400) {
      const loc = resp.headers.get("location");
      if (!loc) return resp;
      const next = new URL(loc, current).toString();
      if (!isAllowedUpstream(next)) {
        return new Response(`Blocked redirect to disallowed host: ${next}`, {
          status: 502,
          headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" }
        });
      }
      current = next;
      continue;
    }
    return resp;
  }
  return new Response("Too many redirects", {
    status: 502,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" }
  });
}
const GET = async ({ url, request }) => {
  const mode = url.searchParams.get("mode");
  if (mode !== "stream" && mode !== "probe") {
    return new Response("Not found", { status: 404 });
  }
  let upstream = url.searchParams.get("u") || "";
  try {
    for (let i = 0; i < 3; i++) {
      if (/^https?%3A/i.test(upstream) || upstream.includes("%2F")) {
        upstream = decodeURIComponent(upstream);
      }
    }
  } catch {
  }
  if (!upstream || !isAllowedUpstream(upstream)) {
    return new Response(`Invalid upstream: ${upstream.slice(0, 120)}`, { status: 400 });
  }
  const range = request.headers.get("range");
  const headers = {};
  const hadRange = !!range;
  if (range) headers["range"] = range;
  try {
    const u = new URL(upstream);
    const cid = u.searchParams.get("customer_id") || u.searchParams.get("customer-id") || u.searchParams.get("customer");
    const tok = u.searchParams.get("access_token") || u.searchParams.get("access-token") || u.searchParams.get("token");
    const cidClean = cid ? sanitizeHeaderValue(cid) : "";
    const tokClean = tok ? sanitizeHeaderValue(tok) : "";
    if (cidClean) {
      headers["customer-id"] = cidClean;
      headers["customer_id"] = cidClean;
    }
    if (tokClean) {
      headers["access-token"] = tokClean;
      headers["access_token"] = tokClean;
    }
  } catch {
  }
  let resp;
  try {
    resp = await fetchWithSafeRedirects(upstream, {
      method: "GET",
      headers
    });
    if (resp.status === 401) {
      const headersNoAuth = {};
      if (range) headersNoAuth["range"] = range;
      resp = await fetchWithSafeRedirects(upstream, {
        method: "GET",
        headers: headersNoAuth
      });
    }
    if (resp.status === 401 && hadRange) {
      resp = await fetchWithSafeRedirects(upstream, {
        method: "GET",
        headers: {}
      });
    }
  } catch (err) {
    const msg = err?.message || String(err);
    return new Response(`Upstream fetch failed: ${msg}`, { status: 502 });
  }
  const contentType = resp.headers.get("content-type") || "application/octet-stream";
  if (mode === "probe") {
    let snippet = "";
    try {
      const text = await resp.text();
      snippet = text.slice(0, 2e3);
    } catch {
      snippet = "";
    }
    const headersDump = {};
    for (const [k, v] of resp.headers.entries()) {
      if (k.toLowerCase() === "set-cookie") continue;
      headersDump[k] = v;
    }
    headersDump["x-proxy-final-url"] = resp?.url || "";
    return new Response(
      `Upstream status=${resp.status}
content-type=${contentType}

headers=${JSON.stringify(headersDump, null, 2)}

body-snippet:
${snippet}`,
      {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store"
        }
      }
    );
  }
  if (!resp.ok) {
    let snippet = "";
    try {
      const text = await resp.text();
      snippet = text.slice(0, 2e3);
    } catch {
      snippet = "";
    }
    return new Response(
      `Upstream responded ${resp.status}. content-type=${contentType}
${snippet}`,
      {
        status: resp.status,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store"
        }
      }
    );
  }
  const outHeaders = {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
    // Helpful for media playback when the frontend is on a different origin.
    // (Safe here because we only allow `stream.mubert.com` upstream.)
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Expose-Headers": "accept-ranges, content-range, content-length, content-type"
  };
  const acceptRanges = resp.headers.get("accept-ranges");
  const contentRange = resp.headers.get("content-range");
  const contentLength = resp.headers.get("content-length");
  if (acceptRanges) outHeaders["accept-ranges"] = acceptRanges;
  if (contentRange) outHeaders["content-range"] = contentRange;
  if (contentLength) outHeaders["content-length"] = contentLength;
  return new Response(resp.body, {
    status: resp.status,
    headers: outHeaders
  });
};
const POST = async ({ request }) => {
  let companyId;
  let licenseToken;
  try {
    companyId = requireEnv("MUBERT_COMPANY_ID", "a13a4b83-2171-417c-a1bf-52f3787e1c75");
    licenseToken = requireEnv(
      "MUBERT_LICENSE_TOKEN",
      "ZlLre0O9YytgrO7hmXvcQKpFKFRbvYptu2jCf5uKeIt9Tu1l1HYfftuHL7xlPXv0"
    );
  } catch (err) {
    return new Response(err?.message || String(err), { status: 500 });
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  const weightedColors = extractWeightedColors(body);
  const mapped = intensityFromParamsAndPalette(body?.params, weightedColors);
  const intensity = mapped.intensity;
  const ambientPreset = chooseAmbientPreset(body?.params, mapped.profile);
  const playlistIndex = ambientPreset.playlistIndex;
  const customId = String(body?.custom_id ?? "tintune-music-lab");
  try {
    const { customerId, accessToken } = await ensureCustomer(companyId, licenseToken, customId);
    const streamUrl = await requestStreamingLink(customerId, accessToken, playlistIndex, intensity);
    const proxyUrl = `/api/mubert?mode=stream&u=${encodeURIComponent(streamUrl)}`;
    return new Response(JSON.stringify({
      streamUrl,
      proxyUrl,
      playlistIndex,
      playlistLabel: ambientPreset.label,
      intensity,
      blendedIntensity: mapped.blended,
      paletteProfile: mapped.profile
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store"
      }
    });
  } catch (err) {
    const msg = err?.message || String(err);
    return new Response(`Mubert proxy error: ${msg}`, { status: 502 });
  }
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  GET,
  POST
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };

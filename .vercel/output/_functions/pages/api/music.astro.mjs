export { renderers } from '../../renderers.mjs';

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}
function sanitizeHeaderValue(value) {
  const trimmed = String(value).trim();
  const cleaned = trimmed.replace(/[\u201C\u201D\u2018\u2019]/g, "").replace(/^"+|"+$/g, "").replace(/\u00A0/g, " ").trim();
  let out = "";
  for (let i = 0; i < cleaned.length; i++) {
    const code = cleaned.charCodeAt(i);
    if (code <= 255) out += cleaned[i];
  }
  return out.trim();
}
function resolveMusicLengthMs(raw) {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return 18e4;
  return Math.round(clamp(parsed, 3e3, 3e5));
}
function buildPrompt(palette, p) {
  const energy = clamp(p.energy, 0, 100);
  const texture = clamp(p.texture, 0, 100);
  const space = clamp(p.space, 0, 100);
  const bpm = Math.round(55 + energy / 100 * 55);
  const density = texture < 35 ? "minimal, clean timbres" : texture < 70 ? "moderately layered timbres" : "rich, complex timbres";
  const ambience = space < 35 ? "dry and intimate" : space < 70 ? "moderately spacious" : "very spacious, atmospheric reverb";
  const mood = energy < 35 ? "calm, grounded" : energy < 70 ? "steady, curious" : "lively, forward-moving";
  return [
    "Instrumental music only.",
    "Create a seamless loop designed to repeat forever.",
    "No intro build-up, no outro, no ending cadence.",
    "No fade-in and no fade-out.",
    "The ending must connect seamlessly back to the beginning.",
    `Tempo around ${bpm} BPM.`,
    `Mood: ${mood}.`,
    `Texture: ${density}.`,
    `Space: ${ambience}.`,
    "No vocals.",
    "No abrupt genre switches.",
    `Colour palette: ${palette.join(", ")}.`
  ].join(" ");
}
const POST = async ({ request }) => {
  const apiKey = sanitizeHeaderValue("sk_9dab48d124f1c79acf1849092ace14a4489d034660e9b7c0");
  if (!apiKey) {
    return new Response("Missing ELEVENLABS_API_KEY", { status: 500 });
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  const palette = Array.isArray(body.palette) ? body.palette.slice(0, 3) : [];
  if (palette.length !== 3) {
    return new Response("palette must be 3 hex strings", { status: 400 });
  }
  const params = body.params || { energy: 40, texture: 50, space: 60 };
  const prompt = buildPrompt(palette, params);
  const elevenUrl = "https://api.elevenlabs.io/v1/music/compose";
  const musicLengthMs = resolveMusicLengthMs(
    "180000"
  );
  let resp;
  try {
    resp = await fetch(elevenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": apiKey
      },
      body: JSON.stringify({
        prompt,
        music_length_ms: musicLengthMs,
        model_id: "music_v1",
        force_instrumental: true,
        output_format: "mp3_44100_128"
      })
    });
  } catch (err) {
    const msg = err?.message || String(err);
    return new Response(`ElevenLabs request failed: ${msg}`, { status: 502 });
  }
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    return new Response(
      `ElevenLabs error ${resp.status}: ${text}`,
      { status: 502 }
    );
  }
  const audioBuffer = await resp.arrayBuffer();
  return new Response(audioBuffer, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store"
    }
  });
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  POST
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };

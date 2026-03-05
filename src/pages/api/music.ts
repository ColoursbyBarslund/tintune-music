import type { APIRoute } from "astro";

type MusicRequest = {
  palette: string[];
  params: {
    energy: number;  // 0-100
    texture: number; // 0-100
    space: number;   // 0-100
  };
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function resolveMusicLengthMs(raw: string | undefined): number {
  const parsed = Number(raw ?? "");
  if (!Number.isFinite(parsed)) return 180000;
  return Math.round(clamp(parsed, 3000, 300000));
}

function buildPrompt(palette: string[], p: MusicRequest["params"]) {
  const energy = clamp(p.energy, 0, 100);
  const texture = clamp(p.texture, 0, 100);
  const space = clamp(p.space, 0, 100);

  // Simpel, stabil oversættelse (vi kan raffinere senere)
  const bpm = Math.round(55 + (energy / 100) * 55); // 55–110
  const density =
    texture < 35 ? "minimal, clean timbres" :
    texture < 70 ? "moderately layered timbres" :
                   "rich, complex timbres";

  const ambience =
    space < 35 ? "dry and intimate" :
    space < 70 ? "moderately spacious" :
                 "very spacious, atmospheric reverb";

  const mood =
    energy < 35 ? "calm, grounded" :
    energy < 70 ? "steady, curious" :
                  "lively, forward-moving";

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
    `Colour palette: ${palette.join(", ")}.`,
  ].join(" ");
}

export const POST: APIRoute = async ({ request }) => {
  const apiKey = import.meta.env.ELEVENLABS_API_KEY || process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return new Response("Missing ELEVENLABS_API_KEY", { status: 500 });
  }

  let body: MusicRequest;
  try {
    body = (await request.json()) as MusicRequest;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const palette = Array.isArray(body.palette) ? body.palette.slice(0, 3) : [];
  if (palette.length !== 3) {
    return new Response("palette must be 3 hex strings", { status: 400 });
  }

  const params = body.params || { energy: 40, texture: 50, space: 60 };
  const prompt = buildPrompt(palette, params);

  // Music API – returnerer en audio-fil (MP3) direkte
  // Docs: auth header xi-api-key  [oai_citation:1‡ElevenLabs](https://elevenlabs.io/docs/api-reference/authentication?utm_source=chatgpt.com)
  // Compose schema (prompt, music_length_ms, model_id, force_instrumental, output_format)  [oai_citation:2‡ElevenLabs](https://elevenlabs.io/docs/api-reference/music/compose?utm_source=chatgpt.com)
  const elevenUrl = "https://api.elevenlabs.io/v1/music/compose";

  const musicLengthMs = resolveMusicLengthMs(
    import.meta.env.ELEVENLABS_MUSIC_LENGTH_MS || process.env.ELEVENLABS_MUSIC_LENGTH_MS
  );

  const resp = await fetch(elevenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": apiKey,
    },
    body: JSON.stringify({
      prompt,
      music_length_ms: musicLengthMs,
      model_id: "music_v1",
      force_instrumental: true,
      output_format: "mp3_44100_128",
    }),
  });

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
      "Cache-Control": "no-store",
    },
  });
};

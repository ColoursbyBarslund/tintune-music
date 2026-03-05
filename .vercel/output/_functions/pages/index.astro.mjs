import { e as createComponent, k as renderHead, l as renderScript, r as renderTemplate } from '../chunks/astro/server_DRMO4r1I.mjs';
import 'piccolore';
import 'clsx';
/* empty css                                 */
export { renderers } from '../renderers.mjs';

const $$Index = createComponent(async ($$result, $$props, $$slots) => {
  return renderTemplate`<html lang="en" data-astro-cid-j7pv25f6> <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Tintune Music Lab</title>${renderHead()}</head> <body data-astro-cid-j7pv25f6> <main data-astro-cid-j7pv25f6> <div class="grid" data-astro-cid-j7pv25f6> <section class="panel visualizerPanel" data-astro-cid-j7pv25f6> <div class="paletteRow" aria-label="Palette" data-astro-cid-j7pv25f6> <div class="wheelStage" id="wheelStage" data-astro-cid-j7pv25f6> <canvas id="colorWheel" data-astro-cid-j7pv25f6></canvas> <div class="visualizerLayer" id="visualizerLayer" data-astro-cid-j7pv25f6> <canvas id="visualizerCanvas" data-astro-cid-j7pv25f6></canvas> </div> <div class="visualizerCard" aria-hidden="true" data-astro-cid-j7pv25f6></div> <div class="visualizerActions" aria-label="Stream actions" data-astro-cid-j7pv25f6> <div class="overlayPaletteBar" aria-hidden="true" data-astro-cid-j7pv25f6> <div id="p1" data-astro-cid-j7pv25f6></div> <div id="p2" data-astro-cid-j7pv25f6></div> <div id="p3" data-astro-cid-j7pv25f6></div> </div> <div class="overlayControlsRow" data-astro-cid-j7pv25f6> <div class="overlayEngineWrap" data-astro-cid-j7pv25f6> <span class="engineBadge" id="engineBadge" data-astro-cid-j7pv25f6>Engine: Idle</span> </div> <div class="overlayButtons" data-astro-cid-j7pv25f6> <button class="primary" id="generate" aria-label="Start or update stream" title="Start / Update stream" data-astro-cid-j7pv25f6>&#9654;</button> <button id="stop" aria-label="Stop stream" title="Stop" data-astro-cid-j7pv25f6>&#9632;</button> </div> <div aria-hidden="true" data-astro-cid-j7pv25f6></div> </div> </div> <button id="payloadToggleBtn" class="payloadToggleBtn" type="button" aria-label="Show or hide payload" aria-pressed="true" title="Show / hide payload" data-astro-cid-j7pv25f6>&#9881;</button> <div class="visualizerSpinner" id="visualizerSpinner" aria-hidden="true" data-astro-cid-j7pv25f6></div> <div class="wheelDot" id="dot0" data-astro-cid-j7pv25f6> <span class="dotRole" data-astro-cid-j7pv25f6>Base</span> </div> <div class="wheelDot" id="dot1" data-astro-cid-j7pv25f6> <span class="dotRole" data-astro-cid-j7pv25f6>Baggrund</span> </div> <div class="wheelDot" id="dot2" data-astro-cid-j7pv25f6> <span class="dotRole" data-astro-cid-j7pv25f6>Accent</span> </div> </div> </div> <div class="controls" aria-label="Controls" data-astro-cid-j7pv25f6> <div class="notice" id="notice" data-astro-cid-j7pv25f6></div> </div> </section> </div> <aside class="panel preview" id="payloadPanel" hidden data-astro-cid-j7pv25f6> <div id="payloadSection" data-astro-cid-j7pv25f6> <strong data-astro-cid-j7pv25f6>Payload</strong> <div class="status" id="status" data-astro-cid-j7pv25f6></div> <div class="hairline" data-astro-cid-j7pv25f6></div> <audio id="player" preload="none" controls data-astro-cid-j7pv25f6></audio> <audio id="playerB" preload="none" aria-hidden="true" style="display:none" data-astro-cid-j7pv25f6></audio> <div class="divider" data-astro-cid-j7pv25f6></div> <div class="mono" id="payload" data-astro-cid-j7pv25f6></div> </div> <p class="hint" data-astro-cid-j7pv25f6>
Stream is requested from <span class="mono" data-astro-cid-j7pv25f6>/api/mubert</span>. Playlist is auto-selected from ambient presets.
</p> </aside> <div class="hexPopup" id="hexPopup" data-astro-cid-j7pv25f6> <input id="hexPopupInput" inputmode="text" autocapitalize="characters" data-astro-cid-j7pv25f6> </div> ${renderScript($$result, "/Users/fardabar/tintune-music/src/pages/index.astro?astro&type=script&index=0&lang.ts")} </main> </body> </html>`;
}, "/Users/fardabar/tintune-music/src/pages/index.astro", void 0);

const $$file = "/Users/fardabar/tintune-music/src/pages/index.astro";
const $$url = "";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Index,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };

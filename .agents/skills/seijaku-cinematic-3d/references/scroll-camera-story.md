# Scroll, Camera, and Narrative

Seijaku's feel comes from three decisions: scrolling is a **timeline**, the camera is a **curve with explicit timing**, and text is **a function of the same time**. Nothing is triggered by disconnected events.

## 1. Page Structure

```html
<div id="sizer"></div>                 <!-- height only: sets journey length -->
<div id="stage"><canvas id="gl"></canvas><div id="ui">…chapters…</div></div>  <!-- position: fixed -->
<main id="story">…editorial sections that move over the canvas…</main>
```

```css
#sizer { height: calc(100svh + 2400svh); pointer-events: none; } /* use svh, not fixed px: same speed on every device */
#stage { position: fixed; inset: 0; overflow: hidden; }
html, body { overflow-x: clip; }   /* nothing can widen the page on mobile */
```

Seijaku fixes the journey length at `23800px`: on mobile, the journey lasts many more screens than on desktop. Use viewport units.

## 2. Scroll to Time, with Smoothing

```js
const T = 34;                       // journey duration in "movie seconds"
let maxScroll = 1, tTarget = 0, tCur = 0;
const measure = () => { maxScroll = Math.max(1, sizer.offsetHeight - innerHeight); };
measure(); addEventListener('resize', measure);
addEventListener('scroll', () => { tTarget = clamp(scrollY / maxScroll, 0, 1) * T; }, { passive: true });
history.scrollRestoration = 'manual';

// in the single loop:
const dt = Math.min(0.05, (now - last) / 1000); last = now;
tCur += (tTarget - tCur) * (1 - Math.exp(-dt * 6));   // frame-rate independent
```

- The `scroll` event writes one number only; all work happens in the loop.
- `k = 6` gives inertia without feeling detached from the wheel. Higher values track scrolling more closely.
- Cap `dt` at 0.05 s: after a hidden tab or long task, the camera neither jumps nor runs backward.

## 3. Camera Keyframes with Explicit Times

Each keyframe is `{ t, position, look target, fov }`. Interpolation uses cubic Hermite with Catmull–Rom-style tangents **normalized by the actual time interval**, so irregularly spaced keyframes do not cause speed jumps.

```js
const K = (t, pos, look, fov) => ({ t, v: [...pos, ...look, fov] });
const KEYS = [
  K(0.0, [0, 1.7, 120], [0, 40, 0], 44),     // arrival through the desert
  K(4.0, [0, 1.7, 70],  [0, 30, 0], 46),
  K(7.5, [0, 18, 34],   [0, 17, 30], 52),    // climb toward the north entrance
  // …
];

function sampleKeys(keys, t, out) {          // out: Float32Array(7) = px,py,pz,lx,ly,lz,fov
  const n = keys.length;
  if (t <= keys[0].t) { out.set(keys[0].v); return out; }
  if (t >= keys[n - 1].t) { out.set(keys[n - 1].v); return out; }
  let i = 0; while (t >= keys[i + 1].t) i++;
  const a = keys[Math.max(0, i - 1)], k0 = keys[i], k1 = keys[i + 1], b = keys[Math.min(n - 1, i + 2)];
  const h = k1.t - k0.t, s = (t - k0.t) / h, s2 = s * s, s3 = s2 * s;
  const h00 = 2 * s3 - 3 * s2 + 1, h10 = s3 - 2 * s2 + s, h01 = -2 * s3 + 3 * s2, h11 = s3 - s2;
  for (let c = 0; c < out.length; c++) {
    const m0 = (k1.v[c] - a.v[c]) / (k1.t - a.t) * h;
    const m1 = (b.v[c] - k0.v[c]) / (b.t - k0.t) * h;
    out[c] = h00 * k0.v[c] + h10 * m0 + h01 * k1.v[c] + h11 * m1;
  }
  return out;
}
```

Composition rules learned from Seijaku:

- Keep eye height constant (1.55–1.7 m above ground); change it only when climbing a real step.
- To slow down before an object (an opening door, a relief), place keyframes close together in space, but not in time.
- Aim slightly ahead of the path and slightly below the horizon indoors.
- Use a wider FOV in narrow spaces (56–60) and a narrower one outdoors (44–50). Add ≈10° in portrait orientation (`portrait = 1 - smoothstep(0.55, 1.1, aspect)`).
- Check every segment with `?t=…` (fixed-time render) before approving the route: the camera must not pass through walls or columns.

## 4. Derive All State from `t`

```js
function sampleFilm(t, s) {
  sampleKeys(KEYS, t, s.cam);
  s.day   = 1 - smoothstep(29, 33.5, t);
  s.dusk  = smoothstep(28.5, 33, t);
  s.night = smoothstep(31.5, 34.8, t) * 0.8;
  s.exposure = piecewise(EXPOSURE, t);      // [[t, value], …], linearly interpolated
  return s;
}
// doors, sliding slabs, torches turning on:
door.setOpen(smoothstep(door.t0, door.t1, t));
```

Because there is no accumulated state, rewinding works naturally and captures are reproducible (`?t=12.4`, `?cam=x,y,z,tx,ty,tz,fov`).

## 5. Chapters over the Canvas

```js
const win = (t, a, b, fi = 0.25, fo = 0.25) => smoothstep(a, a + fi, t) * (1 - smoothstep(b - fo, b, t));
for (const ch of chapters) {
  const v = win(t, ch.a, ch.b, ch.fi, ch.fo);
  if (Math.abs(v - ch.v) < 0.002) continue;   // update the DOM only when it changes
  ch.v = v;
  ch.el.style.opacity = v.toFixed(3);
  ch.el.style.transform = `translate3d(0, ${((1 - v) * 14).toFixed(2)}px, 0)`;
}
```

- Use only `opacity` and `transform` (GPU compositing). Seijaku also animates `filter: blur()` on text over WebGL, causing a repaint every frame; avoid it or use it only on entry.
- Add a progress rail with the active chapter and a fading label (220 ms out → change text → fade in).
- Chapters must be readable without 3D: the same HTML is the fallback content.

## 6. Section Poses and "Covered" Mode

After the journey, editorial sections slide over the canvas. Each controls what the scene does:

- `data-pose="name"`: camera leaves the curve and eases (`k ≈ 2.5`) toward a fixed pose, with drift proportional to section progress (`pos + drift * progress`).
- Opaque section covering the screen: `covered` mode → **do not render**; the canvas keeps the last frame.
- On entering a new pose, the first sample is a direct jump (`snap`) to avoid dragging the camera from the other side of the scene.

Use an `IntersectionObserver` to identify visible sections and call `getBoundingClientRect` only for those (Seijaku checks all sections every frame). Read all rectangles first, then write, to avoid interleaved layout work.

## 7. Inspection Mode (Orbit)

- Enter via a visible button or a mouse drag longer than 6 px on the canvas (a touch drag remains scrolling). Exit with a "return to journey" button or `Escape`.
- While active: `html { overflow: hidden }`, `canvas { touch-action: none }`, and hide chapters.
- Custom inertial orbit: estimate drag velocity (`lerp` toward `-dx·k/dt`), decay with `exp(-3·dt)`, clamp `phi`, ease distance (`k = 9`), use two pointers for pinch, and use the wheel with `preventDefault` (listener `{ passive: false }`). After 4 s idle, ease in autorotation and stop it on interaction.
- Start from the side the user is already facing: `theta = atan2(cam.x - target.x, cam.z - target.z)`.
- Transitions must never cut: blend the journey pose with the orbit pose over 1.5 s and lift the arc to avoid passing through the roof (or pyramid):

```js
blend = clamp(blend + (on ? dt : -dt) / 1.5, 0, 1);
const b = blend * blend * (3 - 2 * blend);
pose.pos.lerpVectors(film.pos, orbitPos, b);
pose.pos.y += Math.sin(Math.PI * b) * 2.2;
pose.look.lerpVectors(film.look, orbitTarget, b);
pose.fov = lerp(film.fov, orbitFov, b);
```

- When exiting, the journey resumes exactly where it was: orbit never modifies `tCur`.

## 8. Mouse Parallax on the Cover

At the start, rotate the camera a few degrees around the look target with the pointer (≈±3° horizontally, less vertically); fade the effect out with `1 - smoothstep(0.5, 2.4, t)`. Only enable it for `(hover: hover) and (pointer: fine)`, reduce amplitude under `prefers-reduced-motion`, and keep the camera above the ground.

## 9. Jumps (Floor Plan, Menu, Cards)

`goTo(t)` converts time to scroll: `scrollTo({ top: t / T * maxScroll, behavior: 'smooth' })`. Improvement over Seijaku: long smooth-scroll jumps traverse every intermediate segment and trigger loading for all its regions. For long distances, fade to black (`uDim`), jump with `behavior: 'instant'`, set `tCur = tTarget`, request the destination region, and fade back in.

The floor plan is an SVG with one `<g>` per room (rect + text) and `data-t`; on click, call `goTo`. For pyramids: a longitudinal cutaway with the entrance, descending passage, Grand Gallery, and chambers.

## 10. Pinned Sections

```css
.pin-section { height: 440svh; }
.pin { position: sticky; top: 0; height: 100svh; overflow: hidden; }
```

`progress = clamp(-rect.top / (rect.height - innerHeight), 0, 1)`. Use that value for:

- **Horizontal track**: `translate3d(-(scrollWidth - innerWidth) * ease(p), 0, 0)` and set each image's parallax depth.
- **Material transition**: a full-screen quad with two textures. Within each stage, zoom toward texture A (zoom 1 → 1.9), then grow B through A with a noise threshold: `edge = smoothstep(mix - 0.18, mix + 0.18, noise(uv))`. Calculate `cover` fitting in the shader using aspect ratio. Request only the current and next images; in portrait, request a width of `max(width, height · textureAspect)` so the grain does not blur.
- **Construction exploded view**: each piece stores a base position and separation vector; `pos = base + offset * ease(clamp((p - 0.12) / 0.7, 0, 1))`. The camera orbits with `p`. Labels are HTML, and an SVG line joins each label to the screen projection of a 3D anchor (`anchor.getWorldPosition(v).project(cam)`). Hide lines on narrow screens.

Seijaku creates a `WebGLRenderer` for each of these sections; use the main renderer with `setScissor`/`setViewport` or a render target (see corrections).

## 11. Typography and Reveals

- Split titles into words or letters with a CSS index variable: `transition-delay: calc(var(--i) * 55ms)`; an `IntersectionObserver` adds `.in` once, then stops observing.
- Line drawings: set `stroke-dasharray = stroke-dashoffset = path.getTotalLength()`, then reduce the offset with section progress; start each stroke slightly after the previous one.
- Illustrations: animate `clip-path: inset(0 X% 0 0)` with progress (advancing-ink effect). For pyramids, "paint" hieroglyphs into view.
- Count numbers upward on entry (easeOutCubic, 1.5–2.4 s); do not animate years or small numbers.
- For text inside the scene, draw to a 2D canvas **after `document.fonts.ready`**, as an sRGB `CanvasTexture` on a plane with `depthWrite: false`; scale it vertically to fit.

## 12. Header Readable over Any Background

Recommended: each section declares `data-theme="light|dark"` and an `IntersectionObserver` updates the header color; over the canvas, the current chapter determines the theme. This is deterministic and free.

Seijaku samples actual pixels beneath the header: `readPixels` of one row into a `PIXEL_PACK_BUFFER`, `fenceSync`, then read a few frames later with `getBufferSubData` when the fence signals (without blocking the GPU), using hysteresis (switch to dark if luminance > 125, back to light below 100). Use this only if the background is unpredictable.

## 13. Loading Screen

- Custom 2D canvas draws particles forming a symbol according to real progress (for pyramids: an ankh or pyramid profile). Smooth the percentage and advance it slightly even if no progress arrives, so it does not appear stuck.
- `progress(v)` can only increase; `done()` fades out and removes the node; a safety timeout (30 s) never leaves the page blocked.
- Omit it on capture URLs (`?t=`, `?cam=`) and make it static with `prefers-reduced-motion`.

## 14. Synthesized Ambience

Use Web Audio, no files: looping noise through band-pass/low-pass filters with LFOs (wind, water), plucked notes with harmonic partials and per-partial decay, random phrases with long pauses scheduled by `setTimeout`, and filtered feedback delay as "space". Use one `master` with `setTargetAtTime` for ~1.5 s fades. Start only after a user gesture; cancel all timers when sound is turned off.

For Egypt: wind and sand, a low drone inside stone, and restrained harp or oud. Avoid Orientalist clichés and document that this is ambience, not a musical reconstruction.

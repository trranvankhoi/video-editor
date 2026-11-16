# ClipPro — Browser-Native Video Editor

**ClipPro** — Create. Cut. Wow.

A fast, private, browser-native video editor built with modern web technologies.
All editing, mixing, and export happens entirely on your device — no uploads, no
cloud processing.

![ClipPro dark UI](screenshot.png)

## Quick Links

- [Demo & Screenshots](#demo--screenshots)
- [Features](#features)
- [Getting Started](#getting-started)
- [Available Scripts](#available-scripts)
- [Architecture](#architecture)
- [Feature Checklist](#feature-checklist)
- [Licensing](#licensing)
- [Browser Support & Limits](#browser-support--limits)

## Demo & Screenshots

| Feature | Description |
|---------|-------------|
| **Dark 4-zone UI** | Top bar, 3-column main grid, timeline with resizer |
| **Multi-track magnetic timeline** | Unlimited video, audio, text, sticker tracks |
| **Keyframes & masks** | Transform/opacity/volume/mask keyframes with easing, shape + pen masks, feather, invert |
| **Chroma key** | Green screen / blue screen removal |
| **Color wheels & LUTs** | Three-way wheels, hue/vibrance, `.cube` LUT import, 66 filters |
| **40+ filters** | Vintage, cinematic, retro, light, texture looks |
| **70+ effects** | Vignette, grain, glow, particles, distortions |
| **44 transitions** | Fade, slide, zoom, wipe, iris, clock, blinds, mosaic |
| **Content-aware cuts** | Frame analysis suggests fade, dissolve, slide or whip per cut |
| **40 animations** | Fade, slide, pop, zoom, bounce, elastic, spin, typewriter |
| **Text, captions & voice** | SRT/VTT import, local/API Whisper, 24 CapCut VN voices + 3 Piper VN + system TTS |
| **Markers** | Colour-coded marker lane with snapping, rename and delete |
| **Audio tools** | Recording, volume keyframes, fades, mixdown |
| **PWA** | Installable, offline-capable, home screen |
| **Undo/redo** | Full history with project snapshots |
| **Autosave** | IndexedDB persistence, 1400ms debounce |
| **Export** | WebM VP9/Opus (reliable), MP4 H.264 (video only) |

## Features

### Core Editing

- **Multi-track magnetic timeline** — Clips snap together, no gaps. Add video,
  audio, text, or sticker clips by drag‑and‑drop or the import overlay.
- **Trim & split** — Drag clip edges to trim, press `Ctrl+B` (or `Cmd+B`) to
  split at playhead. Undo/redo with full project snapshots.
- **Speed & detachment** — Adjust clip speed (0.5×–2×), detach audio from video
  to move it to its own track.

### Keyframes, Masks & Color

- **First-class keyframes** — Animate position, scale, rotation, opacity, volume
  and mask position/scale/rotation. Each keyframe stores its own easing
  (`linear`, ease-in/out, ease-in-out, back) and is editable from the inspector
  or by dragging diamonds on the timeline.
- **Shape masks** — Rectangle, ellipse, triangle, diamond, star, heart, line and
  freehand pen masks with feather, invert and opacity. Drag the mask directly on
  the preview; the renderer composites it through an offscreen canvas.
- **Three-way color grading** — Shadows, midtones and highlights wheels plus hue,
  vibrance, temperature, tint, exposure, contrast, saturation and vignette.
- **LUT support** — Import `.cube` LUTs (1D or 3D), keep them in local storage,
  blend with an intensity slider and preview them in the canvas renderer.
- **Chroma key** — Remove green/blue screens with tolerance, softness and spill
  controls.
- **Markers** — Add colour-coded markers to the timeline, rename them, drag them,
  and snap clips to them. Press `M` to add a marker at the playhead.

### Animations, Effects & Transitions

- **Animation presets** — 40 types (fade, slide, pop, zoom, bounce, elastic,
  typewriter, glitch, shake, drift, float, tumbler, unfold, roll, pulse, and
  more). Apply `animationIn` and `animationOut` to any clip via the Inspector.
- **Transition presets** — 44 types (fade, dissolve, slide-left/right/up/down,
  push-*, zoom-*, wipe-*, iris, clock, blinds-h/v, checker, split-h/v, blur,
  blur-in, whip-*, spin, flip-h/v, glitch, light-leak, roll-*, mosaic, diamond).
  Transitions are applied between two adjacent clips on the same track.
- **Content-aware suggestions** — The auto-transition command samples the
  outgoing and incoming frames, measures brightness/colour contrast and motion
  direction, then picks a fade, dissolve, slide or whip. Falls back to a cross
  fade when a clip cannot be decoded.
- **Effect presets** — 70+ op‑based effects (vignette, grain, light‑leak,
  scanlines, glitch, shake, bloom, warm‑glow, cool‑mist, teal‑orange, sepia,
  noir, dream, vhs, crt, old‑film, projector, neon, cyberpunk, infrared,
  thermal, night‑vision, bleach, matte, pastel, candy, sunset, ocean, forest,
  lavender, rose, amber, arctic, ember, chrome, duotone, monochrome, halftone,
  dot‑screen, grid, crosshatch, stripes, noise, paper, watercolor, sketch,
  emboss, edge‑glow, chromatic, mirror, kaleido, pixelate, mosaic, zoom‑blur,
  echo, snow, rain, sparkle, bokeh, confetti, embers, lens‑flare, sun‑rays,
  spotlight, letterbox, film‑frame, polaroid, film‑strip, soft‑focus, lomo).
  Each effect uses declarative op maps so new ops are trivially extensible.

### Text, Captions & Voice

- **Text layers** — Full font selection (Inter, Space Grotesk, Bebas Neue,
  Playfair Display, Pacifico, Oswald via `@fontsource`), sizing, colour, opacity,
  alignment, and transform. Apply animation presets.
- **SRT/VTT import & export** — Parse external caption files, adjust timing, add
  cues as editable text clips, and export every text clip back to SRT.
- **AI captions** — Three paths: local Whisper through Transformers.js
  (WASM/WebGPU, first run downloads a small model), hosted OpenAI / Groq
  Whisper with a key stored only in `localStorage`, or Vietnamese speech
  recognition through the AI Voice Studio HF Space. The mixed project audio is
  transcribed, so clip volume, mutes and fades are respected.
- **Free local TTS (Piper, Vietnamese)** — Three Vietnamese Piper voices
  (VAIS 1000, 25hours single, VIVOS). Synthesis runs in the browser through
  `@diffusionstudio/vits-web` (download/cache), a bundled piper-phonemize WASM
  build and onnxruntime-web. Unlike the library's default `predict()` helper,
  ClipPro maps phoneme symbols through each voice's own `phoneme_id_map`, so
  Vietnamese tone ids work correctly. The voice model downloads once (about
  28–63 MB depending on quality) into OPFS; the phonemizer and ONNX runtime
  ship with the app, so later renders work offline. Generated WAVs become normal
  audio clips on a dedicated **Voiceover** track.
- **CapCut Vietnamese TTS (24 voices, optional)** — Every `vi-VN` voice in
  `K07VN/capcut-tts-api` is exposed: Nhỏ Ngọt Ngào, Giọng Nữ Phổ Thông, Hoai My,
  Nam Minh, the review/news voices and more. A browser cannot sign CapCut
  requests or read its CDN, so the Vite dev/preview server exposes a same-origin
  `/capcut` bridge that runs the MIT-licensed Python SDK. No separate helper
  process is needed. Audio is generated by CapCut's service; check CapCut's
  terms before publishing. A standalone CLI can also write MP3 files for import.
- **AI Voice Studio TTS (22 voices)** — The
  [`tony2k-ai-voice-studio`](https://huggingface.co/spaces/tony2k/ai-voice-studio)
  Space exposes every Vietnamese voice in its catalogue through `/api/tts` and
  `/api/stt`. ClipPro calls it directly from the browser: TTS returns a
  short-lived TikTok CDN URL, so the MP3 is downloaded immediately. Point the
  base URL at `http://127.0.0.1:8000` to use a local copy of the server. The
  same Space is available as an STT provider in the Captions tab.
- **Instant system voices** — The Web Speech API is used for zero-download
  Vietnamese auditions with voices installed by the operating system. Preview
  only; the Piper, CapCut and Studio engines are the export-safe paths.
  Non-Vietnamese voices are intentionally hidden.

### Audio

- **Recording** — Record narration directly onto the timeline (MediaRecorder).
- **Volume envelopes** — Per-clip volume control with keyframes and fade in/out.
- **Mute & speed** — Mute individual clips/tracks, change playback speed, and
  detach audio to its own track.
- **Mixdown** — Automatic mixdown of all track audio to the export format,
  including volume keyframes and fades.

### Templates & Presets

- **Layered title packs** — 6 original template projects that bundle text,
  stickers, and animation chains. Drop your media in and render.
- **Filter presets** — 66 named color/tonal adjustments (warm, cool, mono,
  vintage, noir, cinematic, music‑video, retro 70s/80s, polaroid, bleach‑bypass,
  teal‑orange, and more). Each preset includes a swatch preview.

### Export

- **WebM VP9/Opus** — Reliable QA path. Video + Opus audio. Supports 240p–4K.
- **MP4 H.264** — Video-only export. Audio unavailable in headless Chromium;
  use WebM for full audio+video.
- **Resolution/FPS/Quality** — Choose 360p, 480p, 720p, 1080p, or 4K. Frame
  rates from 24–60 fps. Quality levels: Standard / High / Ultra.
- **Auto‑download** — Export button triggers a download of the resulting `.webm`
  or `.mp4` file.
- **Abort** — Cancel an in‑progress export at any time.

### i18n

- **English** (default) and **Vietnamese** UI strings. Date/time formatting,
  number formatting, and direction support.

### PWA

- **Installable** — Add to home screen on mobile and desktop.
- **Offline support** — Service worker caches the app shell; the editor works
  after the first visit without network.
- **PWA icons** — 192×192, 512×512, and maskable 512×512 (SVG source stored
  in `public/icons/`; PNG generated at build time via `qa/make-icons.mjs`).

## Getting Started

### Prerequisites

- Node.js >= 20
- npm or pnpm

### Installation

```bash
# 1. Clone / download
git clone https://github.com/your-org/clippro.git
cd clippro

# 2. Install dependencies
npm install

# 3. Start the dev server
npm run dev
```

The editor opens at `http://127.0.0.1:5173/`.

### First Use

1. Click **New project** → enter a project name.
2. Import media: click the **Import** button (or drag files onto the library),
   or use the file picker. Supported: PNG, WebM, WAV, MP3, SRT, VTT.
3. Drag clips onto the timeline tracks.
4. Trim, split, add transitions, animations, effects, and text.
5. When ready, open the **Export** modal, choose format and settings, and
   download your video.

### Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Vite dev server at `http://127.0.0.1:5173/` |
| `npm run build` | Type‑check + Vite production build |
| `npm run lint` | Run oxlint (pre‑existing React Hook warnings only) |
| `npm run preview` | Preview the production build locally |
| `npm run tts:cli` | Generate CapCut Vietnamese MP3 files locally, no server (`-- --text ... --out ...`) |
| `npm run tts:voices` | List all 24 CapCut Vietnamese voices |
| `node qa/make-media.mjs` | Generate sample test media in `/tmp/opencode/` |
| `node qa/qa-edit.mjs` | End‑to‑end edit QA (import, split, undo/redo, text, stickers, library tabs, inspector tabs, help, shortcuts) |
| `node qa/qa-advanced.mjs` | Advanced QA (keyframes, masks, LUTs, markers, captions, four TTS engines) |
| `node qa/qa-export.mjs` | Export QA (WebM with audio, format selection, download) |
| `node qa/qa-play.mjs` | Playback QA (seek, play/pause clock, timeline interaction) |
| `node qa/qa-verify-export.mjs` | Verify exported WebM metadata (duration, resolution, readyState) |
| `node qa/qa-tts.mjs` | Real offline Piper synthesis smoke test |
| `node qa/qa-capcut-tts.mjs` | Real CapCut synthesis through the Vite `/capcut` bridge |
| `node qa/qa-studio-tts.mjs` | Real AI Voice Studio TTS/STT through the HF Space |
| `node qa/make-icons.mjs` | Generate PWA icons from SVG sources |

### Vietnamese TTS Setup

The Voice tab only lists Vietnamese voices. There are four engines:

1. **Piper · offline** — three Vietnamese Piper models. The selected model is
   downloaded once from Hugging Face (28–63 MB) and cached in the browser; the
   phonemizer and ONNX runtime ship with the app, so later renders work offline.
2. **CapCut · VN** — all 24 `vi-VN` voices from
   [`K07VN/capcut-tts-api`](https://github.com/K07VN/capcut-tts-api). The Vite
   dev/preview server exposes a same-origin `/capcut` bridge that runs the
   Python SDK, so there is **no separate server to start**:
   ```bash
   # one-time: install the Python package
   python3 -m pip install "git+https://github.com/K07VN/capcut-tts-api.git"

   # start the app as usual; /capcut is handled by Vite
   npm run dev
   ```
   Then open **Voice → CapCut · VN → Test**. Audio is generated by CapCut's
   service, so review CapCut's terms before publishing. The same-origin bridge
   also works behind Cloud Shell/Codespaces tunnels, where `127.0.0.1` would
   point at the viewer's machine and HTTPS pages cannot call HTTP helpers. If
   Vite cannot find Python, start it with
   `CAPCUT_PYTHON=/path/to/python npm run dev`.

   Prefer a pure file workflow with no bridge at all?
   ```bash
   npm run tts:voices
   npm run tts:cli -- --text "Xin chào Việt Nam" \
     --voice BV421_vivn_streaming --out voice.mp3
   ```
   Then drag `voice.mp3` into the media library. `--text-file script.txt`
   generates one `Voice 01.mp3`, `Voice 02.mp3`… per blank-line paragraph.

3. **Studio · AI Voice Studio** — all 22 `vi-VN` voices from the
   [`tony2k-ai-voice-studio`](https://huggingface.co/spaces/tony2k/ai-voice-studio)
   HF Space. No install or key is required:
   ```bash
   npm run dev
   ```
   Open **Voice → Studio → Test**, then pick a voice. The base URL defaults to
   the public Space; set it to `http://127.0.0.1:8000` when running the Studio
   server locally. The Space may sleep when idle, so the first request can take
   a few seconds. TTS returns a signed CDN link that expires quickly; ClipPro
   downloads the MP3 immediately. Audio generation is performed by CapCut's
   service through the Space, so review its terms before publishing.

4. **System** — Vietnamese voices installed in your OS via the Web Speech API.
   Instant preview only; not reliably captured for export.

Generated audio becomes a normal clip on a dedicated **Voiceover** track.

### PWA — Install the App

After visiting the site once, the service worker (`/sw.js`) caches the app shell.
On subsequent visits, or when offline, the app loads from cache. To install:

- **Chrome/Edge**: Click the "Install ClipPro" button in the address bar, or
  use `chrome://apps` / `edge://apps`.
- **Firefox**: Use the "Install ClipPro" menu or `about:addons`.
- **Safari**: Use "Add to Dock" or the Share menu.

## Architecture

### Tech Stack

| Layer | Technology |
|-------|------------|
| **Build** | Vite 8, TypeScript 7, oxlint |
| **UI** | React 19, Zustand, lucide-react |
| **Styling** | Custom CSS (dark design system, ~4,000 lines) |
| **State** | Zustand (project, UI, history) |
| **Media** | Canvas 2D renderer, WebCodecs (MP4 muxer + WebM muxer) |
| **Persistence** | IndexedDB (via `src/lib/db.ts`) |
| **Export** | `mp4-muxer` (H.264/AAC — video only in headless), `webm-muxer` |
| **Icons** | lucide-react (adapted), original SVG assets |
| **Fonts** | Google Fonts via `@fontsource`: Inter, Space Grotesk, Bebas Neue, |
| | Playfair Display, Pacifico, Oswald |
| **QA** | Playwright with Chromium |

### Data Flow

1. **Import** → Files read via `File/URL` API → Assets stored as blobs in
   IndexedDB → UI library cards update.
2. **Timeline** → Clips arranged in tracks (video, audio, text, sticker).
   Playhead position driven by `requestAnimationFrame` clock, throttled ~30fps.
3. **Preview** → Canvas 2D renderer draws each frame from the current playhead
   position, applying transforms, keyframes, effects, transitions.
4. **Export** → `WebCodecs` readback from the preview canvas → muxer encodes
   WebM (VP9/Opus) or MP4 (H.264/video‑only).
5. **Undo/Redo** → Project snapshots stored in IndexedDB; `history` array with
   `max: 50` entries (oldest auto‑pruned).

### Rendering Pipeline

- **Canvas2D** — Primary renderer for preview and export consistency.
- **Transform pipeline** — `fit` (contain/cover/stretch) → `transform`
  (translation, rotation, scaleX, scaleY, flipH, flipV) → animation
  interpolation (from declarative `ANIMATION_SPECS`) → effect op execution
  (from declarative `EFFECT_SPECS`) → transition overlay (from declarative
  `TRANSITION_SPECS`).
- **Time interpolation** — `easeOutCubic` default; per‑animation `ease`
  (`back`, `quint`, `bounce`, `elastic`, `linear`) from `ANIMATION_SPECS`.
- **Effects** — Each effect is a list of **ops** (operations): tint, gradient,
  vignette, grain, scanlines, leak, soften, bloom, glitch, mirror, pixelate,
  pattern, particles, flare, rays, channels, zoomblur, frame, letterbox,
  spotlight. Intensity scales every op at render time (`k = intensity/100`).

### State Management (Zustand)

- **`editor` store** (`src/store/editor.ts`): project, selected clip, clips/
  tracks arrays, history (undo/redo), save/load, `mutate` (clones project for
  immutable updates), `updateClip` (merge keys: group drag history), `endGesture`
  on pointerup.
- **`ui` store** (`src/store/ui.ts`): inspector tab, library tab, toast messages,
  visibility change handler, pagehide flush.
- **`mutate`** — Deep clones project before applying changes; assets are
  non‑undoable (stored as blobs, not in history).

### Export Pipeline

1. **Detection** — On first export, detects whether the browser supports MP4
   H.264+AAC or only WebM VP9/Opus. Headless Chromium: video works, audio
   falls back to WebM.
2. **Canvas readback** — `renderProject(playhead)` draws the full timeline to an
   off‑screen Canvas2D.
3. **Blob generation** — `HTMLCanvasElement.toDataURL('image/webm')` →
   `webm-muxer` muxes video frames + Opus audio into a `.webm` file.
4. **MP4 path** — `mp4-muxer` encodes H.264 video frames; audio is omitted
   (headless limitation), a warning is shown.
5. **Progress** — Export modal shows estimated size, progress bar, and abort
   button. On completion, the download link appears automatically.

## Feature Checklist

| Category | Items | Status |
|----------|-------|--------|
| **Core Editing** | Multi-track magnetic timeline, trim, split, detach audio, speed control, undo/redo, autosave, markers | ✅ Complete |
| **Keyframes** | Position, scale, rotation, opacity, volume and mask keyframes with five easing modes and timeline diamonds | ✅ Complete |
| **Masks** | Rectangle, ellipse, triangle, diamond, star, heart, line and pen masks with feather, invert, opacity and preview handles | ✅ Complete |
| **Color** | 66 filters, three-way wheels, hue/vibrance, temperature, tint, exposure, vignette, `.cube` LUT import/intensity | ✅ Complete |
| **Animations** | 40+ animation presets (fade, slide, pop, zoom, bounce, elastic, spin, typewriter, glitch, shake, drift, float, unfold, roll, pulse, zoom-pulse, and more) | ✅ Complete |
| **Transitions** | 44 transition presets plus content-aware suggestions (fade/dissolve/slide/whip) | ✅ Complete |
| **Effects** | 70+ effect presets (vignette, grain, light-leak, scanlines, glitch, shake, bloom, warm-glow, cool-mist, teal-orange, sepia, noir, dream, vhs, crt, old-film, projector, neon, cyberpunk, infrared, thermal, night-vision, bleach, matte, pastel, candy, sunset, ocean, forest, lavender, rose, amber, arctic, ember, chrome, duotone, monochrome, halftone, dot-screen, grid, crosshatch, stripes, noise, paper, watercolor, sketch, emboss, edge-glow, chromatic, mirror, kaleido, pixelate, mosaic, zoom-blur, echo, snow, rain, sparkle, bokeh, confetti, embers, lens-flare, sun-rays, spotlight, letterbox, film-frame, polaroid, film-strip, soft-focus, lomo) | ✅ Complete |
| **Filters** | 66 filter presets (warm, cool, mono, vintage, vivid, film, faded, noir, sunrise, sunset, dusk, dawn, golden-hour, blue-hour, tropical, desert, forest, ocean, lavender, rose, peach, mint, lemon, cherry, berry, cocoa, sand, slate, steel, copper, emerald, sapphire, amethyst, ruby, amber, warm-matte, cool-matte, high-key, low-key, dramatic, dreamy, crisp, soft, sepia-tone, mono-warm, infrared, neon-pop, pastel, grunge, vhs, lomo, faded-print, and more) | ✅ Complete |
| **Text & Captions** | Text layers, six Google Fonts, SRT/VTT import/export, local Whisper, OpenAI/Groq or AI Voice Studio captions | ✅ Complete |
| **Voice / TTS** | Vietnamese only: 24 CapCut VN voices via the Vite `/capcut` bridge, 22 AI Voice Studio voices, 3 offline Piper VN voices, system preview; generated clips land on a Voiceover track | ✅ Complete |
| **Audio** | Recording (MediaRecorder), volume keyframes, fades, mute, speed, mixdown | ✅ Complete |
| **Templates** | 6 original layered title packs | ✅ Complete |
| **PWA** | Installable, offline, icons (192/512/maskable), service worker | ✅ Complete |
| **i18n** | English + Vietnamese UI strings | ✅ Complete |
| **QA** | Playwright verified: import, split/undo/redo, text/sticker add, library tabs, inspector tabs, help/shortcuts, WebM export | ✅ Complete |
| **Build** | `npm run build` passes, no TS errors | ✅ Complete |
| **Lint** | Pre-existing React Hook warnings only | ✅ Complete |

### Pending / Roadmap

- **Beat detection** — Optional BPM analysis for auto-cutting to music.
- **Proxy media** — Generate lower-resolution proxies for 4K projects.
- **Cloud project sync** — Optional, user-hosted backend (the editor remains
  local-first).
- **CapCut catalogue sync** — The Vite bridge already serves the live `vi-VN`
  list at `GET /capcut/voices`; the UI can use it to refresh the bundled
  catalogue when CapCut adds or retires voices.
- **Match-cut transitions** — Extend content-aware analysis with subject/colour
  matching for match cuts.

## Licensing

- **Software**: MIT (see `LICENSE` for full text). Portions of the codebase use
  `oxlint` (MIT licensed) and `Playwright` (Apache 2.0).
- **Fonts**: All bundled via `@fontsource` — each font is under its own open
  source license (see each `@fontsource/*` package). All are permissive:
  Inter, Space Grotesk, Bebas Neue, Playfair Display, Pacifico, Oswald are
  all Apache 2.0 or SIL OFL.
- **TTS**: `@diffusionstudio/vits-web` (MIT), `@diffusionstudio/piper-wasm`
  (MIT), Piper (MIT), onnxruntime-web (MIT) and the open Piper voice models.
  The phonemizer WASM/data and the ONNX runtime WASM are bundled with the app
  (`public/ort/ort-wasm-simd.wasm`); voice models are downloaded at runtime from
  the public `diffusionstudio/piper-voices` Hugging Face repository and cached
  in the browser, so they are not redistributed with this repository.
- **CapCut TTS bridge**: the optional `/capcut` route runs
  `K07VN/capcut-tts-api`, which is MIT licensed (declared in its
  `pyproject.toml`), through `tools/capcut_tts_cli.py`. The package is installed
  by the user; it is not vendored or bundled. Audio generation is performed by
  CapCut's service and may be subject to CapCut's terms. The 24 Vietnamese voice
  records mirror that package's `Voice.json` catalogue.
- **AI Voice Studio**: optional, opt-in client for the public
  [`tony2k-ai-voice-studio`](https://huggingface.co/spaces/tony2k/ai-voice-studio)
  HF Space. ClipPro does not bundle its voices or media. Requests go directly to
  the base URL configured in the app (the public Space by default, or a local
  server); audio generation and transcription are performed by that service.
- **AI captions**: Transformers.js (Apache-2.0) and Whisper (MIT/Apache-2.0).
  Hosted OpenAI/Groq transcription is optional and uses the user's own key.
- **SVG stickers**: 24 original stickers, CC0 / public domain.
- **Sample media**: Synthesized (generated PNGs, synthesized WAV). Free for
  personal and commercial use.
- **Exported video**: You own the output. ClipPro imposes no attribution.
- **Not used**: CapCut/ByteDance media assets. ClipPro does not bundle CapCut
  voices or call its endpoints from the browser; the opt-in local bridge is the
  only integration path. AI Voice Studio is an optional hosted integration and
  can be pointed at a local server.

## Browser Support & Limits

| Browser | Support |
|---------|---------|
| **Chrome 120+** | Full support: Canvas2D rendering, WebCodecs, WebM export, IndexedDB, Service Worker, PWA |
| **Edge 120+** | Full support (Chrome-based) |
| **Firefox 120+** | Full support: Canvas2D, IndexedDB, Service Worker. WebM export works; MP4 H.264 video‑only (no AAC) due to Firefox codec stacking. |
| **Safari 17+** | Canvas2D + IndexedDB support. WebM export via MediaRecorder (VP8/Opus). No WebCodecs, so export is browser‑recorded rather than canvas‑readback. |
| **Headless Chromium** | Video export works (MP4 H.264 video‑only, WebM VP9/Opus). Audio in MP4 unavailable; use WebM for full audio+video. |

### Known Limits

- **MP4 H.264 + AAC**: Not supported in headless Chromium (audio track missing). Use WebM VP9/Opus for audio+video export.
- **Maximum track count**: Limited by IndexedDB performance and canvas redraw time; practical limit ~20‑30 clips per project.
- **Maximum clip duration**: Bounded by canvas redraw performance; 60‑second clips are smooth; longer projects work but redraw may slow.
- **File size for import**: No hard limit; browser `File` API and IndexedDB handle large files, but very large assets (1080p/4K video) may cause memory pressure. Use lower‑resolution proxies for best performance.
- **Undo history**: Capped at 50 snapshots (configurable in `src/store/editor.ts`). Older snapshots are auto‑pruned to keep memory usage bounded.

## Directory Overview

```
src/
├── App.tsx              # Home/Editor switch, title sync, Toasts and all modals
├── index.css            # Dark design system (~4,000 lines)
├── lib/
│   ├── types.ts         # Domain model: Clip, Project, Transition, Animation, Effect, FilterPreset
│   ├── constants.ts     # Presets: 66 filters, 44 transitions, 40 animations, 70 effects
│   ├── animations.ts    # ANIMATION_SPECS declarative map
│   ├── transitions.ts   # TRANSITION_SPECS declarative map
│   ├── effects.ts       # EFFECT_SPECS op-based map
│   ├── render.ts        # Canvas2D renderer with transforms/keyframes/masks/color/effects
│   ├── media.ts         # Asset loading, createAssetFromFile, getAssetType
│   ├── project.ts       # Project helpers, keyframes, markers, normalizeProject
│   ├── lut.ts           # .cube parser, built-in LUTs, pixel application
│   ├── whisper.ts       # Local Transformers.js Whisper + OpenAI/Groq/Studio transcription
│   ├── tts.ts           # Vietnamese TTS settings, Piper synthesis + system preview
│   ├── capcutTts.ts     # 24 CapCut Vietnamese voices + /capcut bridge client
│   ├── studio.ts        # AI Voice Studio TTS/STT client + 22 Vietnamese voices
│   ├── piper.ts         # Per-voice phoneme mapping + onnxruntime inference
│   ├── contentAware.ts  # Frame analysis for automatic transition choices
│   ├── captions.ts      # SRT/VTT parsing and serialisation
│   ├── audio.ts         # Mixdown, WAV encoding, volume keyframes
│   └── utils.ts         # clamp, formatTime, formatDuration, formatBytes, hexToRgba, easeOut*
├── components/
│   ├── ui.tsx           # Primitives: IconButton, Slider, Toggle, Segmented, ColorField, Section, Modal, SearchInput, Kbd, EmptyLibrary, ToggleRow
│   ├── editor/
│   │   ├── TopBar.tsx
│   │   ├── Preview.tsx
│   │   ├── Timeline.tsx
│   │   ├── Inspector.tsx
│   │   ├── ExportModal.tsx
│   │   ├── HelpModals.tsx
│   │   └── SettingsModal.tsx
│   └── library/
│       ├── LibraryPanel.tsx
│       ├── common.tsx
│       ├── MediaTab.tsx
│       ├── AudioTab.tsx
│       ├── VoiceTab.tsx
│       ├── TextTab.tsx
│       ├── StickersTab.tsx
│       ├── EffectsTab.tsx
│       ├── TransitionsTab.tsx
│       ├── FiltersTab.tsx
│       ├── CaptionsTab.tsx
│       └── TemplatesTab.tsx
├── hooks/
│   └── useMediaImport.ts # Import tab selection logic
├── store/
│   ├── editor.ts        # Zustand editor store
│   └── ui.ts            # Zustand UI store
├── main.tsx             # Service worker registration (production only)
└── qa/                  # Playwright QA scripts

tools/
├── capcutTtsPlugin.ts   # Vite /capcut middleware (runs the Python SDK)
└── capcut_tts_cli.py    # Standalone CLI: text -> MP3, no server

public/
├── manifest.webmanifest # PWA manifest
├── sw.js                # Service worker
├── icons/
│   ├── icon-source.svg
│   ├── icon-maskable-source.svg
│   ├── icon-192.png
│   ├── icon-512.png
│   └── icon-maskable-512.png
├── stickers/            # 24 original SVG stickers
├── icons.svg            # Spritesheet (lucide-react source)
└── favicon.svg          # Browser favicon
```

## .env.example

```
# ClipPro environment variables
# No server-side env vars are required. Editing, Piper TTS and export run in
# the browser. The optional CapCut bridge is served by Vite at /capcut. AI keys
# (OpenAI/Groq) are entered in the app and stored only in localStorage —
# never in a build-time env file.

# Optional: base URL if you add your own proxy/backend for hosted AI providers
# VITE_API_BASE_URL="https://api.example.com"

# Optional: override the CapCut bridge URL. The default is "/capcut" (Vite
# middleware). Set a full URL only if you host the bridge elsewhere.
# VITE_CAPCUT_TTS_PROXY="/capcut"

# Optional: AI Voice Studio base URL. Defaults to the public HF Space. Use
# http://127.0.0.1:8000 when running the Studio server locally.
# VITE_STUDIO_API_BASE="https://tony2k-ai-voice-studio.hf.space"

# Optional: feature flags / dev logging
# VITE_ENABLE_TTS="true"
# VITE_DEBUG_MODE="false"
```

## Development Checklist — Completed Items

- ✅ Scaffolded Vite React‑TS app with TypeScript strict mode
- ✅ Installed dependencies (React 19, Zustand, lucide-react, mp4-muxer, webm-muxer)
- ✅ Core domain model (`src/lib/types.ts`), utils, project helpers, constants/presets
- ✅ 24 original SVG stickers in `public/stickers/`, favicon/logo
- ✅ IndexedDB persistence (`src/lib/db.ts`) and media pipeline (`src/lib/media.ts`)
- ✅ Canvas renderer with transforms/fit/text/filters/adjustments/animations/transitions/effects (`src/lib/render.ts`)
- ✅ Offline audio mixing/WAV encoder (`src/lib/audio.ts`), export pipeline/capability detection (`src/lib/export.ts`)
- ✅ SRT/VTT caption parser plus `formatSrtTimestamp`, `toSrt`, `rulesFromCues` (`src/lib/captions.ts`)
- ✅ Editor Zustand store with clips/tracks/trim/split/drag/speed/detach/transitions/effects/history/save (`src/store/editor.ts`), UI store (`src/store/ui.ts`)
- ✅ `useMediaImport`, `useShortcuts`, `useRecorder`
- ✅ Full ClipPro dark design system (`src/index.css`, ~4,000 lines) including import overlay styles
- ✅ UI primitives (`src/components/ui.tsx`): IconButton, Slider, Toggle, Segmented, ColorField, Section, Modal, SearchInput, Kbd, EmptyLibrary, ToggleRow
- ✅ Home screen (`src/components/Home.tsx`), `Waveform.tsx`, Logo, library tabs (`common.tsx`, `LibraryPanel.tsx`, `MediaTab.tsx`, `AudioTab.tsx`, `TextTab.tsx`, `StickersTab.tsx`, `EffectsTab.tsx`, `TransitionsTab`, `FiltersTab`), `CaptionsTab.tsx`, `TemplatesTab.tsx`
- ✅ `src/lib/thumbnail.ts` preview canvas registry + JPEG thumbnail helpers
- ✅ `src/components/editor/Toasts.tsx`, `TopBar.tsx`, `Preview.tsx`, `Inspector.tsx`, `Timeline.tsx`
- ✅ `src/components/editor/ExportModal.tsx`: format detection, resolution/fps/quality/audio controls, progress, abort, auto-download, done state, `exportOpen` guard
- ✅ `src/components/editor/HelpModals.tsx`: HelpModal + ShortcutsModal with 30 shortcut rows; duplicate React key fixed using row/key indexes
- ✅ `src/components/editor/SettingsModal.tsx`: project canvas/fps/background, preview prefs, storage estimate/persistence, clear-all-data confirm
- ✅ `src/components/editor/EditorShell.tsx`: TopBar + LibraryPanel/Preview/Inspector + Timeline, debounced autosave (1400ms), pagehide/visibility flush, import overlay
- ✅ `src/App.tsx` Home/Editor switch, title sync, Toasts and all modals; `index.html` updated with ClipPro title/meta/manifest reference
- ✅ Fixed `useMediaImport` tab selection: switches to `audio` only when every imported asset is audio; otherwise `media`
- ✅ Expanded presets to meet spec counts: 66 filters, 70 effects, 44 transitions, 40 animations
- ✅ Added `src/lib/animations.ts`, `src/lib/transitions.ts`, `src/lib/effects.ts` with declarative spec maps
- ✅ Renderer now supports expanded animation specs (fade/slide/zoom/spin/flip/blur/bounce/elastic/etc.), transition families (dip, slide, zoom, wipe, iris, clock, blinds, checker, split, diamond, glitch, light, roll, mosaic, whip), and op‑based effects (grades, patterns, particles, pixelate, channels, frames, flares, rays, spotlight, letterbox, etc.)
- ✅ Inspector animation/transition chips now use full `ANIMATIONS` and `TRANSITIONS` lists
- ✅ EffectsTab uses group‑based icons and per‑preset swatches; transitions use group‑based arrows
- ✅ Legacy `type: 'zoom'` animation IDs replaced with `'zoom-in'` in sample/templates
- ✅ `npm run build` passes; `npm run lint` only pre‑existing warnings
- ✅ Playwright QA verified: Home, sample project load, canvas rendering, selection, playback clock, library tabs, inspector tabs, text/sticker add, split/undo/redo, help/shortcuts, import (PNG/WebM/WAV), and WebM export
- ✅ Export QA produced valid `/tmp/opencode/export-result.webm`: 854×480, 6.0s, readyState 4, audio included, 383,909 bytes
- ✅ Created `public/manifest.webmanifest` with ClipPro name/tagline/theme/icons
- ✅ Created `public/sw.js` with offline‑first caching strategy
- ✅ Generated PWA icons (192×192, 512×512, maskable 512×512) from SVG sources
- ✅ Updated `src/main.tsx` to register service worker for production only
- ✅ First-class keyframes (`BaseClip.keyframes`) with timeline diamonds and easing; project migration keeps old projects working
- ✅ Mask panel and preview handles (shapes, pen, feather, invert, opacity) with offscreen-canvas compositing
- ✅ Three-way color wheels, hue/vibrance, `.cube` LUT parser/import/intensity, and `cloneAdjustments()` safety
- ✅ Marker lane with add/drag/rename/delete, snap points and `M` shortcut
- ✅ Local Transformers.js Whisper + OpenAI/Groq transcription with progress and SRT review
- ✅ Vietnamese-only TTS: 3 offline Piper VN voices, 24 CapCut VN voices via the Vite `/capcut` bridge (plus a no-server CLI), 22 AI Voice Studio voices, system Vietnamese preview; generated clips land on a Voiceover track
- ✅ Vietnamese STT: local Whisper, OpenAI/Groq, or the AI Voice Studio `/api/stt` provider
- ✅ Content-aware transition analysis and one-click auto transitions
- ✅ Destructive edits: ripple delete, close gaps, merge with next, delete range
- ✅ `npm run build` and `npm run lint` pass; QA scripts cover edit, playback, advanced features, export, export verification, real Piper synthesis, real CapCut synthesis and real AI Voice Studio TTS/STT

## Next Steps (Optional)

- Sync the live CapCut Vietnamese catalogue from the bridge's `GET /capcut/voices`
- Add BPM/beat detection for music-driven auto cuts
- Add proxy media generation for 4K projects
- Add match-cut analysis (subject/colour matching) on top of the current content-aware transitions
- Add keyboard shortcut customization
- Add optional user-hosted project sync while keeping local-first storage
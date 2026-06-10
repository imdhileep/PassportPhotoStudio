# Passport Photo Studio

Production-grade, offline-capable passport photo editor with AI background removal, face alignment, and export tooling for US, India, and additional template presets.

## Features
- Camera capture + upload preview (always visible).
- Background removal via BiRefNet (RMBG-1.4) running in a Web Worker on WebGPU, with an automatic
  WASM/CPU fallback and a MediaPipe selfie-segmenter fallback if the primary model is unavailable.
- Face landmark alignment + auto-crop with warnings (tilt, size, framing).
- Manual crop adjust (drag/zoom) and edge refinement controls.
- Auto edge tuning: adaptive halo trim, matte tighten, feather, refine strength, edge intensity.
- Export: PNG/JPG and 4x6 print sheet.
- Offline-ready models and wasm (local-only in offline mode).
- Optional local server for JPG conversion + export history + share links.
- Template catalog + rule metadata seed (10 country/document templates).
- Basic order creation API from landing upload flow.

## Repo layout
```
/apps/web            # React + Vite client
/apps/server         # Optional Express server (feature-flagged)
/packages/ai         # MediaPipe wrapper + crop logic
/scripts             # Offline download scripts
/.env.example
/README.md
```

## Quick start
1) Install dependencies (web + AI package only — the optional native server is installed separately):
```bash
npm install
```

2) (Recommended) Download the wasm + models for same-origin/offline use. This also fetches the
   primary background-removal model (RMBG-1.4, ~44MB) into `apps/web/public/models` so the app does
   not depend on a runtime download from HuggingFace:
```bash
npm run offline:setup
```
If you skip this, the app still works: the model is loaded from the HuggingFace Hub at runtime and
cached by the browser.

3) Start the web app:
```bash
npm run dev
```

The app runs at `http://localhost:5190`.

> **Deploying (Vercel):** for a fully self-hosted/offline production build, run `npm run offline:setup`
> as part of the build (or commit `apps/web/public/models/briaai/`) so the model ships same-origin.

> **Node version:** the web app builds on Node 20–26. The optional server uses native modules
> (`better-sqlite3`, `sharp`); install it separately with `npm run server:install`.

## Offline setup (manual)
Windows PowerShell:
```powershell
./scripts/offline-setup.ps1
```

macOS/Linux:
```bash
./scripts/offline-setup.sh
```

Offline files are stored in:
- `apps/web/public/wasm`
- `apps/web/public/models`

## Optional server mode
The optional server converts exports to JPG, stores history (SQLite), creates share links, serves template rules, and accepts basic order creation. It is intentionally excluded from the root install so its native dependencies never block the web app.

1) Install and start the server:
```bash
npm run server:install
npm run server:dev
```

2) Enable the client feature flag (create `.env` from `.env.example`):
```
VITE_SERVER_ENABLED=true
VITE_SERVER_URL=http://localhost:4310
```

3) Restart the web dev server.

### Server endpoints
- `GET /health`
- `GET /api/templates?country=&q=&documentType=`
- `GET /api/templates/:id`
- `POST /api/orders` (multipart: `file`, `templateId`, optional `guestEmail`)
- `POST /api/orders/:id/process`
- `GET /api/orders/:id/download?format=jpg|png|pdf`
- `GET /api/orders/:id`
- `GET /api/me/orders?guestEmail=`
- `POST /api/addons/human-verification`
- `POST /api/addons/clothing-adjustment`
- `POST /api/checkout/priority` (mock payment)
- `POST /api/subscriptions/checkout` (mock subscription)
- `POST /api/support/tickets` (optional multipart `attachment`)
- `POST /exports` (multipart `file`, query `quality`)
- `GET /exports`
- `POST /share/:id`
- `GET /share/:token`
- `GET /gallery`

### Seeded templates (initial 10)
- US Passport 2x2 in
- US Visa 2x2 in
- US DV Lottery 600x600
- India Passport 35x45 mm
- UK Passport 35x45 mm
- Canada Passport 50x70 mm
- Schengen Visa 35x45 mm
- Australia Passport 35x45 mm
- Singapore Passport 35x45 mm
- UAE Visa 43x55 mm

## Scripts
- `npm run dev` - start Vite dev server
- `npm run build` - typecheck (`tsc --noEmit`) then production build
- `npm run typecheck` - TypeScript typecheck only
- `npm run lint` - ESLint over `apps/web/src`
- `npm run preview` - preview production build
- `npm run offline:setup` - download wasm + models (incl. the RMBG-1.4 primary model) for same-origin/offline use
- `npm run server:install` - install the optional server's dependencies
- `npm run server:dev` - start the optional server
- `npm --workspace packages/ai run test` - run AI matte + edge-quality tests

## Configuration
Client config uses environment variables:
- `VITE_MODEL_BASE_PATH` (default `/models`)
- `VITE_WASM_BASE_PATH` (default `/wasm`)
- `VITE_SERVER_ENABLED` (default `false`)
- `VITE_SERVER_URL` (default `http://localhost:4310`)

Server queue controls:
- `FREE_DAILY_DIRECT_QUOTA` (default `1`)
- `FREE_QUEUE_DELAY_SECONDS` (default `180`)
- `QUEUE_WORKER_INTERVAL_MS` (default `3000`)

## Notes
- Camera access requires HTTPS or localhost.
- For best results, use even front lighting and a plain background.
- Compliance disclaimer: template policies can allow crop/resize/background replacement, but facial retouching is disabled.

## Edge Auto-Tune + Matte Pipeline
The editor now computes image-specific edge settings on upload/capture and applies a multi-stage matte refinement pipeline.

Metrics used for tuning:
- `haloScore`: bright fringe risk near boundary (inside/outside edge band).
- `spillScore`: background color bleed into subject near boundary.
- `jaggyScore`: high-frequency boundary roughness.
- `hairEdgeDensity`: fine edge texture density near upper head boundary.
- `contrastScore`: local contrast across boundary.
- `maskConfidence`: confidence near edge band (confidence mask or inferred alpha smoothness).

Auto-tuned controls:
- `haloTrim` (0..40)
- `matteTighten` (0..100)
- `feather` (0..20)
- `refineStrength` (0..100)
- `edgeIntensity` (0..100)
- `edgeRefineToggle` (boolean)

Refinement order:
1. close holes
2. remove islands/noise
3. stabilize soft alpha (closing/opening + soft blend)
4. edge-aware erosion (`haloTrim`)
5. edge-aware alpha contrast (`matteTighten`)
6. guided refinement (`refineStrength`)
7. adaptive feathering (`feather`, capped to subtle 1-2px behavior for passport edges)
8. clamp alpha [0..1]

Post-processing:
- `removeEdgeHalo(...)`: boundary color decontamination for hair/beard/shoulders.
- `compositeOnWhiteBackground(...)`: composites against pure white without dirty blend carry-over.
- `validateBackgroundWhite(...)`: enforces exact white background for low-alpha/background pixels and validates borders.

## AI Passport Requirement Checker (Default)
Every processed preview now runs an automatic passport check and shows results in the right panel under **Key Photo Requirements**.

Checks included:
- Dimensions (US 2x2 requirement check)
- Background uniformity (plain white/off-white)
- Head size estimate (top hair to chin, 25-35 mm target)
- Expression (eyes open, mouth closed)
- Appearance heuristics (possible eyeglasses)
- Quality (resolution, sharpness, shadow balance, filter usage)
- Print material reminder (manual check)

Notes:
- This is guidance, not legal acceptance guarantee.
- Religious head covering exceptions and print-paper verification require manual confirmation.

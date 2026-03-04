# Passport Photo Studio

Production-grade, offline-capable passport photo editor with AI background removal, face alignment, and export tooling for US, India, and additional template presets.

## Features
- Camera capture + upload preview (always visible).
- Background removal via MediaPipe ImageSegmenter with GPU-to-CPU fallback.
- Face landmark alignment + auto-crop with warnings (tilt, size, framing).
- Manual crop adjust (drag/zoom) and edge refinement controls.
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
1) Install dependencies:
```bash
npm install
```

2) (Optional) Download models + wasm for offline use:
```bash
npm run offline:setup
```

3) Start the web app:
```bash
npm run dev
```

The app runs at `http://localhost:5190`.

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
The optional server converts exports to JPG, stores history (SQLite), creates share links, serves template rules, and accepts basic order creation.

1) Start the server:
```bash
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
- `npm run build` - production build
- `npm run preview` - preview production build
- `npm run offline:setup` - download offline wasm/models
- `npm --workspace apps/server run test` - run server unit tests

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

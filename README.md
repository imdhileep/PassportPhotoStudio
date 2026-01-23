# Passport Photo Studio

Production-grade, offline-capable passport photo editor with AI background removal, face alignment, and export tooling for US and India standards.

## Features
- Camera capture + upload preview (always visible).
- Background removal via MediaPipe ImageSegmenter with GPU→CPU fallback.
- Face landmark alignment + auto-crop with warnings (tilt, size, framing).
- Manual crop adjust (drag/zoom) and edge refinement controls.
- Export: PNG/JPG and 4x6 print sheet.
- Offline-ready models and wasm (local-only in offline mode).
- Optional local server for JPG conversion + export history + share links.

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

The app runs at `http://localhost:5173`.

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

## Optional server mode (bonus)
The optional server converts exports to JPG, stores history (SQLite), and creates share links.

1) Start the server:
```bash
npm run server:dev
```

2) Enable the client feature flag (create `.env` from `.env.example`):
```
VITE_SERVER_ENABLED=true
VITE_SERVER_URL=http://localhost:4310
```

3) Restart the dev server.

Server endpoints:
- `POST /exports` (multipart `file`, query `quality`)
- `GET /exports`
- `POST /share/:id`
- `GET /share/:token`
- `GET /gallery`

## Scripts
- `npm run dev` - start Vite dev server
- `npm run build` - production build
- `npm run preview` - preview production build
- `npm run offline:setup` - download offline wasm/models

## Configuration
Client config uses environment variables:
- `VITE_MODEL_BASE_PATH` (default `/models`)
- `VITE_WASM_BASE_PATH` (default `/wasm`)
- `VITE_SERVER_ENABLED` (default `false`)
- `VITE_SERVER_URL` (default `http://localhost:4310`)

## Notes
- Camera access requires HTTPS or localhost.
- For best results, use even front lighting and a plain background.

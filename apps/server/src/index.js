import express from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import fs from "fs";
import { nanoid } from "nanoid";
import Database from "better-sqlite3";
import sharp from "sharp";

const app = express();
const port = Number(process.env.PORT || 4310);
const repoRoot = path.resolve(process.cwd(), "..", "..");
const dataDir = path.join(repoRoot, "data");
const exportDir = path.join(dataDir, "exports");
const dbPath = path.join(dataDir, "exports.db");

fs.mkdirSync(exportDir, { recursive: true });
const db = new Database(dbPath);
db.exec(
  "CREATE TABLE IF NOT EXISTS exports (id TEXT PRIMARY KEY, filename TEXT, created_at TEXT)"
);
db.exec(
  "CREATE TABLE IF NOT EXISTS shares (token TEXT PRIMARY KEY, export_id TEXT, created_at TEXT)"
);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use("/exports", express.static(exportDir));

app.post("/exports", upload.single("file"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "Missing file" });
    return;
  }
  const quality = Number(req.query.quality || 92);
  const id = nanoid(10);
  const filename = `${id}.jpg`;
  const outPath = path.join(exportDir, filename);
  try {
    await sharp(req.file.buffer).jpeg({ quality }).toFile(outPath);
    db.prepare("INSERT INTO exports (id, filename, created_at) VALUES (?, ?, datetime('now'))").run(
      id,
      filename
    );
    res.json({ id, url: `/exports/${filename}` });
  } catch (error) {
    console.error("Export conversion failed", error);
    res.status(500).json({ error: "Conversion failed" });
  }
});

app.get("/exports", (_req, res) => {
  const rows = db
    .prepare("SELECT id, filename, created_at FROM exports ORDER BY created_at DESC LIMIT 50")
    .all();
  res.json(rows);
});

app.post("/share/:id", (req, res) => {
  const { id } = req.params;
  const exportRow = db.prepare("SELECT id FROM exports WHERE id = ?").get(id);
  if (!exportRow) {
    res.status(404).json({ error: "Export not found" });
    return;
  }
  const token = nanoid(12);
  db.prepare("INSERT INTO shares (token, export_id, created_at) VALUES (?, ?, datetime('now'))").run(
    token,
    id
  );
  res.json({ token, shareUrl: `/share/${token}` });
});

app.get("/share/:token", (req, res) => {
  const row = db
    .prepare(
      "SELECT exports.filename FROM shares JOIN exports ON shares.export_id = exports.id WHERE shares.token = ?"
    )
    .get(req.params.token);
  if (!row) {
    res.status(404).send("Share not found");
    return;
  }
  res.redirect(`/exports/${row.filename}`);
});

app.get("/gallery", (_req, res) => {
  const rows = db
    .prepare("SELECT filename, created_at FROM exports ORDER BY created_at DESC LIMIT 50")
    .all();
  const images = rows
    .map(
      (row) =>
        `<figure style=\"margin:16px\"><img src=\"/exports/${row.filename}\" style=\"width:160px\" /><figcaption>${row.created_at}</figcaption></figure>`
    )
    .join("");
  res.send(`<!doctype html><html><body><h2>Export Gallery</h2><div style=\"display:flex;flex-wrap:wrap\">${images}</div></body></html>`);
});

app.listen(port, () => {
  console.log(`Passport Photo Studio server listening on http://localhost:${port}`);
});

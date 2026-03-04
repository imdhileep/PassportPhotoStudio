import express from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import fs from "fs";
import { nanoid } from "nanoid";
import Database from "better-sqlite3";
import sharp from "sharp";
import { OrderStatus, canTransitionOrder } from "./domain/orderState.js";
import { summarizeAllowedEdits, validateTemplateRule } from "./domain/templateRules.js";

const app = express();
const port = Number(process.env.PORT || 4310);
const repoRoot = path.resolve(process.cwd(), "..", "..");
const dataDir = process.env.DATA_DIR || path.join(repoRoot, "data");
const exportDir = path.join(dataDir, "exports");
const uploadDir = path.join(dataDir, "uploads");
const dbPath = path.join(dataDir, "passportphoto.db");
const freeDailyDirectQuota = Number(process.env.FREE_DAILY_DIRECT_QUOTA || 1);
const freeQueueDelaySeconds = Number(process.env.FREE_QUEUE_DELAY_SECONDS || 180);
const queueWorkerIntervalMs = Number(process.env.QUEUE_WORKER_INTERVAL_MS || 3000);

fs.mkdirSync(exportDir, { recursive: true });
fs.mkdirSync(uploadDir, { recursive: true });

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024 } });

const parseBool = (value) => String(value).toLowerCase() === "true";
const toDateYmd = (date = new Date()) => date.toISOString().slice(0, 10);
const nowIso = () => new Date().toISOString();

const ensureColumn = (table, column, definition) => {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.find((col) => col.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
};

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use("/exports", express.static(exportDir));
app.use("/uploads", express.static(uploadDir));

const createSchema = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS exports (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS shares (
      token TEXT PRIMARY KEY,
      export_id TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      country TEXT NOT NULL,
      document_type TEXT NOT NULL,
      name TEXT NOT NULL,
      specs_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS template_rules (
      template_id TEXT PRIMARY KEY,
      width_mm REAL NOT NULL,
      height_mm REAL NOT NULL,
      dpi INTEGER NOT NULL,
      min_head_ratio REAL NOT NULL,
      max_head_ratio REAL NOT NULL,
      background_policy TEXT NOT NULL,
      allow_crop INTEGER NOT NULL,
      allow_resize INTEGER NOT NULL,
      allow_background_replace INTEGER NOT NULL,
      allow_face_retouch INTEGER NOT NULL,
      notes TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      guest_email TEXT,
      template_id TEXT NOT NULL,
      status TEXT NOT NULL,
      queue_mode TEXT NOT NULL DEFAULT 'DIRECT',
      priority INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS order_assets (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      original_image_path TEXT NOT NULL,
      processed_image_path TEXT,
      processed_png_path TEXT,
      pdf_path TEXT,
      alt_variants_json TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS usage_daily (
      usage_key TEXT NOT NULL,
      date_ymd TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (usage_key, date_ymd)
    );
    CREATE TABLE IF NOT EXISTS verification_requests (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      status TEXT NOT NULL,
      reviewer_notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS clothing_adjustments (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      style TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      order_id TEXT,
      provider TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      user_email TEXT NOT NULL,
      plan TEXT NOT NULL,
      status TEXT NOT NULL,
      renewal_date TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS support_tickets (
      id TEXT PRIMARY KEY,
      user_email TEXT,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      attachment_path TEXT,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_templates_country ON templates(country);
    CREATE INDEX IF NOT EXISTS idx_templates_doc_type ON templates(document_type);
    CREATE INDEX IF NOT EXISTS idx_orders_template ON orders(template_id);
    CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
  `);

  ensureColumn("orders", "queue_available_at", "TEXT");
  ensureColumn("orders", "human_verification", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn("orders", "clothing_adjustment", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn("orders", "last_error", "TEXT");

  ensureColumn("order_assets", "processed_png_path", "TEXT");
  ensureColumn("order_assets", "alt_variants_json", "TEXT");
};

const templateSeeds = [
  {
    id: "us-passport-2x2",
    country: "United States",
    documentType: "Passport",
    name: "US Passport 2x2 in",
    specs: { widthPx: 600, heightPx: 600, eyeLineRatio: 0.56, printable: true },
    rules: {
      widthMm: 50.8,
      heightMm: 50.8,
      dpi: 300,
      minHeadRatio: 0.5,
      maxHeadRatio: 0.69,
      backgroundPolicy: "WHITE_ONLY",
      allowCrop: 1,
      allowResize: 1,
      allowBackgroundReplace: 1,
      allowFaceRetouch: 0,
      notes: "US passport: plain white background; crop and resize allowed; no facial retouching."
    }
  },
  {
    id: "us-visa-2x2",
    country: "United States",
    documentType: "Visa",
    name: "US Visa 2x2 in",
    specs: { widthPx: 600, heightPx: 600, eyeLineRatio: 0.56, printable: true },
    rules: {
      widthMm: 50.8,
      heightMm: 50.8,
      dpi: 300,
      minHeadRatio: 0.5,
      maxHeadRatio: 0.69,
      backgroundPolicy: "WHITE_ONLY",
      allowCrop: 1,
      allowResize: 1,
      allowBackgroundReplace: 1,
      allowFaceRetouch: 0,
      notes: "US visa: white background required. No cosmetic facial modifications."
    }
  },
  {
    id: "us-dv-lottery-600",
    country: "United States",
    documentType: "DV Lottery",
    name: "US DV Lottery 600x600",
    specs: { widthPx: 600, heightPx: 600, eyeLineRatio: 0.56, printable: false },
    rules: {
      widthMm: 50.8,
      heightMm: 50.8,
      dpi: 300,
      minHeadRatio: 0.5,
      maxHeadRatio: 0.69,
      backgroundPolicy: "WHITE_ONLY",
      allowCrop: 1,
      allowResize: 1,
      allowBackgroundReplace: 1,
      allowFaceRetouch: 0,
      notes: "DV lottery digital photo constraints. Keep natural appearance."
    }
  },
  {
    id: "india-passport-35x45",
    country: "India",
    documentType: "Passport",
    name: "India Passport 35x45 mm",
    specs: { widthPx: 413, heightPx: 531, eyeLineRatio: 0.56, printable: true },
    rules: {
      widthMm: 35,
      heightMm: 45,
      dpi: 300,
      minHeadRatio: 0.62,
      maxHeadRatio: 0.78,
      backgroundPolicy: "LIGHT_ONLY",
      allowCrop: 1,
      allowResize: 1,
      allowBackgroundReplace: 1,
      allowFaceRetouch: 0,
      notes: "India passport: light background and neutral expression."
    }
  },
  {
    id: "uk-passport-35x45",
    country: "United Kingdom",
    documentType: "Passport",
    name: "UK Passport 35x45 mm",
    specs: { widthPx: 413, heightPx: 531, eyeLineRatio: 0.56, printable: true },
    rules: {
      widthMm: 35,
      heightMm: 45,
      dpi: 300,
      minHeadRatio: 0.58,
      maxHeadRatio: 0.75,
      backgroundPolicy: "LIGHT_ONLY",
      allowCrop: 1,
      allowResize: 1,
      allowBackgroundReplace: 1,
      allowFaceRetouch: 0,
      notes: "UK passport: light plain background, no heavy edits."
    }
  },
  {
    id: "canada-passport-50x70",
    country: "Canada",
    documentType: "Passport",
    name: "Canada Passport 50x70 mm",
    specs: { widthPx: 591, heightPx: 827, eyeLineRatio: 0.56, printable: true },
    rules: {
      widthMm: 50,
      heightMm: 70,
      dpi: 300,
      minHeadRatio: 0.5,
      maxHeadRatio: 0.7,
      backgroundPolicy: "WHITE_ONLY",
      allowCrop: 1,
      allowResize: 1,
      allowBackgroundReplace: 1,
      allowFaceRetouch: 0,
      notes: "Canada passport print format at 50x70 mm."
    }
  },
  {
    id: "schengen-visa-35x45",
    country: "Schengen",
    documentType: "Visa",
    name: "Schengen Visa 35x45 mm",
    specs: { widthPx: 413, heightPx: 531, eyeLineRatio: 0.56, printable: true },
    rules: {
      widthMm: 35,
      heightMm: 45,
      dpi: 300,
      minHeadRatio: 0.62,
      maxHeadRatio: 0.78,
      backgroundPolicy: "LIGHT_ONLY",
      allowCrop: 1,
      allowResize: 1,
      allowBackgroundReplace: 1,
      allowFaceRetouch: 0,
      notes: "Schengen visa photo with light neutral background."
    }
  },
  {
    id: "australia-passport-35x45",
    country: "Australia",
    documentType: "Passport",
    name: "Australia Passport 35x45 mm",
    specs: { widthPx: 413, heightPx: 531, eyeLineRatio: 0.56, printable: true },
    rules: {
      widthMm: 35,
      heightMm: 45,
      dpi: 300,
      minHeadRatio: 0.62,
      maxHeadRatio: 0.78,
      backgroundPolicy: "WHITE_ONLY",
      allowCrop: 1,
      allowResize: 1,
      allowBackgroundReplace: 1,
      allowFaceRetouch: 0,
      notes: "Australia passport: plain white background preferred."
    }
  },
  {
    id: "singapore-passport-35x45",
    country: "Singapore",
    documentType: "Passport",
    name: "Singapore Passport 35x45 mm",
    specs: { widthPx: 413, heightPx: 531, eyeLineRatio: 0.56, printable: true },
    rules: {
      widthMm: 35,
      heightMm: 45,
      dpi: 300,
      minHeadRatio: 0.62,
      maxHeadRatio: 0.78,
      backgroundPolicy: "WHITE_ONLY",
      allowCrop: 1,
      allowResize: 1,
      allowBackgroundReplace: 1,
      allowFaceRetouch: 0,
      notes: "Singapore passport standard with white background."
    }
  },
  {
    id: "uae-visa-43x55",
    country: "United Arab Emirates",
    documentType: "Visa",
    name: "UAE Visa 43x55 mm",
    specs: { widthPx: 508, heightPx: 650, eyeLineRatio: 0.56, printable: true },
    rules: {
      widthMm: 43,
      heightMm: 55,
      dpi: 300,
      minHeadRatio: 0.58,
      maxHeadRatio: 0.75,
      backgroundPolicy: "ANY_SOLID",
      allowCrop: 1,
      allowResize: 1,
      allowBackgroundReplace: 1,
      allowFaceRetouch: 0,
      notes: "UAE visa: clean solid background allowed based on authority guidance."
    }
  }
];

const seedTemplates = () => {
  const existing = db.prepare("SELECT COUNT(*) as total FROM templates").get();
  if (existing.total > 0) return;

  const insertTemplate = db.prepare(`
    INSERT OR IGNORE INTO templates (id, country, document_type, name, specs_json, created_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
  `);
  const insertRule = db.prepare(`
    INSERT OR IGNORE INTO template_rules (
      template_id, width_mm, height_mm, dpi, min_head_ratio, max_head_ratio, background_policy,
      allow_crop, allow_resize, allow_background_replace, allow_face_retouch, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const tx = db.transaction(() => {
    for (const seed of templateSeeds) {
      const validation = validateTemplateRule(seed.rules);
      if (!validation.valid) {
        throw new Error(`Invalid template rule for ${seed.id}: ${validation.errors.join(" | ")}`);
      }
      insertTemplate.run(
        seed.id,
        seed.country,
        seed.documentType,
        seed.name,
        JSON.stringify(seed.specs)
      );
      insertRule.run(
        seed.id,
        seed.rules.widthMm,
        seed.rules.heightMm,
        seed.rules.dpi,
        seed.rules.minHeadRatio,
        seed.rules.maxHeadRatio,
        seed.rules.backgroundPolicy,
        seed.rules.allowCrop,
        seed.rules.allowResize,
        seed.rules.allowBackgroundReplace,
        seed.rules.allowFaceRetouch,
        seed.rules.notes
      );
    }
  });
  tx();
};

const normalizeTemplateRow = (row) => ({
  id: row.id,
  country: row.country,
  documentType: row.documentType,
  name: row.name,
  specs: JSON.parse(row.specsJson),
  rules: {
    widthMm: row.widthMm,
    heightMm: row.heightMm,
    dpi: row.dpi,
    minHeadRatio: row.minHeadRatio,
    maxHeadRatio: row.maxHeadRatio,
    backgroundPolicy: row.backgroundPolicy,
    allowCrop: !!row.allowCrop,
    allowResize: !!row.allowResize,
    allowBackgroundReplace: !!row.allowBackgroundReplace,
    allowFaceRetouch: !!row.allowFaceRetouch,
    notes: row.notes
  }
});

const getTemplateById = (id) =>
  db
    .prepare(
      `
      SELECT
        t.id,
        t.country,
        t.document_type as documentType,
        t.name,
        t.specs_json as specsJson,
        r.width_mm as widthMm,
        r.height_mm as heightMm,
        r.dpi,
        r.min_head_ratio as minHeadRatio,
        r.max_head_ratio as maxHeadRatio,
        r.background_policy as backgroundPolicy,
        r.allow_crop as allowCrop,
        r.allow_resize as allowResize,
        r.allow_background_replace as allowBackgroundReplace,
        r.allow_face_retouch as allowFaceRetouch,
        r.notes
      FROM templates t
      JOIN template_rules r ON r.template_id = t.id
      WHERE t.id = ?
      `
    )
    .get(id);

const getUsageKey = (req, guestEmail) => {
  if (guestEmail) return `email:${guestEmail.toLowerCase()}`;
  const clientId = String(req.headers["x-client-id"] || "").trim();
  if (clientId) return `client:${clientId}`;
  return `ip:${req.ip || "unknown"}`;
};

const getUsageCount = (usageKey, ymd) => {
  const row = db.prepare("SELECT count FROM usage_daily WHERE usage_key = ? AND date_ymd = ?").get(usageKey, ymd);
  return row ? Number(row.count) : 0;
};

const incrementUsage = (usageKey, ymd) => {
  db.prepare(
    `
    INSERT INTO usage_daily (usage_key, date_ymd, count, updated_at)
    VALUES (?, ?, 1, datetime('now'))
    ON CONFLICT(usage_key, date_ymd) DO UPDATE SET count = count + 1, updated_at = datetime('now')
    `
  ).run(usageKey, ymd);
};

const resolvePublicPath = (publicPath) => {
  if (!publicPath) return null;
  if (publicPath.startsWith("/exports/")) {
    return path.join(exportDir, publicPath.replace("/exports/", ""));
  }
  if (publicPath.startsWith("/uploads/")) {
    return path.join(uploadDir, publicPath.replace("/uploads/", ""));
  }
  return null;
};

const computeTargetPixels = (rule) => ({
  widthPx: Math.max(64, Math.round((Number(rule.widthMm) / 25.4) * Number(rule.dpi))),
  heightPx: Math.max(64, Math.round((Number(rule.heightMm) / 25.4) * Number(rule.dpi)))
});

const buildA4SheetJpeg = async (photoJpegBuffer, targetWidthPx, targetHeightPx) => {
  const sheetWidth = 2480;
  const sheetHeight = 3508;
  const gap = 40;
  const cols = Math.max(1, Math.floor((sheetWidth + gap) / (targetWidthPx + gap)));
  const rows = Math.max(1, Math.floor((sheetHeight + gap) / (targetHeightPx + gap)));
  const total = Math.min(cols * rows, 12);
  const photoSpaceWidth = cols * targetWidthPx + (cols - 1) * gap;
  const photoSpaceHeight = rows * targetHeightPx + (rows - 1) * gap;
  const startX = Math.max(0, Math.floor((sheetWidth - photoSpaceWidth) / 2));
  const startY = Math.max(0, Math.floor((sheetHeight - photoSpaceHeight) / 2));

  const composites = [];
  for (let i = 0; i < total; i += 1) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    composites.push({
      input: photoJpegBuffer,
      left: startX + col * (targetWidthPx + gap),
      top: startY + row * (targetHeightPx + gap)
    });
  }

  return sharp({
    create: {
      width: sheetWidth,
      height: sheetHeight,
      channels: 3,
      background: "#ffffff"
    }
  })
    .composite(composites)
    .jpeg({ quality: 95 })
    .toBuffer();
};

const escapePdfText = (text) => String(text).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

const buildA4Pdf = async (_sheetJpegBuffer) => {
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const content = [
    "BT",
    "/F1 24 Tf",
    "50 790 Td",
    `(${escapePdfText("Passport Photo Studio - A4 Export")}) Tj`,
    "/F1 12 Tf",
    "0 -28 Td",
    `(${escapePdfText("This is a lightweight A4 PDF wrapper for your processed order.")}) Tj`,
    "0 -18 Td",
    `(${escapePdfText("Use JPG or PNG download for image-accurate print previews.")}) Tj`,
    "0 -18 Td",
    `(${escapePdfText("Facial retouching is disabled for compliance-focused outputs.")}) Tj`,
    "ET"
  ].join("\n");

  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj",
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj`,
    `4 0 obj\n<< /Length ${Buffer.byteLength(content, "utf8")} >>\nstream\n${content}\nendstream\nendobj`,
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj"
  ];

  let body = "";
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(body, "utf8"));
    body += `${object}\n`;
  }
  const xrefStart = Buffer.byteLength(`%PDF-1.4\n${body}`, "utf8");
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i += 1) {
    const position = offsets[i] + Buffer.byteLength("%PDF-1.4\n", "utf8");
    xref += `${String(position).padStart(10, "0")} 00000 n \n`;
  }
  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return Buffer.from(`%PDF-1.4\n${body}${xref}${trailer}`, "utf8");
};

const processOrderInternal = async (orderId, options = {}) => {
  const allowQueuedBypass = !!options.allowQueuedBypass;
  const row = db
    .prepare(
      `
      SELECT
        o.id,
        o.status,
        o.queue_mode as queueMode,
        o.queue_available_at as queueAvailableAt,
        o.priority,
        oa.original_image_path as originalImagePath,
        r.width_mm as widthMm,
        r.height_mm as heightMm,
        r.dpi,
        r.background_policy as backgroundPolicy,
        r.allow_crop as allowCrop
      FROM orders o
      JOIN order_assets oa ON oa.order_id = o.id
      JOIN template_rules r ON r.template_id = o.template_id
      WHERE o.id = ?
      `
    )
    .get(orderId);

  if (!row) return { ok: false, statusCode: 404, error: "Order not found" };

  if (row.status === OrderStatus.COMPLETED) {
    const assets = db
      .prepare(
        "SELECT processed_image_path as jpgPath, processed_png_path as pngPath, pdf_path as pdfPath FROM order_assets WHERE order_id = ?"
      )
      .get(orderId);
    return { ok: true, statusCode: 200, orderId, status: row.status, assets };
  }

  if (row.status === OrderStatus.QUEUED && !allowQueuedBypass) {
    const availableAtMs = row.queueAvailableAt ? new Date(row.queueAvailableAt).getTime() : 0;
    const remaining = Math.max(0, Math.ceil((availableAtMs - Date.now()) / 1000));
    if (remaining > 0) {
      return {
        ok: false,
        queued: true,
        statusCode: 202,
        orderId,
        status: row.status,
        remainingSeconds: remaining,
        queueAvailableAt: row.queueAvailableAt
      };
    }
  }

  const fromStatus = row.status;
  if (!canTransitionOrder(fromStatus, OrderStatus.PROCESSING)) {
    return { ok: false, statusCode: 409, error: `Cannot transition ${fromStatus} -> PROCESSING` };
  }
  db.prepare("UPDATE orders SET status = ?, last_error = NULL WHERE id = ?").run(OrderStatus.PROCESSING, orderId);

  try {
    const sourcePath = resolvePublicPath(row.originalImagePath);
    if (!sourcePath || !fs.existsSync(sourcePath)) {
      throw new Error("Original image is missing");
    }

    const { widthPx, heightPx } = computeTargetPixels(row);
    const fitMode = row.allowCrop ? "cover" : "contain";
    const requiresLightBg = row.backgroundPolicy === "WHITE_ONLY" || row.backgroundPolicy === "LIGHT_ONLY";
    const pipeline = sharp(sourcePath).rotate().resize(widthPx, heightPx, {
      fit: fitMode,
      position: "centre",
      background: "#ffffff"
    });
    const pngBuffer = await (requiresLightBg
      ? pipeline.clone().flatten({ background: "#ffffff" })
      : pipeline.clone()
    )
      .png({ compressionLevel: 9 })
      .toBuffer();
    const jpgBuffer = await (requiresLightBg
      ? pipeline.clone().flatten({ background: "#ffffff" })
      : pipeline.clone()
    )
      .jpeg({ quality: 94 })
      .toBuffer();

    const sheetJpeg = await buildA4SheetJpeg(jpgBuffer, widthPx, heightPx);
    const pdfBuffer = await buildA4Pdf(sheetJpeg);

    const jpgFilename = `${orderId}-processed.jpg`;
    const pngFilename = `${orderId}-processed.png`;
    const pdfFilename = `${orderId}-a4.pdf`;
    fs.writeFileSync(path.join(exportDir, jpgFilename), jpgBuffer);
    fs.writeFileSync(path.join(exportDir, pngFilename), pngBuffer);
    fs.writeFileSync(path.join(exportDir, pdfFilename), pdfBuffer);

    db.prepare(
      `
      UPDATE order_assets
      SET processed_image_path = ?, processed_png_path = ?, pdf_path = ?
      WHERE order_id = ?
      `
    ).run(`/exports/${jpgFilename}`, `/exports/${pngFilename}`, `/exports/${pdfFilename}`, orderId);
    db.prepare("UPDATE orders SET status = ?, last_error = NULL WHERE id = ?").run(OrderStatus.COMPLETED, orderId);

    return {
      ok: true,
      statusCode: 200,
      orderId,
      status: OrderStatus.COMPLETED,
      assets: {
        jpgPath: `/exports/${jpgFilename}`,
        pngPath: `/exports/${pngFilename}`,
        pdfPath: `/exports/${pdfFilename}`
      }
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown processing error";
    db.prepare("UPDATE orders SET status = ?, last_error = ? WHERE id = ?").run(OrderStatus.FAILED, message, orderId);
    return { ok: false, statusCode: 500, error: message };
  }
};

createSchema();
seedTemplates();

let queueWorkerActive = false;
setInterval(async () => {
  if (queueWorkerActive) return;
  queueWorkerActive = true;
  try {
    const queued = db
      .prepare("SELECT id, queue_available_at as queueAvailableAt FROM orders WHERE status = ? ORDER BY created_at ASC LIMIT 5")
      .all(OrderStatus.QUEUED);
    const created = db
      .prepare("SELECT id FROM orders WHERE status = ? ORDER BY created_at ASC LIMIT 5")
      .all(OrderStatus.CREATED);
    const now = Date.now();
    for (const order of queued) {
      const availableAt = order.queueAvailableAt ? new Date(order.queueAvailableAt).getTime() : now;
      if (availableAt <= now) {
        await processOrderInternal(order.id, { allowQueuedBypass: true });
      }
    }
    for (const order of created) {
      await processOrderInternal(order.id, { allowQueuedBypass: true });
    }
  } catch (error) {
    console.error("Queue worker failed", error);
  } finally {
    queueWorkerActive = false;
  }
}, queueWorkerIntervalMs);

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "passportphoto-server", timestamp: new Date().toISOString() });
});

app.get("/api/templates", (req, res) => {
  const country = String(req.query.country || "").trim();
  const q = String(req.query.q || "").trim().toLowerCase();
  const documentType = String(req.query.documentType || "").trim();

  let sql = `
    SELECT
      t.id,
      t.country,
      t.document_type as documentType,
      t.name,
      t.specs_json as specsJson,
      r.width_mm as widthMm,
      r.height_mm as heightMm,
      r.dpi,
      r.min_head_ratio as minHeadRatio,
      r.max_head_ratio as maxHeadRatio,
      r.background_policy as backgroundPolicy,
      r.allow_crop as allowCrop,
      r.allow_resize as allowResize,
      r.allow_background_replace as allowBackgroundReplace,
      r.allow_face_retouch as allowFaceRetouch,
      r.notes
    FROM templates t
    JOIN template_rules r ON r.template_id = t.id
    WHERE 1 = 1
  `;
  const params = [];
  if (country) {
    sql += " AND t.country = ?";
    params.push(country);
  }
  if (documentType) {
    sql += " AND t.document_type = ?";
    params.push(documentType);
  }
  if (q) {
    sql += " AND (LOWER(t.name) LIKE ? OR LOWER(t.country) LIKE ? OR LOWER(t.document_type) LIKE ?)";
    const like = `%${q}%`;
    params.push(like, like, like);
  }
  sql += " ORDER BY t.country ASC, t.document_type ASC, t.name ASC";

  const rows = db.prepare(sql).all(...params);
  res.json(rows.map(normalizeTemplateRow));
});

app.get("/api/templates/:id", (req, res) => {
  const row = getTemplateById(req.params.id);
  if (!row) {
    res.status(404).json({ error: "Template not found" });
    return;
  }
  res.json(normalizeTemplateRow(row));
});

app.post("/api/orders", upload.single("file"), (req, res) => {
  const templateId = String(req.body.templateId || "").trim();
  const guestEmail = String(req.body.guestEmail || "").trim();
  const prioritySkipQueue = parseBool(req.body.prioritySkipQueue);
  const humanVerificationAddon = parseBool(req.body.humanVerificationAddon);
  const clothingAdjustmentAddon = parseBool(req.body.clothingAdjustmentAddon);
  const clothingStyle = String(req.body.clothingStyle || "business-classic").trim();

  if (!templateId) {
    res.status(400).json({ error: "templateId is required" });
    return;
  }
  if (!req.file) {
    res.status(400).json({ error: "file is required" });
    return;
  }
  if (!req.file.mimetype.startsWith("image/")) {
    res.status(415).json({ error: "Only image uploads are supported" });
    return;
  }

  const templateRow = getTemplateById(templateId);
  if (!templateRow) {
    res.status(404).json({ error: "Template not found" });
    return;
  }
  const template = normalizeTemplateRow(templateRow);

  const orderId = nanoid(12);
  const safeExt = path.extname(req.file.originalname || "").replace(/[^a-zA-Z0-9.]/g, "") || ".jpg";
  const originalFilename = `${orderId}${safeExt.toLowerCase().slice(0, 5)}`;
  const originalPath = path.join(uploadDir, originalFilename);
  const usageKey = getUsageKey(req, guestEmail);
  const usageDay = toDateYmd();
  const usageCount = getUsageCount(usageKey, usageDay);

  let status = OrderStatus.CREATED;
  let queueMode = "DIRECT";
  let priority = 0;
  let queueAvailableAt = null;
  if (prioritySkipQueue) {
    priority = 1;
    queueMode = "PRIORITY";
  } else if (usageCount >= freeDailyDirectQuota) {
    status = OrderStatus.QUEUED;
    queueMode = "FREE_QUEUE";
    queueAvailableAt = new Date(Date.now() + freeQueueDelaySeconds * 1000).toISOString();
  } else {
    incrementUsage(usageKey, usageDay);
  }

  try {
    fs.writeFileSync(originalPath, req.file.buffer);
    db.prepare(
      `
      INSERT INTO orders (
        id, user_id, guest_email, template_id, status, queue_mode, priority, queue_available_at,
        human_verification, clothing_adjustment, last_error, created_at
      )
      VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, NULL, datetime('now'))
      `
    ).run(
      orderId,
      guestEmail || null,
      templateId,
      status,
      queueMode,
      priority,
      queueAvailableAt,
      humanVerificationAddon ? 1 : 0,
      clothingAdjustmentAddon ? 1 : 0
    );

    db.prepare(
      `
      INSERT INTO order_assets (
        id, order_id, original_image_path, processed_image_path, processed_png_path, pdf_path, alt_variants_json, created_at
      )
      VALUES (?, ?, ?, NULL, NULL, NULL, NULL, datetime('now'))
      `
    ).run(nanoid(10), orderId, `/uploads/${originalFilename}`);

    if (humanVerificationAddon) {
      db.prepare(
        `
        INSERT INTO verification_requests (id, order_id, status, reviewer_notes, created_at, updated_at)
        VALUES (?, ?, 'REQUESTED', NULL, datetime('now'), datetime('now'))
        `
      ).run(nanoid(10), orderId);
    }
    if (clothingAdjustmentAddon) {
      db.prepare(
        `
        INSERT INTO clothing_adjustments (id, order_id, style, status, created_at, updated_at)
        VALUES (?, ?, ?, 'REQUESTED', datetime('now'), datetime('now'))
        `
      ).run(nanoid(10), orderId, clothingStyle);
    }

    res.status(201).json({
      order: {
        id: orderId,
        templateId,
        status,
        queueMode,
        priority: !!priority,
        queueAvailableAt,
        createdAt: nowIso(),
        addOns: {
          humanVerification: humanVerificationAddon,
          clothingAdjustment: clothingAdjustmentAddon
        }
      },
      quota: {
        freeDailyDirectQuota,
        usedToday: usageCount + (status === OrderStatus.CREATED && !priority ? 1 : 0),
        queueDelaySeconds: status === OrderStatus.QUEUED ? freeQueueDelaySeconds : 0
      },
      template,
      compliance: {
        allowedEdits: summarizeAllowedEdits(template.rules),
        disclaimer:
          "Rules vary by authority. Crop/resize/background are applied only when template policy allows. Facial retouching is disabled."
      }
    });
  } catch (error) {
    console.error("Order creation failed", error);
    res.status(500).json({ error: "Order creation failed" });
  }
});

app.post("/api/orders/:id/process", async (req, res) => {
  const result = await processOrderInternal(req.params.id);
  if (!result.ok && result.queued) {
    res.status(result.statusCode || 202).json(result);
    return;
  }
  if (!result.ok) {
    res.status(result.statusCode || 500).json({ error: result.error || "Processing failed" });
    return;
  }
  res.status(200).json(result);
});

app.get("/api/orders/:id/download", (req, res) => {
  const format = String(req.query.format || "jpg").toLowerCase();
  const row = db
    .prepare(
      `
      SELECT
        processed_image_path as jpgPath,
        processed_png_path as pngPath,
        pdf_path as pdfPath
      FROM order_assets
      WHERE order_id = ?
      `
    )
    .get(req.params.id);
  if (!row) {
    res.status(404).json({ error: "Order assets not found" });
    return;
  }

  const selectedPath =
    format === "pdf" ? row.pdfPath : format === "png" ? row.pngPath : row.jpgPath;
  if (!selectedPath) {
    res.status(404).json({ error: `Format ${format} is not ready` });
    return;
  }

  const absPath = resolvePublicPath(selectedPath);
  if (!absPath || !fs.existsSync(absPath)) {
    res.status(404).json({ error: "File not found" });
    return;
  }
  res.download(absPath);
});

app.get("/api/orders/:id", (req, res) => {
  const order = db
    .prepare(
      `
      SELECT
        o.id,
        o.template_id as templateId,
        o.status,
        o.queue_mode as queueMode,
        o.priority,
        o.queue_available_at as queueAvailableAt,
        o.human_verification as humanVerification,
        o.clothing_adjustment as clothingAdjustment,
        o.last_error as lastError,
        o.created_at as createdAt,
        oa.original_image_path as originalImagePath,
        oa.processed_image_path as processedImagePath,
        oa.processed_png_path as processedPngPath,
        oa.pdf_path as pdfPath
      FROM orders o
      LEFT JOIN order_assets oa ON oa.order_id = o.id
      WHERE o.id = ?
      `
    )
    .get(req.params.id);
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  res.json(order);
});

app.get("/api/me/orders", (req, res) => {
  const guestEmail = String(req.query.guestEmail || "").trim();
  if (!guestEmail) {
    res.status(400).json({ error: "guestEmail query param is required for guest history" });
    return;
  }
  const rows = db
    .prepare(
      `
      SELECT
        id,
        template_id as templateId,
        status,
        queue_mode as queueMode,
        priority,
        queue_available_at as queueAvailableAt,
        created_at as createdAt
      FROM orders
      WHERE guest_email = ?
      ORDER BY created_at DESC
      LIMIT 100
      `
    )
    .all(guestEmail);
  res.json(rows);
});

app.post("/api/addons/human-verification", (req, res) => {
  const orderId = String(req.body.orderId || "").trim();
  if (!orderId) {
    res.status(400).json({ error: "orderId is required" });
    return;
  }
  const order = db.prepare("SELECT id FROM orders WHERE id = ?").get(orderId);
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  db.prepare("UPDATE orders SET human_verification = 1 WHERE id = ?").run(orderId);
  db.prepare(
    `
    INSERT INTO verification_requests (id, order_id, status, reviewer_notes, created_at, updated_at)
    VALUES (?, ?, 'REQUESTED', NULL, datetime('now'), datetime('now'))
    `
  ).run(nanoid(10), orderId);
  res.json({ ok: true, orderId, status: "REQUESTED" });
});

app.post("/api/addons/clothing-adjustment", (req, res) => {
  const orderId = String(req.body.orderId || "").trim();
  const style = String(req.body.style || "business-classic").trim();
  if (!orderId) {
    res.status(400).json({ error: "orderId is required" });
    return;
  }
  const order = db.prepare("SELECT id FROM orders WHERE id = ?").get(orderId);
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  db.prepare("UPDATE orders SET clothing_adjustment = 1 WHERE id = ?").run(orderId);
  db.prepare(
    `
    INSERT INTO clothing_adjustments (id, order_id, style, status, created_at, updated_at)
    VALUES (?, ?, ?, 'REQUESTED', datetime('now'), datetime('now'))
    `
  ).run(nanoid(10), orderId, style);
  res.json({ ok: true, orderId, style, status: "REQUESTED" });
});

app.post("/api/checkout/priority", (req, res) => {
  const orderId = String(req.body.orderId || "").trim();
  if (!orderId) {
    res.status(400).json({ error: "orderId is required" });
    return;
  }
  const order = db.prepare("SELECT id, status FROM orders WHERE id = ?").get(orderId);
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  db.prepare(
    "UPDATE orders SET priority = 1, queue_mode = 'PRIORITY', status = ?, queue_available_at = NULL WHERE id = ?"
  ).run(order.status === OrderStatus.QUEUED ? OrderStatus.CREATED : order.status, orderId);
  db.prepare(
    `
    INSERT INTO payments (id, order_id, provider, amount, currency, status, created_at)
    VALUES (?, ?, 'mock', 0.5, 'USD', 'PAID', datetime('now'))
    `
  ).run(nanoid(10), orderId);
  res.json({ ok: true, orderId, priority: true, provider: "mock", amount: 0.5, currency: "USD" });
});

app.post("/api/subscriptions/checkout", (req, res) => {
  const email = String(req.body.email || "").trim();
  if (!email) {
    res.status(400).json({ error: "email is required" });
    return;
  }
  const subscriptionId = nanoid(10);
  db.prepare(
    `
    INSERT INTO subscriptions (id, user_email, plan, status, renewal_date, created_at)
    VALUES (?, ?, 'pro-monthly', 'ACTIVE', datetime('now', '+30 day'), datetime('now'))
    `
  ).run(subscriptionId, email);
  res.json({ ok: true, subscriptionId, plan: "pro-monthly", amount: 9.9, currency: "USD", provider: "mock" });
});

app.post("/api/support/tickets", upload.single("attachment"), (req, res) => {
  const email = String(req.body.email || "").trim();
  const type = String(req.body.type || "general").trim();
  const message = String(req.body.message || "").trim();
  if (!message) {
    res.status(400).json({ error: "message is required" });
    return;
  }
  let attachmentPath = null;
  if (req.file) {
    const filename = `${nanoid(10)}-${req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, "")}`;
    fs.writeFileSync(path.join(uploadDir, filename), req.file.buffer);
    attachmentPath = `/uploads/${filename}`;
  }
  const ticketId = nanoid(10);
  db.prepare(
    `
    INSERT INTO support_tickets (id, user_email, type, message, attachment_path, status, created_at)
    VALUES (?, ?, ?, ?, ?, 'OPEN', datetime('now'))
    `
  ).run(ticketId, email || null, type, message, attachmentPath);
  res.status(201).json({ ok: true, ticketId, status: "OPEN" });
});

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

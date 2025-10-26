import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import Document from "../models/Document.js";
import { authRequired, requireRole } from "../middleware/auth.js";

const router = express.Router();

/** Ensure /uploads exists (and make sure app serves it: app.use("/uploads", express.static("uploads"))) */
const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

/** Multer storage */
const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
        const safe = file.originalname.replace(/\s+/g, "_");
        cb(null, `${Date.now()}_${safe}`);
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

/** Pick a VALID enum for Document.section to avoid validation errors */
function pickValidSection(req) {
    const enumValues = Document.schema.path("section")?.options?.enum || [];
    const requested = (req.body.section || "").trim();
    if (enumValues.includes(requested)) return requested;

    const mt = req.file?.mimetype || "";
    let inferred = mt.startsWith("audio/") || mt.startsWith("image/") ? "Listening" : "Reading";
    if (enumValues.includes(inferred)) return inferred;

    return enumValues[0] || undefined;
}

/** List */
router.get("/", authRequired, async (_req, res) => {
    const docs = await Document.find({}).sort({ createdAt: -1 }).lean();
    res.json(docs);
});

/** Upload (admin only) -> returns { url, absoluteUrl } that work in the client */
router.post(
    "/upload",
    authRequired,
    requireRole("admin"),
    upload.single("file"),
    async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({
                    error:
                        "No file received. Do not set Content-Type manually; use field name 'file'.",
                });
            }

            const relativeUrl = `/uploads/${req.file.filename}`;
            const absoluteUrl = `${req.protocol}://${req.get("host")}${relativeUrl}`;

            try {
                await Document.create({
                    title: req.body.title || req.file.originalname,
                    section: pickValidSection(req),
                    description: req.body.description || "",
                    fileUrl: relativeUrl,
                    originalName: req.file.originalname,
                    uploader: req.user.id,
                });
            } catch (dbErr) {
                // Keep upload successful even if metadata fails
                console.error("Document.create warning:", dbErr?.message || dbErr);
            }

            res.json({
                ok: true,
                url: relativeUrl,
                absoluteUrl,
                filename: req.file.filename,
                originalName: req.file.originalname,
                mimeType: req.file.mimetype,
                size: req.file.size,
            });
        } catch (e) {
            console.error("Upload failed:", e?.message || e);
            res.status(400).json({ error: "Upload failed" });
        }
    }
);

export default router;

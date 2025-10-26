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

/** Pick a valid section for Document */
function pickValidSection(req) {
    const enumValues = Document.schema.path("section")?.options?.enum || [];
    const requested = (req.body.section || "").trim();
    if (enumValues.includes(requested)) return requested;

    const mt = req.file?.mimetype || "";
    let inferred = mt.startsWith("audio/") || mt.startsWith("image/") ? "Listening" : "Reading";
    if (enumValues.includes(inferred)) return inferred;

    return enumValues[0] || undefined;
}

/** List all documents */
router.get("/", authRequired, async (_req, res) => {
    const docs = await Document.find({}).sort({ createdAt: -1 }).lean();
    res.json(docs);
});

/** Upload (admin only) */
router.post(
    "/upload",
    authRequired,
    requireRole("admin"),
    upload.single("file"),
    async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({
                    error: "No file received. Make sure to send field name 'file'.",
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
                console.error("⚠️ Document.create failed:", dbErr.message);
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
            console.error("❌ Upload failed:", e);
            res.status(500).json({ error: "Upload failed" });
        }
    }
);

/** Delete document (admin only) */
router.delete("/:id", authRequired, requireRole("admin"), async (req, res) => {
    try {
        const doc = await Document.findById(req.params.id);
        if (!doc) return res.status(404).json({ error: "Document not found" });

        // Delete physical file if exists
        const filePath = path.join(process.cwd(), doc.fileUrl);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

        await doc.deleteOne();
        res.json({ ok: true, message: "Document deleted" });
    } catch (err) {
        console.error("Delete failed:", err);
        res.status(500).json({ error: "Failed to delete document" });
    }
});

export default router;

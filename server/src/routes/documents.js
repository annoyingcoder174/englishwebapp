// server/src/routes/documents.js
import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import Document from "../models/Document.js";
import { authRequired, requireRole } from "../middleware/auth.js";

const router = express.Router();

/** ensure uploads dir exists at project root */
const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

/** Multer config: save to /uploads/<timestamp>_<safeName> */
const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
        const safeName = file.originalname.replace(/\s+/g, "_");
        cb(null, `${Date.now()}_${safeName}`);
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

/** Helper: pick a VALID enum section for the Document model */
function pickValidSection(req) {
    // Look at your mongoose schema:
    // section: { type: String, enum: ["Listening", "Reading", "Vocabulary", ...] }
    const enumValues = Document.schema.path("section")?.options?.enum || [];

    const requested = (req.body.section || "").trim();
    if (enumValues.includes(requested)) {
        return requested;
    }

    // Guess from mimetype (audio/image -> Listening; else Reading)
    const mt = req.file?.mimetype || "";
    const guess =
        mt.startsWith("audio/") || mt.startsWith("image/")
            ? "Listening"
            : "Reading";

    if (enumValues.includes(guess)) {
        return guess;
    }

    // fallback to first enum
    return enumValues[0] || "Reading";
}

/* ----------------- GET ALL DOCUMENTS (student + admin) ----------------- */
router.get("/", authRequired, async (_req, res) => {
    try {
        const docs = await Document.find({})
            .sort({ createdAt: -1 })
            .lean();

        res.json(docs);
    } catch (err) {
        console.error("List documents failed:", err);
        res.status(500).json({ error: "Failed to list documents" });
    }
});

/* ----------------- UPLOAD NEW DOCUMENT (ADMIN ONLY) -------------------- */
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
                        "No file received. Use form field name 'file'. Don't manually set Content-Type.",
                });
            }

            // We ALWAYS store relative path without /api prefix.
            //   ex: /uploads/1721234123_audio.mp3
            const relativeUrl = `/uploads/${req.file.filename}`;

            // For convenience we ALSO return an absolute URL
            //   ex: https://englishwebapp-nmtq.onrender.com/uploads/1721....
            const absoluteUrl = `${req.protocol}://${req.get("host")}${relativeUrl}`;

            try {
                await Document.create({
                    title: req.body.title || req.file.originalname,
                    section: pickValidSection(req),
                    description: req.body.description || "",
                    fileUrl: relativeUrl, // store clean relative path
                    originalName: req.file.originalname,
                    uploader: req.user.id,
                });
            } catch (dbErr) {
                // doc create failing should NOT kill the upload response
                console.error("Document.create warning:", dbErr?.message || dbErr);
            }

            res.json({
                ok: true,
                fileUrl: relativeUrl, // "/uploads/xxx.png"
                absoluteUrl,          // "https://.../uploads/xxx.png"
                filename: req.file.filename,
                originalName: req.file.originalname,
                mimeType: req.file.mimetype,
                size: req.file.size,
            });
        } catch (err) {
            console.error("Upload failed:", err?.message || err);
            res.status(400).json({ error: "Upload failed" });
        }
    }
);

/* ----------------- DELETE A DOCUMENT (ADMIN ONLY) ---------------------- */
router.delete(
    "/:id",
    authRequired,
    requireRole("admin"),
    async (req, res) => {
        try {
            const doc = await Document.findById(req.params.id);
            if (!doc) {
                return res.status(404).json({ error: "Document not found" });
            }

            // remove file from disk (best-effort)
            if (doc.fileUrl && doc.fileUrl.startsWith("/uploads/")) {
                const diskPath = path.join(
                    process.cwd(),
                    doc.fileUrl.replace(/^\/+/, "") // strip leading slash
                );
                fs.unlink(diskPath, () => { /* ignore errors */ });
            }

            await doc.deleteOne();
            res.json({ ok: true });
        } catch (err) {
            console.error("Delete document failed:", err);
            res.status(500).json({ error: "Failed to delete document" });
        }
    }
);

export default router;

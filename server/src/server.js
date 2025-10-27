// server/src/server.js
import "dotenv/config";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import path from "path";
import { fileURLToPath } from "url";

import { connectDB } from "./utils/db.js";

// routes
import authRoutes from "./routes/auth.js";
import documentRoutes from "./routes/documents.js";
import mockTestRoutes from "./routes/mocktests.js";

const app = express();
const PORT = process.env.PORT || 5001;

/* -------------------------------------------------
   __dirname shim for ES modules
------------------------------------------------- */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* -------------------------------------------------
   CORS
   - allow dev Vite
   - allow deployed frontend
   - (optional) allow FRONTEND_ORIGIN from .env
------------------------------------------------- */
const allowedOrigins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://englishwebapp-nmtq.onrender.com",
].concat(process.env.FRONTEND_ORIGIN ? [process.env.FRONTEND_ORIGIN] : []);

app.use(
    cors({
        origin(origin, cb) {
            // no origin (curl, Postman) -> allow
            if (!origin) return cb(null, true);

            if (allowedOrigins.includes(origin)) {
                return cb(null, true);
            }

            // Block anything else in prod-ish way
            console.warn("[CORS] Blocked origin:", origin);
            return cb(new Error("CORS not allowed from " + origin), false);
        },
        credentials: true,
    })
);

/* -------------------------------------------------
   Body parser + logger
------------------------------------------------- */
app.use(express.json({ limit: "5mb" }));
app.use(morgan("dev"));

/* -------------------------------------------------
   DB connect
------------------------------------------------- */
await connectDB();

/* -------------------------------------------------
   STATIC UPLOADS
   We save teacher uploads under /uploads on disk.
   We expose them two ways so old links keep working:
   - GET /uploads/filename.ext
   - GET /api/uploads/filename.ext
------------------------------------------------- */
const uploadsDir = path.join(__dirname, "../uploads");
app.use("/uploads", express.static(uploadsDir));
app.use("/api/uploads", express.static(uploadsDir));

/* -------------------------------------------------
   Health check
------------------------------------------------- */
app.get("/api", (_req, res) => {
    res.json({ ok: true, service: "toeic-platform-server" });
});

/* -------------------------------------------------
   API routes
------------------------------------------------- */
app.use("/api/auth", authRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/mocktests", mockTestRoutes);

/* -------------------------------------------------
   API 404 fallback
   (Front-end routing like /mock/:id/run is handled
    by Vite dev server / React Router, NOT here.)
------------------------------------------------- */
app.use("/api/*", (_req, res) => {
    res.status(404).json({ error: "Not Found" });
});

/* -------------------------------------------------
   Start server
------------------------------------------------- */
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`[CORS allowlist] ${allowedOrigins.join(", ")}`);
});

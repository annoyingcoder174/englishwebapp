// server/src/server.js
import "dotenv/config";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import path from "path";
import { fileURLToPath } from "url";

import { connectDB } from "./utils/db.js";

import authRoutes from "./routes/auth.js";
import documentRoutes from "./routes/documents.js";
import mockTestRoutes from "./routes/mocktests.js";

const app = express();
const PORT = process.env.PORT || 5001;

/* -------------------------------------------------
   __dirname shim (ESM)
------------------------------------------------- */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* -------------------------------------------------
   Paths
------------------------------------------------- */
const clientDistPath = path.join(__dirname, "../../client/dist");
const uploadsDir = path.join(__dirname, "../uploads");

/* -------------------------------------------------
   CORS allowlist
------------------------------------------------- */
const allowedOrigins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    process.env.FRONTEND_ORIGIN || ""
].filter(Boolean);

app.use(
    cors({
        origin(origin, cb) {
            // No origin (curl/Postman/SSR preflight) => allow
            if (!origin) return cb(null, true);

            if (allowedOrigins.includes(origin)) {
                return cb(null, true);
            }

            console.warn("[CORS] Blocked origin:", origin);
            return cb(new Error("CORS not allowed from " + origin), false);
        },
        credentials: true
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
   Static assets:
   1. /uploads -> teacher-uploaded audio/images/etc
   2. /api/uploads -> backwards compat
   3. clientDistPath -> the built React app
------------------------------------------------- */
app.use("/uploads", express.static(uploadsDir));
app.use("/api/uploads", express.static(uploadsDir));

app.use(express.static(clientDistPath));

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
   API 404 (explicit)
------------------------------------------------- */
app.use("/api/*", (_req, res) => {
    res.status(404).json({ error: "Not Found" });
});

/* -------------------------------------------------
   React Router fallback
   (any non-/api route goes to index.html)
------------------------------------------------- */
app.get("*", (req, res) => {
    if (req.path.startsWith("/api/")) {
        return res.status(404).json({ error: "Not Found" });
    }
    return res.sendFile(path.join(clientDistPath, "index.html"));
});

/* -------------------------------------------------
   Start server
------------------------------------------------- */
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    if (allowedOrigins.length) {
        console.log("[CORS allowlist]", allowedOrigins.join(", "));
    } else {
        console.log("[CORS allowlist] (none / same-origin only)");
    }
});

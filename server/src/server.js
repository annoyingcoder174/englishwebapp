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
   Paths we need
   - uploads on disk (teacher uploads)
   - client build output (React dist)
------------------------------------------------- */

// /server/src/server.js  -> ../../client/dist
// ../../ because:
//   server/
//     src/server.js   (we are here)
//   client/
//     dist/           (built frontend)
const clientDistPath = path.join(__dirname, "../../client/dist");

// uploads live in server/uploads
const uploadsDir = path.join(__dirname, "../uploads");

/* -------------------------------------------------
   CORS
   - In local dev:
        frontend origin: http://localhost:5173
        API origin:      http://localhost:5001
   - In production (Render one-service setup):
        frontend is served by the SAME Express origin,
        so CORS is basically not needed for the browser.
     BUT we'll still allow a couple origins so that
     curl/Postman/etc don't explode.
------------------------------------------------- */

const allowedOrigins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    // if you ever host the frontend separately, add it here:
    process.env.FRONTEND_ORIGIN || "",
].filter(Boolean);

app.use(
    cors({
        origin(origin, cb) {
            // no origin (curl, server-to-server, etc.) -> allow
            if (!origin) return cb(null, true);

            // same-origin prod hits won't go through CORS preflight anyway,
            // but we keep this for dev / debugging.
            if (allowedOrigins.includes(origin)) {
                return cb(null, true);
            }

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
   Connect DB
------------------------------------------------- */
await connectDB();

/* -------------------------------------------------
   Static file serving
   1. Teacher uploads (images, audio...)
      - /uploads/*
      - /api/uploads/*
   2. Built React frontend (client/dist)
      - we'll serve this at the root for production
------------------------------------------------- */
app.use("/uploads", express.static(uploadsDir));
app.use("/api/uploads", express.static(uploadsDir));

// Serve static assets from React build (JS/CSS/etc)
app.use(express.static(clientDistPath));

/* -------------------------------------------------
   Health check (API ping)
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
   We ONLY handle /api/* here. This should return JSON.
------------------------------------------------- */
app.use("/api/*", (_req, res) => {
    res.status(404).json({ error: "Not Found" });
});

/* -------------------------------------------------
   Frontend fallback
   VERY IMPORTANT:
   Any route that is NOT /api/... should serve index.html
   so React Router can handle routes like
      /study/home
      /mock/abc123/run
      /admin/tests
   etc.
------------------------------------------------- */
app.get("*", (req, res) => {
    // if they hit anything under /api/... and got here,
    // it means no API route matched; respond 404 JSON.
    if (req.path.startsWith("/api/")) {
        return res.status(404).json({ error: "Not Found" });
    }

    // otherwise, send the React app
    return res.sendFile(path.join(clientDistPath, "index.html"));
});

/* -------------------------------------------------
   Start server
------------------------------------------------- */
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    if (allowedOrigins.length) {
        console.log(`[CORS allowlist] ${allowedOrigins.join(", ")}`);
    } else {
        console.log("[CORS allowlist] (none / same-origin only)");
    }
});

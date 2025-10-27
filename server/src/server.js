// server/src/server.js
import "dotenv/config";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import path from "path";
import fs from "fs";
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
   🔥 FIX: allow all origins.
   Why: when your built React app (served by THIS SAME server)
   asks for /assets/*.js or /api/... it sends an Origin header.
   Our previous strict allowlist was incorrectly rejecting that
   Origin in production and returning a 500 for the JS bundle.
   No JS => blank white screen.

   We'll allow everything. If you want to lock it down later,
   we can reintroduce an allowlist once everything is stable.
------------------------------------------------- */
app.use(
    cors({
        origin: true,          // reflect request Origin
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
   STATIC: teacher uploads
   /uploads/* and /api/uploads/* both work
------------------------------------------------- */
const uploadsDir = path.join(__dirname, "../uploads");
app.use("/uploads", express.static(uploadsDir));
app.use("/api/uploads", express.static(uploadsDir));

/* -------------------------------------------------
   API routes
------------------------------------------------- */
app.use("/api/auth", authRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/mocktests", mockTestRoutes);

/* -------------------------------------------------
   Health check
------------------------------------------------- */
app.get("/api", (_req, res) => {
    res.json({ ok: true, service: "toeic-platform-server" });
});

/* -------------------------------------------------
   Serve React build (client-build)
   The Render build step copies client/dist -> server/client-build
------------------------------------------------- */
const clientBuildDir = path.join(__dirname, "../client-build");

// Serve static frontend assets (js, css, images)
if (fs.existsSync(clientBuildDir)) {
    app.use(express.static(clientBuildDir));

    // For ANY GET request that is not /api/* or /uploads/*,
    // send index.html so React Router can handle /study, /mock/:id/run, etc.
    app.get("*", (req, res, next) => {
        if (req.path.startsWith("/api") || req.path.startsWith("/uploads")) {
            return next();
        }

        const indexPath = path.join(clientBuildDir, "index.html");
        if (fs.existsSync(indexPath)) {
            return res.sendFile(indexPath);
        }

        return res.status(500).send("Client build not found");
    });
}

/* -------------------------------------------------
   API 404 fallback (for unknown /api/... routes)
------------------------------------------------- */
app.use("/api/*", (_req, res) => {
    res.status(404).json({ error: "Not Found" });
});

/* -------------------------------------------------
   Start server
------------------------------------------------- */
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});

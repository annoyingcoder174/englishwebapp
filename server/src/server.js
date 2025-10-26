import "dotenv/config";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import path from "path";
import { fileURLToPath } from "url";

import { connectDB } from "./utils/db.js";

// Routes
import authRoutes from "./routes/auth.js";
import documentRoutes from "./routes/documents.js";
import mockTestRoutes from "./routes/mocktests.js";

// Setup
const app = express();
const PORT = process.env.PORT || 5001;

// __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CORS (for local + Render)
app.use(
    cors({
        origin: [
            process.env.CLIENT_ORIGIN || "http://localhost:5173",
            "https://englishwebapp-nmtq.onrender.com",
        ],
        credentials: true,
    })
);

// Middleware
app.use(express.json({ limit: "5mb" }));
app.use(morgan("dev"));

// DB
await connectDB();

// Serve uploaded files
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/mocktests", mockTestRoutes);

// ✅ Serve frontend build
const clientPath = path.join(__dirname, "../../client/dist");
app.use(express.static(clientPath));

// Health check
app.get("/health", (_req, res) => res.send({ ok: true, service: "toeic-platform-server" }));

// ✅ Catch-all → serve React index.html
app.get("*", (req, res) => {
    res.sendFile(path.join(clientPath, "index.html"));
});

// Start
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});

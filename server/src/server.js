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

// CORS (React dev)
app.use(
    cors({
        origin: "http://localhost:5173",
        credentials: true,
    })
);

// Middleware
app.use(express.json({ limit: "5mb" }));
app.use(morgan("dev"));

// DB
await connectDB();

// Static uploads (served at http://localhost:5001/uploads/xxx)
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Health
app.get("/", (_req, res) =>
    res.send({ ok: true, service: "toeic-platform-server" })
);

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/mocktests", mockTestRoutes);

// Start
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});

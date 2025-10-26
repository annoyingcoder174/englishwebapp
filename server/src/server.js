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

const app = express();
const PORT = process.env.PORT || 5001;

// Needed for __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ CORS - allow both local and deployed frontend
app.use(
    cors({
        origin: [
            "http://localhost:5173",
            process.env.CLIENT_ORIGIN || "https://englishwebapp-nmtq.onrender.com",
        ],
        credentials: true,
    })
);

app.use(express.json({ limit: "5mb" }));
app.use(morgan("dev"));

// ✅ Connect database
await connectDB();

// ✅ Serve uploaded media (mp3, images)
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// ✅ API routes
app.use("/api/auth", authRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/mocktests", mockTestRoutes);

// ✅ Serve React frontend
const clientBuildPath = path.join(__dirname, "../../client/dist");
app.use(express.static(clientBuildPath));

// ✅ Handle all other routes by sending index.html
app.get("*", (_req, res) => {
    res.sendFile(path.join(clientBuildPath, "index.html"));
});

// ✅ Start the server
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});

import express from "express";
import Test from "../models/Test.js";
import { authRequired, requireRole } from "../middleware/auth.js";

const router = express.Router();

// Create test (admin)
router.post("/", authRequired, requireRole("admin"), async (req, res) => {
    try {
        const test = await Test.create({ ...req.body, createdBy: req.user.id });
        res.json(test);
    } catch (e) {
        console.error(e);
        res.status(400).json({ error: "Failed to create test" });
    }
});

// List tests (admin sees all; students see titles)
router.get("/", authRequired, async (req, res) => {
    try {
        const tests = await Test.find().sort({ createdAt: -1 });
        res.json(tests);
    } catch (e) {
        res.status(500).json({ error: "Failed to fetch tests" });
    }
});

// Get single test (with questions)
router.get("/:id", authRequired, async (req, res) => {
    try {
        const test = await Test.findById(req.params.id);
        if (!test) return res.status(404).json({ error: "Not found" });
        res.json(test);
    } catch (e) {
        res.status(500).json({ error: "Failed to fetch test" });
    }
});

// Update test (admin)
router.put("/:id", authRequired, requireRole("admin"), async (req, res) => {
    try {
        const updated = await Test.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(updated);
    } catch (e) {
        res.status(400).json({ error: "Failed to update test" });
    }
});

// Delete test (admin)
router.delete("/:id", authRequired, requireRole("admin"), async (req, res) => {
    try {
        await Test.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (e) {
        res.status(400).json({ error: "Failed to delete test" });
    }
});

export default router;

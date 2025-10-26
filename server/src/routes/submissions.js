import express from "express";
import Test from "../models/Test.js";
import Submission from "../models/Submission.js";
import { authRequired } from "../middleware/auth.js";

const router = express.Router();

// Submit answers and auto-score
router.post("/:testId", authRequired, async (req, res) => {
    try {
        const { answers } = req.body; // [{ number, choice }]
        const test = await Test.findById(req.params.testId);
        if (!test) return res.status(404).json({ error: "Test not found" });

        const key = new Map(test.questions.map(q => [q.number, q.answer]));
        let correctCount = 0;
        const graded = answers.map(a => {
            const isCorrect = (a.choice || "").toUpperCase() === (key.get(a.number) || "").toUpperCase();
            if (isCorrect) correctCount += 1;
            return { ...a, correct: isCorrect };
        });

        const total = test.questions.length || 0;
        const percentage = total ? Math.round((correctCount / total) * 100) : 0;

        const submission = await Submission.create({
            test: test._id,
            student: req.user.id,
            answers: graded,
            score: correctCount,
            total,
            percentage,
            startedAt: req.body.startedAt ? new Date(req.body.startedAt) : undefined,
            completedAt: new Date(),
        });

        res.json(submission);
    } catch (e) {
        console.error(e);
        res.status(400).json({ error: "Scoring failed" });
    }
});

// List my submissions (student) or all (admin)
router.get("/", authRequired, async (req, res) => {
    const query = req.user.role === "admin" ? {} : { student: req.user.id };
    const subs = await Submission.find(query)
        .populate("test", "title section")
        .populate("student", "name email")
        .sort({ createdAt: -1 });
    res.json(subs);
});

export default router;

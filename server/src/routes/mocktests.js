import express from "express";
import mongoose from "mongoose";
import MockTest from "../models/MockTest.js";
import MockSubmission from "../models/MockSubmission.js";
import { authRequired, requireRole } from "../middleware/auth.js";

const router = express.Router();

const isId = (id) => mongoose.Types.ObjectId.isValid(id);
const norm = (v) => (typeof v === "string" ? v.trim().toUpperCase() : "");

/* ----------------------------- QUICK CREATE ------------------------------ */
router.post(
    "/quick-create",
    authRequired,
    requireRole("admin"),
    async (req, res) => {
        try {
            const {
                title,
                description,
                sectionName,
                part,
                durationMinutes,
                passageHtml,
                groupTitle,
                questions,
            } = req.body;

            if (!title || !sectionName || !part || !questions?.length) {
                return res
                    .status(400)
                    .json({ error: "Missing required fields (title/section/part/questions)" });
            }

            const doc = await MockTest.create({
                title,
                description: description || "",
                sections: [
                    {
                        name: sectionName, // "Reading" / "Listening"
                        part: Number(part),
                        durationMinutes:
                            Number(durationMinutes) || (sectionName === "Listening" ? 45 : 75),
                        linear: sectionName === "Listening",
                        groups: [
                            {
                                title: groupTitle || "",
                                instructions: "",
                                passageHtml: passageHtml || "",
                                audioUrl: "",
                                imageUrl: "",
                                questions: questions.map((q) => ({
                                    number: q.number,
                                    prompt: q.prompt,
                                    type: "MCQ",
                                    options: [
                                        { key: "A", text: q.choices?.A || "" },
                                        { key: "B", text: q.choices?.B || "" },
                                        { key: "C", text: q.choices?.C || "" },
                                        { key: "D", text: q.choices?.D || "" },
                                    ],
                                    answer: q.answer,
                                })),
                            },
                        ],
                    },
                ],
                createdBy: req.user.id,
            });

            return res.json({ ok: true, testId: doc._id });
        } catch (err) {
            console.error("Quick create failed:", err);
            return res
                .status(500)
                .json({ error: "Failed to quick-create mock test", detail: err.message });
        }
    }
);

/* --------------------------------- LIST ---------------------------------- */
router.get("/", authRequired, async (_req, res) => {
    try {
        const tests = await MockTest.find({})
            .select("title description createdAt")
            .sort({ createdAt: -1 })
            .lean();
        res.json(tests);
    } catch (e) {
        console.error("List tests failed:", e);
        res.status(500).json({ error: "Failed to list tests" });
    }
});

/* ------------------------------- GET FULL -------------------------------- */
router.get("/:id", authRequired, async (req, res) => {
    try {
        if (!isId(req.params.id)) return res.status(400).json({ error: "Bad id" });
        const test = await MockTest.findById(req.params.id).lean();
        if (!test) return res.status(404).json({ error: "Not found" });
        res.json(test);
    } catch (e) {
        console.error("Get test failed:", e);
        res.status(500).json({ error: "Failed to get test" });
    }
});

/* ------------------------------- START/RESUME ----------------------------- */
router.post("/:id/start", authRequired, async (req, res) => {
    try {
        if (!isId(req.params.id)) return res.status(400).json({ error: "Bad id" });

        const test = await MockTest.findById(req.params.id).select("_id").lean();
        if (!test) return res.status(404).json({ error: "Test not found" });

        let sub = await MockSubmission.findOne({
            test: test._id,
            student: req.user.id,
        });

        if (!sub) {
            sub = await MockSubmission.create({
                test: test._id,
                student: req.user.id,
                answers: [],
                startedAt: new Date(),
            });
        }

        res.json({
            _id: sub._id,
            startedAt: sub.startedAt,
            finishedAt: sub.finishedAt,
            totalCorrect: sub.totalCorrect ?? 0,
            totalQuestions: sub.totalQuestions ?? 0,
            sectionScores: sub.sectionScores ?? [],
        });
    } catch (e) {
        console.error("Start failed:", e);
        res.status(500).json({ error: "Failed to start" });
    }
});

/* ------------------------------- SUBMISSION ------------------------------- */
router.get("/:id/submission", authRequired, async (req, res) => {
    try {
        if (!isId(req.params.id)) return res.status(400).json({ error: "Bad id" });
        const sub = await MockSubmission.findOne({
            test: req.params.id,
            student: req.user.id,
        }).lean();

        if (!sub) return res.json(null);
        res.json({
            _id: sub._id,
            startedAt: sub.startedAt,
            finishedAt: sub.finishedAt,
            answers: sub.answers ?? [],
            sectionScores: sub.sectionScores ?? [],
            totalCorrect: sub.totalCorrect ?? 0,
            totalQuestions: sub.totalQuestions ?? 0,
        });
    } catch (e) {
        console.error("Get submission failed:", e);
        res.status(500).json({ error: "Failed to get submission" });
    }
});

/* --------------------------------- ANSWER --------------------------------- */
router.post("/:id/answer", authRequired, async (req, res) => {
    try {
        const { section, number, choice } = req.body;
        if (!isId(req.params.id)) return res.status(400).json({ error: "Bad id" });
        if (!section || typeof number !== "number")
            return res.status(400).json({ error: "Missing fields" });

        const test = await MockTest.findById(req.params.id).lean();
        if (!test) return res.status(404).json({ error: "Test not found" });

        const sec = test.sections?.find((s) => s.name === section);
        if (!sec) return res.status(400).json({ error: "Bad section" });

        const q = sec.groups.flatMap((g) => g.questions).find((x) => x.number === number);
        if (!q) return res.status(400).json({ error: "Bad number" });

        const correct = norm(String(choice ?? "")) === norm(String(q.answer ?? ""));

        let sub = await MockSubmission.findOne({ test: test._id, student: req.user.id });
        if (!sub) {
            sub = await MockSubmission.create({
                test: test._id,
                student: req.user.id,
                answers: [],
                startedAt: new Date(),
            });
        }

        const idx = sub.answers.findIndex((a) => a.section === section && a.number === number);
        const payload = { section, number, choice, correct };
        if (idx >= 0) sub.answers[idx] = payload;
        else sub.answers.push(payload);

        await sub.save();
        res.json({ ok: true, correct });
    } catch (e) {
        console.error("Save answer failed:", e);
        res.status(500).json({ error: "Failed to save answer" });
    }
});

/* --------------------------------- FINISH --------------------------------- */
router.post("/:id/finish", authRequired, async (req, res) => {
    try {
        if (!isId(req.params.id)) return res.status(400).json({ error: "Bad id" });

        const test = await MockTest.findById(req.params.id).lean();
        if (!test) return res.status(404).json({ error: "Test not found" });

        const sub = await MockSubmission.findOne({ test: test._id, student: req.user.id });
        if (!sub) return res.status(400).json({ error: "No answers" });

        const sectionScores = [];
        let totalCorrect = 0;
        let totalQuestions = 0;

        for (const sec of test.sections) {
            const secQs = sec.groups.flatMap((g) => g.questions);
            const total = secQs.length;
            totalQuestions += total;

            const key = new Map(secQs.map((q) => [q.number, norm(String(q.answer ?? ""))]));

            const correctCount = sub.answers
                .filter((a) => a.section === sec.name)
                .reduce(
                    (acc, a) => acc + (norm(String(a.choice ?? "")) === (key.get(a.number) || "") ? 1 : 0),
                    0
                );

            totalCorrect += correctCount;
            sectionScores.push({
                section: sec.name,
                correct: correctCount,
                total,
                percentage: total ? Math.round((correctCount / total) * 100) : 0,
            });
        }

        sub.sectionScores = sectionScores;
        sub.totalCorrect = totalCorrect;
        sub.totalQuestions = totalQuestions;
        sub.finishedAt = new Date();
        await sub.save();

        res.json({
            _id: sub._id,
            sectionScores,
            totalCorrect,
            totalQuestions,
            finishedAt: sub.finishedAt,
        });
    } catch (e) {
        console.error("Finish failed:", e);
        res.status(500).json({ error: "Failed to finish test" });
    }
});

/* -------------------------------- REVIEW ---------------------------------- */
/** Return a detailed review payload used by /mock/:id/review */
router.get("/:id/review", authRequired, async (req, res) => {
    try {
        if (!isId(req.params.id)) return res.status(400).json({ error: "Bad id" });

        const [test, sub] = await Promise.all([
            MockTest.findById(req.params.id).lean(),
            MockSubmission.findOne({ test: req.params.id, student: req.user.id }).lean(),
        ]);

        if (!test) return res.status(404).json({ error: "Test not found" });
        if (!sub || !sub.finishedAt)
            return res.status(400).json({ error: "Chưa có kết quả. Có thể bạn chưa nộp bài." });

        // Build lookup from section+number -> (question, group)
        const index = {};
        for (const sec of test.sections || []) {
            for (const g of sec.groups || []) {
                for (const q of g.questions || []) {
                    index[`${sec.name}#${q.number}`] = { q, group: g, sec };
                }
            }
        }

        const items = (sub.answers || [])
            .sort((a, b) => (a.number || 0) - (b.number || 0))
            .map((a) => {
                const key = `${a.section}#${a.number}`;
                const hit = index[key];
                if (!hit) {
                    return {
                        section: a.section,
                        number: a.number,
                        prompt: "(Câu hỏi không còn tồn tại)",
                        options: [],
                        correctAnswer: "",
                        chosen: a.choice ?? "",
                        correct: false,
                        explanationHtml: "",
                        group: {},
                    };
                }
                const { q, group, sec } = hit;
                return {
                    section: sec.name,
                    number: q.number,
                    prompt: q.prompt,
                    options: q.options || [],
                    correctAnswer: q.answer,
                    chosen: a.choice ?? "",
                    correct: !!a.correct,
                    explanationHtml: q.explanationHtml || "",
                    tags: q.tags || [],
                    group: {
                        title: group.title || "",
                        instructions: group.instructions || "",
                        passageHtml: group.passageHtml || "",
                        imageUrl: group.imageUrl || "",
                        audioUrl: group.audioUrl || "",
                        part: sec.part,
                    },
                };
            });

        res.json({
            testId: test._id,
            title: test.title,
            description: test.description || "",
            sectionScores: sub.sectionScores || [],
            totalCorrect: sub.totalCorrect ?? 0,
            totalQuestions: sub.totalQuestions ?? 0,
            finishedAt: sub.finishedAt,
            items,
        });
    } catch (e) {
        console.error("Review failed:", e);
        res.status(500).json({ error: "Failed to load review" });
    }
});

/* --------------------------------- SCORE ---------------------------------- */
router.get("/:id/score", authRequired, async (req, res) => {
    try {
        if (!isId(req.params.id)) return res.status(400).json({ error: "Bad id" });
        const sub = await MockSubmission.findOne({
            test: req.params.id,
            student: req.user.id,
        })
            .select("sectionScores totalCorrect totalQuestions startedAt finishedAt")
            .lean();

        if (!sub) return res.json(null);
        res.json(sub);
    } catch (e) {
        console.error("Get score failed:", e);
        res.status(500).json({ error: "Failed to get score" });
    }
});

export default router;

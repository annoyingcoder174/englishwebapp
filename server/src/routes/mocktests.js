// server/src/routes/mocktests.js
import express from "express";
import mongoose from "mongoose";
import MockTest from "../models/MockTest.js";
import MockSubmission from "../models/MockSubmission.js";
import { authRequired, requireRole } from "../middleware/auth.js";

const router = express.Router();
const isId = (id) => mongoose.Types.ObjectId.isValid(id);

// helpers
const norm = (v) =>
    typeof v === "string" ? v.trim().toLowerCase() : "";

/* ---------------------------------------------------------
   ADMIN: CREATE / UPDATE TEST  (builder save)
   --------------------------------------------------------- */
/*
Builder POST /mocktests/build sends:

{
  _id?: string (if editing existing test),
  title: string,
  description: string,
  sections: [
    {
      name: "Listening" | "Reading",
      part: number,
      durationMinutes: number,
      linear: boolean,
      groups: [
        {
          title: string,
          instructions: string,
          passageHtml: string,
          imageUrl: string,
          audioUrl: string,
          questions: [
            // MCQ
            {
              number,
              type: "MCQ",
              prompt,
              options: [{key:"A", text:"..."}, ...],
              answer: "A" | "B" | "C" | "D",
              explanationHtml: "<p>....</p>"
            }

            // TFNG
            {
              number,
              type: "TFNG",
              prompt,
              answer: "TRUE" | "FALSE" | "NOT GIVEN",
              explanationHtml
            }

            // FILL (1 blank)
            {
              number,
              type: "FILL",
              prompt,
              answer: "creativity",
              explanationHtml
            }

            // FILL_BLOCK
            {
              number,
              type: "FILL_BLOCK",
              blockText,
              blanks: [
                {
                  slot: 1,
                  answer: "creativity",
                  limit: "ONE WORD ONLY",
                  note: "This is the teacher explanation for THAT blank"
                },
                ...
              ]
              // (no explanationHtml at question-level usually)
            }

            // MATCH
            {
              number,
              type: "MATCH",
              prompt,
              pairs: [
                { left: "Paragraph A", right: "iii" },
                ...
              ],
              explanationHtml
            }
          ]
        }
      ]
    }
  ],

  // optional visibility controls
  visibility: "all" | "allow-list" | "block-list",
  allowedStudents: [ "studentEmailOrUserId", ... ],
  blockedStudents: [ "studentEmailOrUserId", ... ]
}
*/
router.post(
    "/build",
    authRequired,
    requireRole("admin"),
    async (req, res) => {
        try {
            const {
                _id,
                title,
                description = "",
                sections = [],
                visibility = "all",
                allowedStudents = [],
                blockedStudents = [],
            } = req.body;

            if (!title || !sections.length) {
                return res
                    .status(400)
                    .json({ error: "Thiếu tiêu đề hoặc chưa có phần thi." });
            }

            // normalize / sanitize payload before save
            const normSections = sections.map((sec) => ({
                name: sec.name || "Reading",
                part: Number(sec.part) || 1,
                durationMinutes:
                    Number(sec.durationMinutes) ||
                    (sec.name === "Listening" ? 45 : 75),
                linear: !!sec.linear,
                groups: (sec.groups || []).map((g) => ({
                    title: g.title || "",
                    instructions: g.instructions || "",
                    passageHtml: g.passageHtml || "",
                    imageUrl: g.imageUrl || "",
                    audioUrl: g.audioUrl || "",
                    questions: (g.questions || []).map((q) => {
                        // we keep exactly the shape our Mongoose model expects
                        // (matches server/models/MockTest.js)
                        if (q.type === "FILL_BLOCK") {
                            return {
                                number: Number(q.number) || 0,
                                type: "FILL_BLOCK",
                                prompt: q.prompt || "",
                                blockText: q.blockText || "",
                                blanks: (q.blanks || []).map((b) => ({
                                    slot: Number(b.slot) || 0,
                                    answer: b.answer || "",
                                    limit: b.limit || "ONE WORD ONLY",
                                    note: b.note || "",
                                })),
                            };
                        }
                        if (q.type === "MATCH") {
                            return {
                                number: Number(q.number) || 0,
                                type: "MATCH",
                                prompt: q.prompt || "",
                                pairs: (q.pairs || []).map((p) => ({
                                    left: p.left || "",
                                    right: p.right || "",
                                })),
                                explanationHtml: q.explanationHtml || "",
                            };
                        }
                        if (q.type === "TFNG") {
                            return {
                                number: Number(q.number) || 0,
                                type: "TFNG",
                                prompt: q.prompt || "",
                                answer: (q.answer || "").toUpperCase(), // TRUE/FALSE/NOT GIVEN
                                explanationHtml: q.explanationHtml || "",
                            };
                        }
                        if (q.type === "FILL") {
                            return {
                                number: Number(q.number) || 0,
                                type: "FILL",
                                prompt: q.prompt || "",
                                answer: (q.answer || "").trim(),
                                explanationHtml: q.explanationHtml || "",
                            };
                        }
                        // default MCQ
                        return {
                            number: Number(q.number) || 0,
                            type: "MCQ",
                            prompt: q.prompt || "",
                            options: (q.options || []).map((o) => ({
                                key: o.key,
                                text: o.text || "",
                            })),
                            answer: (q.answer || "").toUpperCase(), // "A"
                            explanationHtml: q.explanationHtml || "",
                        };
                    }),
                })),
            }));

            let saved;
            if (_id && isId(_id)) {
                // update existing
                saved = await MockTest.findByIdAndUpdate(
                    _id,
                    {
                        title,
                        description,
                        sections: normSections,
                        visibility,
                        allowedStudents,
                        blockedStudents,
                    },
                    { new: true }
                );
            } else {
                // create new
                saved = await MockTest.create({
                    title,
                    description,
                    sections: normSections,
                    visibility,
                    allowedStudents,
                    blockedStudents,
                    createdBy: req.user.id,
                });
            }

            return res.json({ ok: true, testId: saved._id });
        } catch (err) {
            console.error("mocktests/build failed:", err);
            return res
                .status(500)
                .json({
                    error: "Failed to build test",
                    detail: err.message,
                });
        }
    }
);

/* ---------------------------------------------------------
   ADMIN: list tests in dashboard
   --------------------------------------------------------- */
router.get(
    "/admin/list",
    authRequired,
    requireRole("admin"),
    async (_req, res) => {
        try {
            const tests = await MockTest.find({})
                .sort({ createdAt: -1 })
                .lean();

            const mapped = tests.map((t) => ({
                _id: t._id,
                title: t.title || "(không tiêu đề)",
                description: t.description || "",
                createdAt: t.createdAt,
                visibility: t.visibility || "all",
                allowedStudents: t.allowedStudents || [],
                blockedStudents: t.blockedStudents || [],
                parts: (t.sections || []).map((sec) => ({
                    name: sec.name,
                    part: sec.part,
                    qCount: (sec.groups || []).reduce(
                        (acc, g) => acc + (g.questions?.length || 0),
                        0
                    ),
                })),
            }));

            res.json({ ok: true, tests: mapped });
        } catch (err) {
            console.error("GET /mocktests/admin/list failed:", err);
            res.status(500).json({ error: "Cannot list tests" });
        }
    }
);

/* ---------------------------------------------------------
   ADMIN: delete test (and its submissions)
   --------------------------------------------------------- */
router.delete(
    "/admin/:testId",
    authRequired,
    requireRole("admin"),
    async (req, res) => {
        try {
            const { testId } = req.params;
            if (!isId(testId)) {
                return res.status(400).json({ error: "Bad testId" });
            }

            // delete test
            await MockTest.findByIdAndDelete(testId);

            // cascade delete any submissions for that test
            await MockSubmission.deleteMany({ test: testId });

            return res.json({ ok: true });
        } catch (err) {
            console.error("DELETE /mocktests/admin/:testId failed:", err);
            res
                .status(500)
                .json({ error: "Cannot delete test/submissions" });
        }
    }
);

/* ---------------------------------------------------------
   STUDENT: list visible tests on StudyHome
   --------------------------------------------------------- */
router.get("/", authRequired, async (req, res) => {
    try {
        // Visibility rules
        const userId = req.user.id?.toString();
        const userEmail = req.user.email?.toLowerCase() || "";

        const tests = await MockTest.find({})
            .sort({ createdAt: -1 })
            .lean();

        // Filter by visibility
        const visible = tests.filter((t) => {
            const mode = t.visibility || "all";
            if (mode === "all") return true;

            // treat allowedStudents[] / blockedStudents[] as list
            // of strings that can match either userId or email
            const allowList = (t.allowedStudents || []).map((x) =>
                String(x).toLowerCase()
            );
            const blockList = (t.blockedStudents || []).map((x) =>
                String(x).toLowerCase()
            );

            if (mode === "allow-list") {
                return (
                    allowList.includes(userId?.toLowerCase()) ||
                    allowList.includes(userEmail)
                );
            }
            if (mode === "block-list") {
                const blocked =
                    blockList.includes(userId?.toLowerCase()) ||
                    blockList.includes(userEmail);
                return !blocked;
            }
            return true;
        });

        // send limited info
        const out = visible.map((t) => ({
            _id: t._id,
            title: t.title,
            description: t.description || "",
            createdAt: t.createdAt,
        }));

        res.json(out);
    } catch (e) {
        console.error("List tests failed:", e);
        res.status(500).json({ error: "Failed to list tests" });
    }
});

/* ---------------------------------------------------------
   STUDENT: get full test (used by MockTestRunner to render the paper)
   --------------------------------------------------------- */
router.get("/:id", authRequired, async (req, res) => {
    try {
        const testId = req.params.id;
        if (!isId(testId))
            return res.status(400).json({ error: "Bad id" });

        const test = await MockTest.findById(testId).lean();
        if (!test)
            return res.status(404).json({ error: "Not found" });

        // Visibility enforcement (same logic as list)
        const mode = test.visibility || "all";
        const userId = req.user.id?.toString();
        const userEmail = req.user.email?.toLowerCase() || "";
        const allowList = (test.allowedStudents || []).map((x) =>
            String(x).toLowerCase()
        );
        const blockList = (test.blockedStudents || []).map((x) =>
            String(x).toLowerCase()
        );

        if (mode === "allow-list") {
            const ok =
                allowList.includes(userId?.toLowerCase()) ||
                allowList.includes(userEmail);
            if (!ok)
                return res
                    .status(403)
                    .json({ error: "Bạn không có quyền xem đề này." });
        } else if (mode === "block-list") {
            const blocked =
                blockList.includes(userId?.toLowerCase()) ||
                blockList.includes(userEmail);
            if (blocked)
                return res
                    .status(403)
                    .json({ error: "Bạn không có quyền xem đề này." });
        }

        // We can return the whole test doc.
        res.json(test);
    } catch (e) {
        console.error("Get test failed:", e);
        res.status(500).json({ error: "Failed to get test" });
    }
});

/* ---------------------------------------------------------
   STUDENT: create/find submission (start test)
   --------------------------------------------------------- */
router.post("/:id/start", authRequired, async (req, res) => {
    try {
        const testId = req.params.id;
        if (!isId(testId))
            return res.status(400).json({ error: "Bad id" });

        const test = await MockTest.findById(testId)
            .select("_id visibility allowedStudents blockedStudents")
            .lean();
        if (!test)
            return res.status(404).json({ error: "Test not found" });

        // same visibility enforcement before starting
        const mode = test.visibility || "all";
        const userId = req.user.id?.toString();
        const userEmail = req.user.email?.toLowerCase() || "";
        const allowList = (test.allowedStudents || []).map((x) =>
            String(x).toLowerCase()
        );
        const blockList = (test.blockedStudents || []).map((x) =>
            String(x).toLowerCase()
        );
        if (mode === "allow-list") {
            const ok =
                allowList.includes(userId?.toLowerCase()) ||
                allowList.includes(userEmail);
            if (!ok)
                return res
                    .status(403)
                    .json({
                        error:
                            "Không tạo được phiên làm bài. Có thể đề đã bị xoá hoặc bạn không còn quyền truy cập.",
                    });
        } else if (mode === "block-list") {
            const blocked =
                blockList.includes(userId?.toLowerCase()) ||
                blockList.includes(userEmail);
            if (blocked)
                return res
                    .status(403)
                    .json({
                        error:
                            "Không tạo được phiên làm bài. Có thể đề đã bị xoá hoặc bạn không còn quyền truy cập.",
                    });
        }

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
        });
    } catch (e) {
        console.error("Start failed:", e);
        res.status(500).json({ error: "Failed to start" });
    }
});

/* ---------------------------------------------------------
   STUDENT: get submission state (used by Runner to prefill answers)
   --------------------------------------------------------- */
router.get("/:id/submission", authRequired, async (req, res) => {
    try {
        const testId = req.params.id;
        if (!isId(testId))
            return res.status(400).json({ error: "Bad id" });

        const sub = await MockSubmission.findOne({
            test: testId,
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

/* ---------------------------------------------------------
   STUDENT: autosave an answer while doing the test
   body: { section, number, choice }
   --------------------------------------------------------- */
router.post("/:id/answer", authRequired, async (req, res) => {
    try {
        const testId = req.params.id;
        if (!isId(testId))
            return res.status(400).json({ error: "Bad id" });

        const { section, number, choice } = req.body;
        if (!section || typeof number !== "number") {
            return res.status(400).json({ error: "Missing fields" });
        }

        const test = await MockTest.findById(testId).lean();
        if (!test)
            return res.status(404).json({ error: "Test not found" });

        // flatten section's questions to check correctness for instant feedback
        const sec = test.sections?.find((s) => s.name === section);
        if (!sec)
            return res.status(400).json({ error: "Bad section" });

        const allQs = sec.groups.flatMap((g) => g.questions || []);
        const q = allQs.find((x) => x.number === number);
        if (!q)
            return res.status(400).json({ error: "Bad question number" });

        // figure out if it's correct (best-effort)
        let correctFlag = false;
        if (q.type === "MCQ") {
            correctFlag = norm(choice) === norm(q.answer || "");
        } else if (q.type === "TFNG") {
            correctFlag = norm(choice) === norm(q.answer || "");
        } else if (q.type === "FILL") {
            correctFlag = norm(choice) === norm(q.answer || "");
        } else if (q.type === "FILL_BLOCK") {
            // We store many blanks in a single string (Runner packs them).
            // e.g. "1=creativity||2=rules"
            // We'll parse and compare each slot.
            const map = {};
            if (typeof choice === "string") {
                choice.split("||").forEach((chunk) => {
                    const [slotStr, ans] = chunk.split("=");
                    if (slotStr && ans !== undefined) {
                        map[slotStr.trim()] = ans;
                    }
                });
            }
            const allGood = (q.blanks || []).every((b) => {
                const want = norm(b.answer || "");
                const got = norm(map[String(b.slot)] || "");
                return want === got;
            });
            correctFlag = allGood;
        } else if (q.type === "MATCH") {
            // We can't easily grade partial matching in autosave.
            correctFlag = false;
        }

        // upsert the submission
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

        const idx = sub.answers.findIndex(
            (a) => a.section === section && a.number === number
        );

        const payload = {
            section,
            number,
            choice,
            correct: !!correctFlag,
        };

        if (idx >= 0) {
            sub.answers[idx] = payload;
        } else {
            sub.answers.push(payload);
        }

        await sub.save();

        return res.json({ ok: true, correct: !!correctFlag });
    } catch (e) {
        console.error("Save answer failed:", e);
        res.status(500).json({ error: "Failed to save answer" });
    }
});

/* ---------------------------------------------------------
   STUDENT: finish test -> compute score
   --------------------------------------------------------- */
router.post("/:id/finish", authRequired, async (req, res) => {
    try {
        const testId = req.params.id;
        if (!isId(testId))
            return res.status(400).json({ error: "Bad id" });

        const test = await MockTest.findById(testId).lean();
        if (!test)
            return res.status(404).json({ error: "Test not found" });

        const sub = await MockSubmission.findOne({
            test: test._id,
            student: req.user.id,
        });
        if (!sub) {
            return res.status(400).json({ error: "No answers" });
        }

        const sectionScores = [];
        let totalCorrect = 0;
        let totalQuestions = 0;

        for (const sec of test.sections || []) {
            const secQs = sec.groups.flatMap((g) => g.questions || []);
            const total = secQs.length;
            totalQuestions += total;

            let correctCount = 0;

            for (const ans of sub.answers.filter(
                (a) => a.section === sec.name
            )) {
                const q = secQs.find((qq) => qq.number === ans.number);
                if (!q) continue;

                if (q.type === "MCQ") {
                    if (norm(ans.choice) === norm(q.answer || "")) {
                        correctCount += 1;
                    }
                } else if (q.type === "TFNG") {
                    if (norm(ans.choice) === norm(q.answer || "")) {
                        correctCount += 1;
                    }
                } else if (q.type === "FILL") {
                    if (norm(ans.choice) === norm(q.answer || "")) {
                        correctCount += 1;
                    }
                } else if (q.type === "FILL_BLOCK") {
                    // same parse logic as above
                    const map = {};
                    if (typeof ans.choice === "string") {
                        ans.choice.split("||").forEach((chunk) => {
                            const [slotStr, av] = chunk.split("=");
                            if (slotStr && av !== undefined) {
                                map[slotStr.trim()] = av;
                            }
                        });
                    }
                    const allGood = (q.blanks || []).every((b) => {
                        const want = norm(b.answer || "");
                        const got = norm(map[String(b.slot)] || "");
                        return want === got;
                    });
                    if (allGood) {
                        correctCount += 1;
                    }
                } else if (q.type === "MATCH") {
                    // skip auto-scoring or do partial later
                }
            }

            totalCorrect += correctCount;

            sectionScores.push({
                section: sec.name,
                correct: correctCount,
                total,
                percentage: total
                    ? Math.round((correctCount / total) * 100)
                    : 0,
            });
        }

        sub.sectionScores = sectionScores;
        sub.totalCorrect = totalCorrect;
        sub.totalQuestions = totalQuestions;
        sub.finishedAt = new Date();
        await sub.save();

        res.json({
            ok: true,
            totalCorrect,
            totalQuestions,
            sectionScores,
        });
    } catch (e) {
        console.error("Finish failed:", e);
        res.status(500).json({ error: "Failed to finish test" });
    }
});

/* ---------------------------------------------------------
   STUDENT: quick score summary for StudyHome cards
   --------------------------------------------------------- */
router.get("/:id/score", authRequired, async (req, res) => {
    try {
        const testId = req.params.id;
        if (!isId(testId))
            return res.status(400).json({ error: "Bad id" });

        const sub = await MockSubmission.findOne({
            test: testId,
            student: req.user.id,
        }).lean();

        if (!sub || !sub.finishedAt) {
            return res.status(404).json({ error: "No finished attempt" });
        }

        res.json({
            totalCorrect: sub.totalCorrect ?? 0,
            totalQuestions: sub.totalQuestions ?? 0,
            sectionScores: sub.sectionScores ?? [],
            finishedAt: sub.finishedAt,
        });
    } catch (e) {
        console.error("score failed:", e);
        res.status(500).json({ error: "Failed to get score" });
    }
});

/* ---------------------------------------------------------
   STUDENT: review page
   -> always include EVERY question in the test,
      even if the student left it blank
   --------------------------------------------------------- */
router.get("/:id/review", authRequired, async (req, res) => {
    try {
        const testId = req.params.id;
        if (!isId(testId)) {
            return res.status(400).json({ error: "Bad id" });
        }

        // load test + student's submission
        const [test, sub] = await Promise.all([
            MockTest.findById(testId).lean(),
            MockSubmission.findOne({
                test: testId,
                student: req.user.id,
            }).lean(),
        ]);

        if (!test) {
            return res.status(404).json({ error: "Test not found" });
        }
        if (!sub || !sub.finishedAt) {
            return res
                .status(400)
                .json({
                    error: "Chưa có kết quả. Có thể bạn chưa nộp bài.",
                });
        }

        // --------------------------------------------------
        // Build:
        //  1. flat list of ALL questions in the test
        //  2. an index of {section#number -> question meta}
        //  3. an index of student answers by {section#number}
        // --------------------------------------------------

        const allQuestionsFlat = []; // [{sec, group, q}]
        const questionIndex = {};   // "Reading#12" -> {sec, group, q}
        for (const sec of test.sections || []) {
            for (const g of sec.groups || []) {
                for (const q of g.questions || []) {
                    const key = `${sec.name}#${q.number}`;
                    questionIndex[key] = { sec, group: g, q };
                    allQuestionsFlat.push({ sec, group: g, q });
                }
            }
        }

        // student's answers map
        // { "Reading#12": {choice: "...", correct: bool} }
        const answerMap = {};
        for (const a of sub.answers || []) {
            const k = `${a.section}#${a.number}`;
            answerMap[k] = {
                choice: a.choice,
                correct: !!a.correct,
            };
        }

        // --------------------------------------------------
        // Helper normalizer
        // --------------------------------------------------
        const norm = (v) =>
            typeof v === "string" ? v.trim().toLowerCase() : "";

        // --------------------------------------------------
        // Build review items FOR EVERY QUESTION IN THE TEST
        // --------------------------------------------------
        const items = allQuestionsFlat
            .sort((A, B) => {
                // sort by section name first, then by question number
                if (A.sec.name === B.sec.name) {
                    return (A.q.number || 0) - (B.q.number || 0);
                }
                return A.sec.name.localeCompare(B.sec.name);
            })
            .map(({ sec, group, q }) => {
                const key = `${sec.name}#${q.number}`;
                const ansInfo = answerMap[key] || {}; // might be empty if skipped

                // default fields
                let chosenDisplay = ansInfo.choice ?? ""; // student's pick (raw)
                let correctAnswerDisplay = "";
                let correctFlag = !!ansInfo.correct;
                let blanksReview = [];
                let pairsReview = [];

                // type-specific formatting
                if (q.type === "MCQ") {
                    correctAnswerDisplay = q.answer || "";
                } else if (q.type === "TFNG") {
                    correctAnswerDisplay = q.answer || "";
                } else if (q.type === "FILL") {
                    correctAnswerDisplay = q.answer || "";
                } else if (q.type === "FILL_BLOCK") {
                    // ansInfo.choice is packed: "1=creativity||2=rules"
                    const slotMap = {};
                    if (typeof ansInfo.choice === "string") {
                        ansInfo.choice.split("||").forEach((chunk) => {
                            const [slotStr, got] = chunk.split("=");
                            if (slotStr && got !== undefined) {
                                slotMap[slotStr.trim()] = got;
                            }
                        });
                    }

                    blanksReview = (q.blanks || []).map((b) => {
                        const want = b.answer || "";
                        const got = slotMap[String(b.slot)] || "";
                        return {
                            slot: b.slot,
                            correctAnswer: want,
                            studentAnswer: got,
                            limit: b.limit || "",
                            note: b.note || "", // teacher's per-blank explanation
                        };
                    });

                    // build display strings
                    correctAnswerDisplay = (q.blanks || [])
                        .map((b) => `${b.slot}: ${b.answer}`)
                        .join(" | ");

                    chosenDisplay = blanksReview
                        .map(
                            (b) => `${b.slot}: ${b.studentAnswer || ""}`
                        )
                        .join(" | ");

                    // recompute correctness in case sub.answers[idx].correct is missing
                    const allGood = blanksReview.every(
                        (b) => norm(b.studentAnswer) === norm(b.correctAnswer)
                    );
                    correctFlag = allGood;
                } else if (q.type === "MATCH") {
                    // ansInfo.choice is: "left1=>studentRight1||left2=>studentRight2"
                    const mapLeftToRight = {};
                    if (typeof ansInfo.choice === "string") {
                        ansInfo.choice.split("||").forEach((chunk) => {
                            const [L, R] = chunk.split("=>");
                            if (L && R !== undefined) {
                                mapLeftToRight[L.trim()] = R;
                            }
                        });
                    }

                    pairsReview = (q.pairs || []).map((p) => ({
                        left: p.left || "",
                        correctRight: p.right || "",
                        studentRight: mapLeftToRight[p.left] || "",
                    }));

                    correctAnswerDisplay = pairsReview
                        .map((p) => `${p.left}→${p.correctRight}`)
                        .join(" | ");

                    chosenDisplay = pairsReview
                        .map((p) => `${p.left}→${p.studentRight}`)
                        .join(" | ");

                    const allGood = pairsReview.every(
                        (p) => norm(p.studentRight) === norm(p.correctRight)
                    );
                    correctFlag = allGood;
                }

                return {
                    section: sec.name,
                    number: q.number,
                    type: q.type,
                    // For FILL_BLOCK we don't really have q.prompt,
                    // so fall back to blockText or prompt
                    prompt: q.prompt || q.blockText || "(không có nội dung)",
                    chosen: chosenDisplay || "—",
                    correctAnswer: correctAnswerDisplay || "—",
                    correct: !!correctFlag,
                    explanationHtml: q.explanationHtml || "",
                    blanksReview,
                    pairsReview,
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

        // --------------------------------------------------
        // Response for MockReviewPage
        // --------------------------------------------------
        res.json({
            testId: test._id,
            title: test.title || "",
            description: test.description || "",
            finishedAt: sub.finishedAt,
            sectionScores: sub.sectionScores || [],
            totalCorrect: sub.totalCorrect ?? 0,
            totalQuestions: sub.totalQuestions ?? 0,
            items,
        });
    } catch (e) {
        console.error("Review failed:", e);
        res.status(500).json({ error: "Failed to load review" });
    }
});


/* ---------------------------------------------------------
   ADMIN: scoreboard list (results overview for all students)
   --------------------------------------------------------- */
router.get(
    "/admin/results",
    authRequired,
    requireRole("admin"),
    async (_req, res) => {
        try {
            // gather all submissions
            const subs = await MockSubmission.find({})
                .sort({ finishedAt: -1 })
                .populate("student", "name email role")
                .populate("test", "title description")
                .lean();

            const rows = subs.map((s) => ({
                submissionId: s._id,
                testId: s.test?._id,
                testTitle: s.test?.title || "(đề đã xoá?)",
                studentId: s.student?._id,
                studentName: s.student?.name || "Unknown",
                studentEmail: s.student?.email || "",
                finishedAt: s.finishedAt,
                totalCorrect: s.totalCorrect ?? 0,
                totalQuestions: s.totalQuestions ?? 0,
                sectionScores: s.sectionScores || [],
            }));

            res.json({ ok: true, results: rows });
        } catch (err) {
            console.error("admin/results failed:", err);
            res
                .status(500)
                .json({ error: "Failed to load results." });
        }
    }
);

/* ---------------------------------------------------------
   ADMIN: single submission detail
   --------------------------------------------------------- */
router.get(
    "/admin/results/:submissionId",
    authRequired,
    requireRole("admin"),
    async (req, res) => {
        try {
            const { submissionId } = req.params;

            const sub = await MockSubmission.findById(submissionId)
                .populate("student", "name email role")
                .populate("test")
                .lean();

            if (!sub)
                return res
                    .status(404)
                    .json({ error: "Submission not found" });
            const test = sub.test;
            if (!test)
                return res
                    .status(404)
                    .json({ error: "Test not found for submission" });

            // Similar to review() but admin doesn't need per-blank notes
            // We'll reuse logic quickly:
            const questionIndex = {};
            for (const sec of test.sections || []) {
                for (const g of sec.groups || []) {
                    for (const q of g.questions || []) {
                        questionIndex[`${sec.name}#${q.number}`] = {
                            sec,
                            group: g,
                            q,
                        };
                    }
                }
            }

            const answersDetailed = (sub.answers || []).map((a) => {
                const ref = questionIndex[`${a.section}#${a.number}`];
                if (!ref) {
                    return {
                        section: a.section,
                        number: a.number,
                        prompt: "(Câu hỏi không còn tồn tại)",
                        correct: false,
                        chosen: a.choice ?? "",
                    };
                }
                return {
                    section: ref.sec.name,
                    number: ref.q.number,
                    prompt: ref.q.prompt || ref.q.blockText || "",
                    type: ref.q.type,
                    chosen: a.choice ?? "",
                    correct: !!a.correct,
                };
            });

            res.json({
                ok: true,
                submissionId: sub._id,
                student: {
                    id: sub.student?._id,
                    name: sub.student?.name || "",
                    email: sub.student?.email || "",
                },
                test: {
                    id: test._id,
                    title: test.title || "",
                },
                finishedAt: sub.finishedAt,
                totalCorrect: sub.totalCorrect ?? 0,
                totalQuestions: sub.totalQuestions ?? 0,
                sectionScores: sub.sectionScores || [],
                answers: answersDetailed,
            });
        } catch (e) {
            console.error("admin/results/:submissionId failed:", e);
            res
                .status(500)
                .json({
                    error: "Failed to load submission detail.",
                });
        }
    }
);

export default router;

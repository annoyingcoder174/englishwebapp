// server/src/routes/mocktests.js
import express from "express";
import mongoose from "mongoose";
import MockTest from "../models/MockTest.js";
import MockSubmission from "../models/MockSubmission.js";
import { authRequired, requireRole } from "../middleware/auth.js";

const router = express.Router();

// ---------------------------------------------
// helpers
// ---------------------------------------------
const isId = (id) => mongoose.Types.ObjectId.isValid(id);
const norm = (v) =>
    typeof v === "string" ? v.trim().toUpperCase() : "";

/**
 * normalizeSections()
 * We take whatever the client sends (Builder or QuickCreate)
 * and coerce it into the canonical structure we store in Mongo.
 *
 * Each section has:
 *  - name ("Listening" | "Reading")
 *  - part (number)
 *  - durationMinutes
 *  - linear (boolean)
 *  - groups: [{
 *        title, instructions, passageHtml, imageUrl, audioUrl,
 *        questions: [{
 *            number,
 *            type: "MCQ"|"TFNG"|"FILL"|"FILL_BLOCK"|"MATCH"
 *            prompt,
 *            options: [{key,text}]            // MCQ
 *            answer,                          // MCQ or FILL
 *            tfngAnswer,                      // TFNG
 *            blockText,                       // FILL_BLOCK
 *            blanks: [{slotNumber,correctAnswer,limit,explain}]
 *            pairs:  [{left,rightAnswer}]     // MATCH
 *            explanationHtml
 *        }]
 *    }]
 */
function normalizeSections(sections = []) {
    return (sections || []).map((sec) => ({
        name: sec?.name || "Reading",
        part: Number(sec?.part) || 1,
        durationMinutes:
            Number(sec?.durationMinutes) ||
            (sec?.name === "Listening" ? 45 : 75),
        linear: !!sec?.linear,
        groups: (sec?.groups || []).map((g) => ({
            title: g?.title || "",
            instructions: g?.instructions || "",
            passageHtml: g?.passageHtml || "", // HTML string from builder textarea
            imageUrl: g?.imageUrl || "",
            audioUrl: g?.audioUrl || "",
            questions: (g?.questions || []).map((q) => ({
                number: Number(q?.number) || 0,
                type: q?.type || "MCQ",

                prompt: q?.prompt || "",

                // MCQ
                options: Array.isArray(q?.options)
                    ? q.options.map((o) => ({
                        key: o?.key,
                        text: o?.text || "",
                    }))
                    : [],

                answer: q?.answer || "", // also used by "FILL"

                // TFNG
                tfngAnswer: q?.tfngAnswer || "",

                // Long passage fill-with-many-blanks
                blockText: q?.blockText || "",
                blanks: Array.isArray(q?.blanks)
                    ? q.blanks.map((b) => ({
                        // accept both slotNumber / slot
                        slotNumber:
                            Number(
                                b?.slotNumber !== undefined
                                    ? b.slotNumber
                                    : b?.slot
                            ) || 0,
                        correctAnswer:
                            b?.correctAnswer ??
                            b?.answer ??
                            "",
                        limit: b?.limit || "ONE WORD ONLY",
                        // IMPORTANT:
                        // "explain" is teacher's explanation for this blank,
                        // shown *after submit*, not during the test
                        explain: b?.explain || b?.note || "",
                    }))
                    : [],

                // Matching
                pairs: Array.isArray(q?.pairs)
                    ? q.pairs.map((p) => ({
                        left: p?.left || "",
                        rightAnswer:
                            p?.rightAnswer ??
                            p?.right ??
                            "",
                    }))
                    : [],

                // generic explanation (after submit)
                explanationHtml: q?.explanationHtml || "",
            })),
        })),
    }));
}

/**
 * checkVisibilityForUser(testDoc, user)
 * returns true if a given student user can see/take this test.
 *
 * test.visibility:
 *   "all"         -> allow all
 *   "allow-list"  -> only emails/ids in allowedStudents
 *   "block-list"  -> everyone except those in blockedStudents
 */
function checkVisibilityForUser(testDoc, user) {
    if (!testDoc) return false;
    const mode = testDoc.visibility || "all";

    // gather possible identifiers for matching
    const idStr = String(user?._id || user?.id || "");
    const emailStr = String(user?.email || "").toLowerCase();

    const allowedList =
        testDoc.allowedStudents?.map((s) => String(s).toLowerCase()) ||
        [];
    const blockedList =
        testDoc.blockedStudents?.map((s) =>
            String(s).toLowerCase()
        ) || [];

    if (mode === "all") {
        // any student allowed unless explicitly blocked?
        if (blockedList.includes(idStr.toLowerCase())) return false;
        if (blockedList.includes(emailStr)) return false;
        return true;
    }

    if (mode === "allow-list") {
        // must appear in allowedStudents
        return (
            allowedList.includes(idStr.toLowerCase()) ||
            allowedList.includes(emailStr)
        );
    }

    if (mode === "block-list") {
        // allowed UNLESS in blockedStudents
        if (blockedList.includes(idStr.toLowerCase())) return false;
        if (blockedList.includes(emailStr)) return false;
        return true;
    }

    // default fallback
    return true;
}
// QUICK CREATE (admin fast bulk create 1 section/1 group)
// body {
//   title, description,
//   sectionName, part, durationMinutes, linear,
//   groups: [ { title, instructions, passageHtml, imageUrl, audioUrl, questions: [...] } ],
//   visibility, allowedStudents, blockedStudents
// }
router.post(
    "/quick-create",
    authRequired,
    requireRole("admin"),
    async (req, res) => {
        try {
            const {
                title,
                description = "",
                sectionName = "Reading",
                part = 1,
                durationMinutes = 60,
                linear = false,
                groups = [],
                visibility = "all",
                allowedStudents = [],
                blockedStudents = [],
            } = req.body;

            if (!title || !groups.length) {
                return res
                    .status(400)
                    .json({ error: "Thiếu tiêu đề hoặc chưa có group/câu hỏi." });
            }

            // MASSAGE questions to ensure structure is correct
            const normGroups = groups.map((g) => ({
                title: g.title || "",
                instructions: g.instructions || "",
                passageHtml: g.passageHtml || "",
                imageUrl: g.imageUrl || "",
                audioUrl: g.audioUrl || "",
                questions: Array.isArray(g.questions)
                    ? g.questions.map((q) => ({
                        number: Number(q.number) || 0,
                        type: q.type || "MCQ",
                        prompt: q.prompt || "",
                        // MCQ options
                        options: Array.isArray(q.options)
                            ? q.options.map((o) => ({
                                key: o.key,
                                text: o.text || "",
                            }))
                            : [],
                        answer: q.answer || "",
                        tfngAnswer: q.tfngAnswer || "",
                        blanks: Array.isArray(q.blanks)
                            ? q.blanks.map((b) => ({
                                slotNumber: Number(b.slotNumber) || 0,
                                correctAnswer: b.correctAnswer || "",
                                limit: b.limit || "ONE WORD ONLY",
                                explain: b.explain || "",
                            }))
                            : [],
                        pairs: Array.isArray(q.pairs)
                            ? q.pairs.map((p) => ({
                                left: p.left || "",
                                rightAnswer: p.rightAnswer || "",
                            }))
                            : [],
                        explanationHtml: q.explanationHtml || "",
                    }))
                    : [],
            }));

            // Build exactly ONE section from this data
            const sectionDoc = {
                name: sectionName || "Reading",
                part: Number(part) || 1,
                durationMinutes: Number(durationMinutes) || 60,
                linear: !!linear,
                groups: normGroups,
            };

            // Insert as new MockTest
            const created = await MockTest.create({
                title,
                description,
                sections: [sectionDoc],
                visibility: visibility || "all",
                allowedStudents: allowedStudents || [],
                blockedStudents: blockedStudents || [],
                createdBy: req.user.id,
            });

            return res.json({
                ok: true,
                testId: created._id,
            });
        } catch (err) {
            console.error("POST /mocktests/quick-create failed:", err);
            return res.status(500).json({
                error: "Failed to quick-create test",
                detail: err.message,
            });
        }
    }
);

// ===========================================================
// ADMIN: create/update test from full MockBuilder
// route: POST /api/mocktests/build
// body: {_id?, title, description, sections[], visibility, allowedStudents[], blockedStudents[]}
// ===========================================================
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
            } = req.body || {};

            if (!title || !sections.length) {
                return res.status(400).json({
                    error:
                        "Thiếu tiêu đề hoặc không có phần nào trong đề.",
                });
            }

            const normSections = normalizeSections(sections);

            let doc;
            if (_id && isId(_id)) {
                // edit existing
                doc = await MockTest.findByIdAndUpdate(
                    _id,
                    {
                        title,
                        description,
                        sections: normSections,
                        visibility: visibility || "all",
                        allowedStudents: allowedStudents || [],
                        blockedStudents: blockedStudents || [],
                    },
                    { new: true }
                );
            } else {
                // create new
                doc = await MockTest.create({
                    title,
                    description,
                    sections: normSections,
                    visibility: visibility || "all",
                    allowedStudents: allowedStudents || [],
                    blockedStudents: blockedStudents || [],
                    createdBy: req.user.id,
                });
            }

            return res.json({
                ok: true,
                testId: doc._id,
            });
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

// ===========================================================
// ADMIN: QuickCreate -> make a test fast
// route: POST /api/mocktests/quick-create
// Body supports 2 shapes:
//   A) { title, description, sections:[...] }  // already structured
//   B) {
//        title, description,
//        sectionName, part, durationMinutes, linear, groups: [...],
//        visibility, allowedStudents, blockedStudents
//      }
// ===========================================================
router.post(
    "/quick-create",
    authRequired,
    requireRole("admin"),
    async (req, res) => {
        try {
            const {
                title,
                description = "",
                sections, // optional pre-structured
                sectionName = "Reading",
                part = 5,
                durationMinutes = 25,
                linear = false,
                groups = [],
                visibility = "all",
                allowedStudents = [],
                blockedStudents = [],
            } = req.body || {};

            if (!title) {
                return res
                    .status(400)
                    .json({ error: "Thiếu tiêu đề" });
            }

            let finalSections;
            if (Array.isArray(sections) && sections.length) {
                // dev gave us final shape already
                finalSections = normalizeSections(sections);
            } else {
                // build a single section from flat quick-create form
                finalSections = normalizeSections([
                    {
                        name: sectionName,
                        part,
                        durationMinutes,
                        linear,
                        groups,
                    },
                ]);
            }

            const doc = await MockTest.create({
                title,
                description,
                sections: finalSections,
                visibility: visibility || "all",
                allowedStudents: allowedStudents || [],
                blockedStudents: blockedStudents || [],
                createdBy: req.user.id,
            });

            return res.json({ ok: true, testId: doc._id });
        } catch (err) {
            console.error(
                "mocktests/quick-create failed:",
                err
            );
            return res.status(500).json({
                error: "Failed to quick-create test",
                detail: err.message,
            });
        }
    }
);

// ===========================================================
// ADMIN: list tests for /admin/tests
// route: GET /api/mocktests/admin/list
// ===========================================================
router.get(
    "/admin/list",
    authRequired,
    requireRole("admin"),
    async (_req, res) => {
        try {
            const tests = await MockTest.find({})
                .select(
                    "title description createdAt sections visibility allowedStudents blockedStudents"
                )
                .sort({ createdAt: -1 })
                .lean();

            const list = tests.map((t) => ({
                _id: t._id,
                title: t.title || "(không tiêu đề)",
                description: t.description || "",
                createdAt: t.createdAt,
                parts: (t.sections || []).map((sec) => ({
                    name: sec.name,
                    part: sec.part,
                    qCount: (sec.groups || []).reduce(
                        (acc, g) =>
                            acc + (g.questions?.length || 0),
                        0
                    ),
                })),
                visibility: t.visibility || "all",
                allowedStudents: t.allowedStudents || [],
                blockedStudents: t.blockedStudents || [],
            }));

            res.json({ ok: true, tests: list });
        } catch (err) {
            console.error(
                "GET /mocktests/admin/list failed:",
                err
            );
            res
                .status(500)
                .json({ error: "Cannot list tests" });
        }
    }
);

// ===========================================================
// ADMIN: delete a test
// route: DELETE /api/mocktests/admin/:testId
// ALSO delete all submissions for that test, to keep admin "Results" clean
// ===========================================================
router.delete(
    "/admin/:testId",
    authRequired,
    requireRole("admin"),
    async (req, res) => {
        try {
            const { testId } = req.params;
            if (!isId(testId)) {
                return res
                    .status(400)
                    .json({ error: "Bad testId" });
            }

            await MockTest.findByIdAndDelete(testId);
            await MockSubmission.deleteMany({
                test: testId,
            });

            res.json({ ok: true });
        } catch (err) {
            console.error(
                "DELETE /mocktests/admin/:testId failed:",
                err
            );
            res.status(500).json({
                error: "Cannot delete test",
            });
        }
    }
);

// ===========================================================
// STUDENT: list available tests
// route: GET /api/mocktests
// Only return tests this user is allowed to see based on visibility rules
// ===========================================================
router.get(
    "/",
    authRequired,
    async (req, res) => {
        try {
            const tests = await MockTest.find({})
                .select(
                    "title description createdAt visibility allowedStudents blockedStudents sections"
                )
                .sort({ createdAt: -1 })
                .lean();

            // apply visibility filter for this user
            const visible = tests.filter((t) =>
                checkVisibilityForUser(t, req.user)
            );

            // Return trimmed data
            const out = visible.map((t) => ({
                _id: t._id,
                title: t.title,
                description: t.description,
                createdAt: t.createdAt,
            }));

            res.json(out);
        } catch (e) {
            console.error("List tests failed:", e);
            res.status(500).json({
                error: "Failed to list tests",
            });
        }
    }
);

// ===========================================================
// STUDENT: get full test by id (for runner)
// route: GET /api/mocktests/:id
// also enforces visibility
// ===========================================================
router.get(
    "/:id",
    authRequired,
    async (req, res) => {
        try {
            if (!isId(req.params.id)) {
                return res
                    .status(400)
                    .json({ error: "Bad id" });
            }

            const test = await MockTest.findById(
                req.params.id
            ).lean();
            if (!test) {
                return res
                    .status(404)
                    .json({ error: "Not found" });
            }

            // visibility check
            if (
                !checkVisibilityForUser(test, req.user)
            ) {
                return res.status(403).json({
                    error:
                        "Bạn không có quyền truy cập đề này.",
                });
            }

            res.json(test);
        } catch (e) {
            console.error("Get test failed:", e);
            res.status(500).json({
                error: "Failed to get test",
            });
        }
    }
);

// ===========================================================
// STUDENT: ensure submission exists (start test)
// route: POST /api/mocktests/:id/start
// creates MockSubmission if missing
// { test:<ObjectId>, student:<ObjectId>, answers:[], startedAt }
// ===========================================================
router.post(
    "/:id/start",
    authRequired,
    async (req, res) => {
        try {
            if (!isId(req.params.id)) {
                return res
                    .status(400)
                    .json({ error: "Bad id" });
            }

            const test = await MockTest.findById(
                req.params.id
            )
                .select(
                    "_id visibility allowedStudents blockedStudents"
                )
                .lean();

            if (!test) {
                return res
                    .status(404)
                    .json({ error: "Test not found" });
            }

            // must still have access
            if (
                !checkVisibilityForUser(test, req.user)
            ) {
                return res.status(403).json({
                    error:
                        "Không tạo được phiên làm bài. Có thể đề đã bị xoá hoặc bạn không còn quyền truy cập.",
                });
            }

            let sub =
                await MockSubmission.findOne({
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
                totalCorrect:
                    sub.totalCorrect ?? 0,
                totalQuestions:
                    sub.totalQuestions ?? 0,
                sectionScores:
                    sub.sectionScores ?? [],
            });
        } catch (e) {
            console.error("Start failed:", e);
            res.status(500).json({
                error:
                    "Không tạo được phiên làm bài. Có thể đề đã bị xoá hoặc bạn không còn quyền truy cập.",
            });
        }
    }
);

// ===========================================================
// STUDENT: get submission (autosave state)
// route: GET /api/mocktests/:id/submission
// ===========================================================
router.get(
    "/:id/submission",
    authRequired,
    async (req, res) => {
        try {
            if (!isId(req.params.id)) {
                return res
                    .status(400)
                    .json({ error: "Bad id" });
            }

            const sub =
                await MockSubmission.findOne({
                    test: req.params.id,
                    student: req.user.id,
                }).lean();

            if (!sub) return res.json(null);

            res.json({
                _id: sub._id,
                startedAt: sub.startedAt,
                finishedAt: sub.finishedAt,
                answers: sub.answers ?? [],
                sectionScores:
                    sub.sectionScores ?? [],
                totalCorrect:
                    sub.totalCorrect ?? 0,
                totalQuestions:
                    sub.totalQuestions ?? 0,
            });
        } catch (e) {
            console.error(
                "Get submission failed:",
                e
            );
            res.status(500).json({
                error: "Failed to get submission",
            });
        }
    }
);

// ===========================================================
// STUDENT: autosave answer
// route: POST /api/mocktests/:id/answer
// body: { section, number, choice }
// This does LIGHT autograding for immediate feedback
// ===========================================================
router.post(
    "/:id/answer",
    authRequired,
    async (req, res) => {
        try {
            const { section, number, choice } =
                req.body || {};

            if (!isId(req.params.id))
                return res
                    .status(400)
                    .json({ error: "Bad id" });
            if (
                !section ||
                typeof number !== "number"
            )
                return res.status(400).json({
                    error: "Missing fields",
                });

            const test =
                await MockTest.findById(
                    req.params.id
                ).lean();
            if (!test)
                return res
                    .status(404)
                    .json({ error: "Test not found" });

            // (optional) enforce visibility again (prevents abuse if test later restricted)
            if (
                !checkVisibilityForUser(
                    test,
                    req.user
                )
            ) {
                return res.status(403).json({
                    error:
                        "Không có quyền nộp câu trả lời cho đề này.",
                });
            }

            // find that section
            const sec = test.sections?.find(
                (s) => s.name === section
            );
            if (!sec)
                return res
                    .status(400)
                    .json({ error: "Bad section" });

            // flatten all questions
            const allQs = sec.groups.flatMap(
                (g) => g.questions || []
            );
            const q = allQs.find(
                (x) => x.number === number
            );
            if (!q)
                return res
                    .status(400)
                    .json({ error: "Bad number" });

            // immediate grading guess
            let correctFlag = false;
            if (q.type === "MCQ") {
                correctFlag =
                    norm(String(choice ?? "")) ===
                    norm(String(q.answer ?? ""));
            } else if (q.type === "TFNG") {
                correctFlag =
                    norm(String(choice ?? "")) ===
                    norm(String(q.tfngAnswer ?? ""));
            } else if (q.type === "FILL") {
                correctFlag =
                    norm(String(choice ?? "")) ===
                    norm(String(q.answer ?? ""));
            } else if (q.type === "FILL_BLOCK") {
                // choice might be combined multi-slot string
                // We'll do a rough full-match check for all blanks
                if (
                    typeof choice === "object" &&
                    choice !== null
                ) {
                    // {slotNumber: "ans", ...}
                    correctFlag = (q.blanks || []).every(
                        (b) => {
                            const userAns = norm(
                                String(choice[b.slotNumber] || "")
                            );
                            const keyAns = norm(
                                String(b.correctAnswer || "")
                            );
                            return userAns === keyAns;
                        }
                    );
                } else if (typeof choice === "string") {
                    // (legacy packing) "1=dog||2=play"
                    const map = {};
                    choice
                        .split("||")
                        .forEach((part) => {
                            const [slotStr, ans] =
                                part.split("=");
                            if (
                                slotStr &&
                                ans !== undefined
                            ) {
                                map[slotStr.trim()] = ans;
                            }
                        });
                    correctFlag = (q.blanks || []).every(
                        (b) => {
                            const userAns = norm(
                                String(
                                    map[
                                    String(
                                        b.slotNumber
                                    )
                                    ] || ""
                                )
                            );
                            const keyAns = norm(
                                String(b.correctAnswer || "")
                            );
                            return userAns === keyAns;
                        }
                    );
                }
            } else if (q.type === "MATCH") {
                // not auto-grading matching now
                correctFlag = false;
            }

            // ensure submission doc
            let sub =
                await MockSubmission.findOne({
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

            // upsert answer
            const idx = sub.answers.findIndex(
                (a) =>
                    a.section === section &&
                    a.number === number
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
            res.json({
                ok: true,
                correct: !!correctFlag,
            });
        } catch (e) {
            console.error(
                "Save answer failed:",
                e
            );
            res.status(500).json({
                error: "Failed to save answer",
            });
        }
    }
);

// ===========================================================
// STUDENT: finish test -> score it
// route: POST /api/mocktests/:id/finish
// calculates per-section + totalCorrect, saves into submission
// ===========================================================
router.post(
    "/:id/finish",
    authRequired,
    async (req, res) => {
        try {
            if (!isId(req.params.id)) {
                return res
                    .status(400)
                    .json({ error: "Bad id" });
            }

            const test =
                await MockTest.findById(
                    req.params.id
                ).lean();
            if (!test)
                return res
                    .status(404)
                    .json({ error: "Test not found" });

            const sub =
                await MockSubmission.findOne({
                    test: test._id,
                    student: req.user.id,
                });
            if (!sub)
                return res
                    .status(400)
                    .json({ error: "No answers" });

            const sectionScores = [];
            let totalCorrect = 0;
            let totalQuestions = 0;

            for (const sec of test.sections ||
                []) {
                const secQs = sec.groups.flatMap(
                    (g) => g.questions || []
                );
                const total = secQs.length;
                totalQuestions += total;

                // make key map "number => canonical answer info"
                const key = new Map(
                    secQs.map((q) => {
                        if (q.type === "MCQ") {
                            return [
                                q.number,
                                norm(String(q.answer || "")),
                            ];
                        }
                        if (q.type === "TFNG") {
                            return [
                                q.number,
                                norm(
                                    String(
                                        q.tfngAnswer || ""
                                    )
                                ),
                            ];
                        }
                        if (
                            q.type ===
                            "FILL"
                        ) {
                            return [
                                q.number,
                                norm(String(q.answer || "")),
                            ];
                        }
                        if (
                            q.type ===
                            "FILL_BLOCK"
                        ) {
                            // store entire question object to compare blanks
                            return [q.number, q];
                        }
                        if (
                            q.type ===
                            "MATCH"
                        ) {
                            return [q.number, q];
                        }
                        return [q.number, q];
                    })
                );

                let correctCount = 0;
                for (const ans of sub.answers.filter(
                    (a) => a.section === sec.name
                )) {
                    const canonical = key.get(
                        ans.number
                    );
                    if (!canonical) continue;

                    if (
                        typeof canonical ===
                        "string"
                    ) {
                        // MCQ / TFNG / FILL
                        if (
                            norm(
                                String(
                                    ans.choice ?? ""
                                )
                            ) === canonical
                        ) {
                            correctCount += 1;
                        }
                    } else if (
                        typeof canonical ===
                        "object"
                    ) {
                        const q = canonical;
                        if (
                            q.type ===
                            "FILL_BLOCK"
                        ) {
                            // ans.choice might be object or packed string
                            if (
                                typeof ans.choice ===
                                "object" &&
                                ans.choice !== null
                            ) {
                                const allOk = (
                                    q.blanks || []
                                ).every((b) => {
                                    const userAns =
                                        norm(
                                            String(
                                                ans.choice[
                                                b
                                                    .slotNumber
                                                ] || ""
                                            )
                                        );
                                    const keyAns =
                                        norm(
                                            String(
                                                b.correctAnswer ||
                                                ""
                                            )
                                        );
                                    return (
                                        userAns ===
                                        keyAns
                                    );
                                });
                                if (allOk)
                                    correctCount += 1;
                            } else if (
                                typeof ans.choice ===
                                "string"
                            ) {
                                // legacy "1=dog||2=play"
                                const map = {};
                                ans.choice
                                    .split("||")
                                    .forEach(
                                        (
                                            chunk
                                        ) => {
                                            const [
                                                L,
                                                R,
                                            ] =
                                                chunk.split(
                                                    "=>"
                                                )
                                                    .length ===
                                                    2
                                                    ? chunk.split(
                                                        "=>"
                                                    )
                                                    : chunk.split(
                                                        "="
                                                    );
                                            if (
                                                L &&
                                                R !==
                                                undefined
                                            ) {
                                                map[
                                                    L.trim()
                                                ] = R;
                                            }
                                        }
                                    );
                                const allOk = (
                                    q.blanks || []
                                ).every((b) => {
                                    const userAns =
                                        norm(
                                            String(
                                                map[
                                                String(
                                                    b.slotNumber
                                                )
                                                ] || ""
                                            )
                                        );
                                    const keyAns =
                                        norm(
                                            String(
                                                b.correctAnswer ||
                                                ""
                                            )
                                        );
                                    return (
                                        userAns ===
                                        keyAns
                                    );
                                });
                                if (allOk)
                                    correctCount += 1;
                            }
                        } else if (
                            q.type ===
                            "MATCH"
                        ) {
                            // skipping auto-score for MATCH
                        }
                    }
                }

                totalCorrect += correctCount;
                const pct = total
                    ? Math.round(
                        (correctCount /
                            total) *
                        100
                    )
                    : 0;

                sectionScores.push({
                    section: sec.name,
                    correct: correctCount,
                    total,
                    percentage: pct,
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
            res.status(500).json({
                error: "Failed to finish test",
            });
        }
    }
);

// ===========================================================
// STUDENT: review page data
// route: GET /api/mocktests/:id/review
// returns:
//   test info (title, description, ...)
//   sub info (scores, finishedAt)
//   items[] with per-question detail:
//        - prompt
//        - chosen answer
//        - correct answer
//        - correct flag
//        - explanationHtml (for MCQ/TFNG/FILL etc.)
//        - group context (passageHtml, instructions, etc.)
// Only allowed if the user finished the submission.
// ===========================================================
router.get(
    "/:id/review",
    authRequired,
    async (req, res) => {
        try {
            if (!isId(req.params.id)) {
                return res
                    .status(400)
                    .json({ error: "Bad id" });
            }

            const [test, sub] =
                await Promise.all([
                    MockTest.findById(
                        req.params.id
                    ).lean(),
                    MockSubmission.findOne({
                        test: req.params.id,
                        student: req.user.id,
                    }).lean(),
                ]);

            if (!test) {
                return res
                    .status(404)
                    .json({ error: "Test not found" });
            }
            if (
                !sub ||
                !sub.finishedAt
            ) {
                return res.status(400).json({
                    error:
                        "Chưa có kết quả. Có thể bạn chưa nộp bài.",
                });
            }

            // Build a quick lookup of questions
            // index["Reading#12"] = { q, group, sec }
            const indexMap = {};
            for (const sec of test.sections ||
                []) {
                for (const g of sec.groups ||
                    []) {
                    for (const q of g.questions ||
                        []) {
                        indexMap[
                            `${sec.name}#${q.number}`
                        ] = { q, group: g, sec };
                    }
                }
            }

            // items sorted by question number
            const items = (sub.answers ||
                [])
                .sort(
                    (a, b) =>
                        (a.number || 0) -
                        (b.number || 0)
                )
                .map((a) => {
                    // find the original question + context
                    const key = `${a.section}#${a.number}`;
                    const hit = indexMap[key];
                    if (!hit) {
                        return {
                            section: a.section,
                            number: a.number,
                            prompt:
                                "(Câu hỏi không còn tồn tại)",
                            type: "",
                            options: [],
                            correctAnswer: "",
                            chosen: a.choice ?? "",
                            correct: false,
                            explanationHtml: "",
                            group: {},
                        };
                    }

                    const {
                        q,
                        group,
                        sec,
                    } = hit;

                    // Display "correct answer" by type
                    let correctAnswerDisplay =
                        "";
                    if (q.type === "MCQ") {
                        correctAnswerDisplay =
                            q.answer || "";
                    } else if (
                        q.type === "TFNG"
                    ) {
                        correctAnswerDisplay =
                            q.tfngAnswer ||
                            "";
                    } else if (
                        q.type === "FILL"
                    ) {
                        correctAnswerDisplay =
                            q.answer || "";
                    } else if (
                        q.type ===
                        "FILL_BLOCK"
                    ) {
                        // join blanks into "slot:answer"
                        correctAnswerDisplay = (
                            q.blanks || []
                        )
                            .map(
                                (b) =>
                                    `${b.slotNumber}: ${b.correctAnswer}`
                            )
                            .join(" | ");
                    } else if (
                        q.type ===
                        "MATCH"
                    ) {
                        correctAnswerDisplay =
                            "(xem pairs)";
                    }

                    return {
                        section:
                            sec.name,
                        number:
                            q.number,
                        type: q.type,
                        prompt:
                            q.prompt,
                        options:
                            q.options ||
                            [],
                        correctAnswer:
                            correctAnswerDisplay,
                        chosen:
                            a.choice ??
                            "",
                        correct:
                            !!a.correct,
                        explanationHtml:
                            q.explanationHtml ||
                            "",
                        group: {
                            title:
                                group.title ||
                                "",
                            instructions:
                                group.instructions ||
                                "",
                            passageHtml:
                                group.passageHtml ||
                                "",
                            imageUrl:
                                group.imageUrl ||
                                "",
                            audioUrl:
                                group.audioUrl ||
                                "",
                            part: sec.part,
                        },
                    };
                });

            res.json({
                testId: test._id,
                title:
                    test.title ||
                    "",
                description:
                    test.description ||
                    "",
                sectionScores:
                    sub.sectionScores ||
                    [],
                totalCorrect:
                    sub.totalCorrect ??
                    0,
                totalQuestions:
                    sub.totalQuestions ??
                    0,
                finishedAt:
                    sub.finishedAt,
                items,
            });
        } catch (e) {
            console.error(
                "Review failed:",
                e
            );
            res.status(500).json({
                error: "Failed to load review",
            });
        }
    }
);

// ===========================================================
// ADMIN: all results dashboard
// route: GET /api/mocktests/admin/results
// returns list of submissions for all tests (finished & unfinished)
// ===========================================================
router.get(
    "/admin/results",
    authRequired,
    requireRole("admin"),
    async (_req, res) => {
        try {
            const subs = await MockSubmission.find(
                {}
            )
                .sort({ finishedAt: -1 })
                .populate(
                    "student",
                    "name email role"
                )
                .populate(
                    "test",
                    "title description"
                )
                .lean();

            const rows = subs.map(
                (s) => ({
                    submissionId: s._id,
                    testId: s.test?._id,
                    testTitle:
                        s.test?.title ||
                        "(đề đã xoá?)",
                    studentId:
                        s.student?._id,
                    studentName:
                        s.student
                            ?.name ||
                        "Unknown",
                    studentEmail:
                        s.student
                            ?.email ||
                        "",
                    finishedAt:
                        s.finishedAt,
                    totalCorrect:
                        s.totalCorrect ??
                        0,
                    totalQuestions:
                        s.totalQuestions ??
                        0,
                    sectionScores:
                        s.sectionScores ||
                        [],
                })
            );

            res.json({
                ok: true,
                results: rows,
            });
        } catch (err) {
            console.error(
                "admin/results failed:",
                err
            );
            res.status(500).json({
                error: "Failed to load results.",
            });
        }
    }
);

// ===========================================================
// ADMIN: single result detail
// route: GET /api/mocktests/admin/results/:submissionId
// basically admin version of /:id/review but can view ANY student
// ===========================================================
router.get(
    "/admin/results/:submissionId",
    authRequired,
    requireRole("admin"),
    async (req, res) => {
        try {
            const { submissionId } =
                req.params;

            const sub =
                await MockSubmission.findById(
                    submissionId
                )
                    .populate(
                        "student",
                        "name email role"
                    )
                    .populate("test")
                    .lean();

            if (!sub) {
                return res
                    .status(404)
                    .json({
                        error:
                            "Submission not found",
                    });
            }

            const test = sub.test;
            if (!test) {
                return res
                    .status(404)
                    .json({
                        error:
                            "Test not found for this submission",
                    });
            }

            // Build lookup again
            const indexMap = {};
            for (const sec of test.sections ||
                []) {
                for (const g of sec.groups ||
                    []) {
                    for (const q of g.questions ||
                        []) {
                        indexMap[
                            `${sec.name}#${q.number}`
                        ] = { q, group: g, sec };
                    }
                }
            }

            const items = (sub.answers ||
                [])
                .sort(
                    (a, b) =>
                        (a.number || 0) -
                        (b.number || 0)
                )
                .map((a) => {
                    const key = `${a.section}#${a.number}`;
                    const hit = indexMap[key];
                    if (!hit) {
                        return {
                            section:
                                a.section,
                            number:
                                a.number,
                            prompt:
                                "(Câu hỏi không còn tồn tại)",
                            type: "",
                            options: [],
                            correctAnswer: "",
                            chosen:
                                a.choice ??
                                "",
                            correct: false,
                            explanationHtml:
                                "",
                            group: {},
                        };
                    }
                    const {
                        q,
                        group,
                        sec,
                    } = hit;

                    let correctAnswerDisplay =
                        "";
                    if (q.type === "MCQ") {
                        correctAnswerDisplay =
                            q.answer || "";
                    } else if (
                        q.type === "TFNG"
                    ) {
                        correctAnswerDisplay =
                            q.tfngAnswer ||
                            "";
                    } else if (
                        q.type === "FILL"
                    ) {
                        correctAnswerDisplay =
                            q.answer || "";
                    } else if (
                        q.type ===
                        "FILL_BLOCK"
                    ) {
                        correctAnswerDisplay = (
                            q.blanks || []
                        )
                            .map(
                                (b) =>
                                    `${b.slotNumber}: ${b.correctAnswer}`
                            )
                            .join(" | ");
                    } else if (
                        q.type ===
                        "MATCH"
                    ) {
                        correctAnswerDisplay =
                            "(xem pairs)";
                    }

                    return {
                        section:
                            sec.name,
                        number:
                            q.number,
                        type: q.type,
                        prompt:
                            q.prompt,
                        options:
                            q.options ||
                            [],
                        correctAnswer:
                            correctAnswerDisplay,
                        chosen:
                            a.choice ??
                            "",
                        correct:
                            !!a.correct,
                        explanationHtml:
                            q.explanationHtml ||
                            "",
                        group: {
                            title:
                                group.title ||
                                "",
                            instructions:
                                group.instructions ||
                                "",
                            passageHtml:
                                group.passageHtml ||
                                "",
                            imageUrl:
                                group.imageUrl ||
                                "",
                            audioUrl:
                                group.audioUrl ||
                                "",
                            part: sec.part,
                        },
                    };
                });

            res.json({
                ok: true,
                submissionId:
                    sub._id,
                student: {
                    id: sub.student?._id,
                    name:
                        sub.student
                            ?.name || "",
                    email:
                        sub.student
                            ?.email || "",
                },
                test: {
                    id: test._id,
                    title:
                        test.title || "",
                },
                finishedAt:
                    sub.finishedAt,
                totalCorrect:
                    sub.totalCorrect ??
                    0,
                totalQuestions:
                    sub.totalQuestions ??
                    0,
                sectionScores:
                    sub.sectionScores ||
                    [],
                items,
            });
        } catch (e) {
            console.error(
                "admin/results/:submissionId failed:",
                e
            );
            res.status(500).json({
                error:
                    "Failed to load submission detail.",
            });
        }
    }
);

export default router;

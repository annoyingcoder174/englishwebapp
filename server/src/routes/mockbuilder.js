// UPDATE server/src/routes/mockbuilder.js
import express from "express";
import mongoose from "mongoose";
import MockTest from "../models/MockTest.js";
import { authRequired, requireRole } from "../middleware/auth.js";

const router = express.Router();
const isId = (id) => mongoose.Types.ObjectId.isValid(id);

/**
 * Validation rules per TOEIC part:
 * - Listening Part 1: each group MUST have imageUrl (ảnh mô tả).
 * - Listening Part 3 / 4: each group MUST have audioUrl (hội thoại / bài nói).
 * - Reading Part 6 / 7: each group MUST have passageHtml (đoạn văn/email/bài đọc).
 *
 * Also enforces each group has >=1 question, each question has prompt/options/answer.
 */
function validateSectionPartRules(section) {
    const { name, part, groups } = section;

    if (!Array.isArray(groups) || groups.length === 0) {
        throw new Error(
            `Phần ${name} Part ${part}: cần ít nhất 1 nhóm câu hỏi (groups).`
        );
    }

    groups.forEach((group, gi) => {
        // Listening constraints
        if (name === "Listening") {
            if (part === 1 && !group.imageUrl) {
                throw new Error(
                    `Listening Part 1 - Nhóm ${gi + 1}: thiếu imageUrl (ảnh mô tả tranh).`
                );
            }
            if ((part === 3 || part === 4) && !group.audioUrl) {
                throw new Error(
                    `Listening Part ${part} - Nhóm ${gi + 1}: thiếu audioUrl (file audio hội thoại/đoạn nói).`
                );
            }
        }

        // Reading constraints
        if (name === "Reading") {
            if ((part === 6 || part === 7) && !group.passageHtml) {
                throw new Error(
                    `Reading Part ${part} - Nhóm ${gi + 1}: thiếu passageHtml (đoạn văn / email / thông báo).`
                );
            }
        }

        if (!Array.isArray(group.questions) || group.questions.length === 0) {
            throw new Error(
                `Phần ${name} Part ${part} - Nhóm ${gi + 1}: cần ít nhất 1 câu hỏi.`
            );
        }

        group.questions.forEach((q, qi) => {
            if (
                typeof q.number !== "number" &&
                typeof q.number !== "string"
            ) {
                throw new Error(
                    `Câu hỏi ${qi + 1} trong Nhóm ${gi + 1} (Part ${part}): thiếu 'number'.`
                );
            }
            if (!q.prompt || !q.prompt.trim()) {
                throw new Error(
                    `Câu hỏi số ${q.number} trong Nhóm ${gi + 1} (Part ${part}): thiếu 'prompt'.`
                );
            }
            if (!Array.isArray(q.options) || q.options.length < 3) {
                throw new Error(
                    `Câu hỏi số ${q.number} trong Nhóm ${gi + 1} (Part ${part}): thiếu 'options'.`
                );
            }
            if (!q.answer || !q.answer.trim()) {
                throw new Error(
                    `Câu hỏi số ${q.number} trong Nhóm ${gi + 1} (Part ${part}): thiếu 'answer'.`
                );
            }
        });
    });
}

/**
 * Normalize/clean incoming payload from the frontend builder before saving.
 * Ensures structure matches MockTest schema.
 *
 * Expected req.body:
 * {
 *   title: String,
 *   description?: String,
 *   sections: [
 *     {
 *       name: "Listening" | "Reading",
 *       part: 1..7,
 *       durationMinutes: Number,
 *       linear: Boolean,
 *       groups: [
 *         {
 *           title?: String,
 *           instructions?: String,
 *           imageUrl?: String,
 *           audioUrl?: String,
 *           passageHtml?: String,
 *           questions: [
 *             {
 *               number: Number,
 *               prompt: String,
 *               type: "MCQ",
 *               options: [
 *                  { key:"A", text:"..." },
 *                  { key:"B", text:"..." },
 *                  ...
 *               ],
 *               answer: "A",
 *               explanationHtml?: String,
 *               tags?: [String]
 *             }
 *           ]
 *         }
 *       ]
 *     }
 *   ]
 * }
 */
function normalizePayload(body, userId) {
    if (!body || typeof body !== "object") {
        throw new Error("Payload không hợp lệ.");
    }
    const { title, description, sections } = body;

    if (!title || !title.trim()) {
        throw new Error("Thiếu tiêu đề đề thi (title).");
    }
    if (!Array.isArray(sections) || sections.length === 0) {
        throw new Error("Phải có ít nhất 1 phần (Listening / Reading).");
    }

    const cleanedSections = sections.map((secRaw) => {
        const sec = {
            name: secRaw.name === "Reading" ? "Reading" : "Listening",
            part: Number(secRaw.part),
            durationMinutes:
                Number(secRaw.durationMinutes) ||
                (secRaw.name === "Reading" ? 75 : 45),
            linear:
                typeof secRaw.linear === "boolean"
                    ? secRaw.linear
                    : secRaw.name !== "Reading", // Listening default true
            groups: Array.isArray(secRaw.groups) ? secRaw.groups : [],
        };

        // validate TOEIC rules per section
        validateSectionPartRules(sec);

        // cleanup each group/questions
        sec.groups = sec.groups.map((g) => ({
            title: g.title || "",
            instructions: g.instructions || "",
            imageUrl: g.imageUrl || "",
            audioUrl: g.audioUrl || "",
            passageHtml: g.passageHtml || "",
            questions: (g.questions || []).map((q) => ({
                number: Number(q.number),
                prompt: q.prompt || "",
                type: q.type || "MCQ",
                options: Array.isArray(q.options)
                    ? q.options.map((opt) => ({
                        key: opt.key,
                        text: opt.text || "",
                    }))
                    : [],
                answer: q.answer || "",
                explanationHtml: q.explanationHtml || "",
                tags: Array.isArray(q.tags)
                    ? q.tags.filter(Boolean)
                    : [],
                anchors: Array.isArray(q.anchors)
                    ? q.anchors.filter(Boolean)
                    : [],
            })),
        }));

        return sec;
    });

    return {
        title: title.trim(),
        description: description || "",
        sections: cleanedSections,
        createdBy: userId,
    };
}

/* ------------------------------------------------------------------------ */
/* POST /api/mockbuilder
   Create a brand new full TOEIC mock test (admin only)                     */
/* ------------------------------------------------------------------------ */
router.post("/", authRequired, requireRole("admin"), async (req, res) => {
    try {
        const normalized = normalizePayload(req.body, req.user.id);
        const test = await MockTest.create(normalized);
        res.status(201).json({
            message: "Tạo đề thi thành công.",
            testId: test._id,
            test,
        });
    } catch (e) {
        console.error("Create test failed:", e);
        res
            .status(400)
            .json({
                error:
                    e.message ||
                    "Không thể tạo đề thi. Vui lòng kiểm tra dữ liệu gửi lên.",
            });
    }
});

/* ------------------------------------------------------------------------ */
/* GET /api/mockbuilder/:id
   Fetch one test for editing (admin only)                                  */
/* ------------------------------------------------------------------------ */
router.get("/:id", authRequired, requireRole("admin"), async (req, res) => {
    try {
        if (!isId(req.params.id))
            return res.status(400).json({ error: "Bad id" });
        const doc = await MockTest.findById(req.params.id).lean();
        if (!doc) return res.status(404).json({ error: "Not found" });
        res.json(doc);
    } catch (e) {
        console.error("Get test (builder) failed:", e);
        res.status(500).json({ error: "Failed to get test" });
    }
});

/* ------------------------------------------------------------------------ */
/* PATCH /api/mockbuilder/:id
   Update an existing test (admin only)                                     */
/* ------------------------------------------------------------------------ */
router.patch("/:id", authRequired, requireRole("admin"), async (req, res) => {
    try {
        if (!isId(req.params.id))
            return res.status(400).json({ error: "Bad id" });

        // If sections are included in the patch body, validate them.
        let updateDoc = { ...req.body };
        if (req.body.sections) {
            const normalized = normalizePayload(
                { ...req.body, title: req.body.title || "TEMP" },
                req.user.id
            );
            // Don't overwrite createdBy on patch; we just want validated shape
            updateDoc.sections = normalized.sections;
        }

        const updated = await MockTest.findByIdAndUpdate(
            req.params.id,
            { $set: updateDoc },
            { new: true, runValidators: true }
        );

        if (!updated) return res.status(404).json({ error: "Not found" });
        res.json(updated);
    } catch (e) {
        console.error("Update test failed:", e);
        res.status(400).json({ error: e.message || "Failed to update test" });
    }
});

export default router;

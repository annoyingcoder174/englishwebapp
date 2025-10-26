import express from "express";
import multer from "multer";
import { parse } from "csv-parse/sync";
import MockTest from "../models/MockTest.js";
import { authRequired, requireRole } from "../middleware/auth.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const up = (v) => (typeof v === "string" ? v.trim().toUpperCase() : "");
const isTF = (v) => {
    const s = up(v);
    if (["TRUE", "T", "ĐÚNG", "DUNG", "ĐUNG"].includes(s)) return "TRUE";
    if (["FALSE", "F", "SAI"].includes(s)) return "FALSE";
    return s;
};

router.post(
    "/import-csv",
    authRequired,
    requireRole("admin"),
    upload.single("file"),
    async (req, res) => {
        try {
            if (!req.file) return res.status(400).json({ error: "No file" });

            const csv = req.file.buffer.toString("utf8");
            const rows = parse(csv, { columns: true, skip_empty_lines: true });

            const testTitle =
                (rows.find((r) => r.title)?.title || req.body.title || "TOEIC Mock");

            // Prepare containers by section name (case-insensitive)
            const sectionsMap = new Map(); // key = lower(section), value = { name, durationSec, groups: [] }

            // group structure map: sections -> groupId -> group
            const groupMap = new Map(); // key = sectionLower + "::" + groupId

            for (const r of rows) {
                const sectionRaw = r.section || "";
                const sectionLower = String(sectionRaw).toLowerCase();
                if (!sectionLower) continue;

                if (!sectionsMap.has(sectionLower)) {
                    sectionsMap.set(sectionLower, {
                        name: sectionRaw.trim(),
                        durationSec: sectionLower === "listening" ? 1200 : 2700,
                        groups: [],
                    });
                }

                const type = (r.type || "MCQ").toUpperCase();
                const groupId = (r.groupId || "").toString().trim();
                const groupKey = sectionLower + "::" + groupId;

                // Create/find group
                if (!groupMap.has(groupKey)) {
                    const group = {
                        type,
                        audioUrl: r.audioUrl || "",
                        passage: r.passage || "",
                        questions: [],
                    };
                    groupMap.set(groupKey, group);
                    sectionsMap.get(sectionLower).groups.push(group);
                } else {
                    // If later rows have passage/audio, prefer the first non-empty we’ve seen
                    const g = groupMap.get(groupKey);
                    if (!g.passage && r.passage) g.passage = r.passage;
                    if (!g.audioUrl && r.audioUrl) g.audioUrl = r.audioUrl;
                }

                // Build question if present
                const number = Number(r.number);
                const prompt = r.prompt || "";
                const ansRaw = r.answer || "";

                if (Number.isFinite(number) && prompt) {
                    if (type === "TRUE_FALSE") {
                        groupMap.get(groupKey).questions.push({
                            number,
                            prompt,
                            answer: isTF(ansRaw), // normalize TRUE/FALSE
                        });
                    } else {
                        // MCQ
                        const A = r.A || "";
                        const B = r.B || "";
                        const C = r.C || "";
                        const D = r.D || "";
                        const answer = (ansRaw || "").toString().trim().toUpperCase(); // A/B/C/D
                        groupMap.get(groupKey).questions.push({
                            number,
                            prompt,
                            options: { A, B, C, D },
                            answer,
                        });
                    }
                }
            }

            const sections = Array.from(sectionsMap.values());

            // Filter out empty groups/sections
            for (const sec of sections) {
                sec.groups = (sec.groups || []).filter(
                    (g) => Array.isArray(g.questions) && g.questions.length > 0
                );
            }
            const finalSections = sections.filter(
                (s) => (s.groups || []).length > 0
            );

            if (finalSections.length === 0) {
                return res.status(400).json({ error: "No questions found in CSV" });
            }

            const doc = await MockTest.create({
                title: testTitle,
                description: req.body.description || "",
                sections: finalSections,
                createdBy: req.user.id,
            });

            res.json(doc);
        } catch (e) {
            console.error("import-csv failed:", e);
            res.status(400).json({ error: "Failed to import CSV" });
        }
    }
);

export default router;

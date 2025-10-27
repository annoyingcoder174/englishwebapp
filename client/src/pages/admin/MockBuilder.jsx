// client/src/pages/admin/MockBuilder.jsx
import { useState, useRef, useCallback, useLayoutEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../utils/api";

/* -------------------------------------------------
   Helpers / factories
------------------------------------------------- */

function normalizeTfngAnswer(v) {
    if (!v) return "";
    const x = v.toString().trim().toUpperCase();
    if (x === "TRUE") return "TRUE";
    if (x === "FALSE") return "FALSE";
    if (x === "NOT GIVEN" || x === "NOTGIVEN") return "NOT GIVEN";
    return "";
}

// Multiple choice (A/B/C/D)
function makeMCQ(number = 1) {
    return {
        number,
        type: "MCQ",
        prompt: "",
        options: [
            { key: "A", text: "" },
            { key: "B", text: "" },
            { key: "C", text: "" },
            { key: "D", text: "" },
        ],
        answer: "", // "A"/"B"/"C"/"D"
        explanationHtml: "",
    };
}

// TRUE/FALSE/NOT GIVEN
function makeTFNG(number = 1) {
    return {
        number,
        type: "TFNG",
        prompt: "",
        answer: "", // "TRUE" | "FALSE" | "NOT GIVEN"
        explanationHtml: "",
    };
}

// Fill in ONE blank
function makeFILL(number = 1) {
    return {
        number,
        type: "FILL",
        prompt: "", // e.g. "Write ONE WORD ONLY..."
        answer: "",
        explanationHtml: "",
    };
}

// Cloze paragraph w/ many blanks
function makeFILLBLOCK(number = 1) {
    return {
        number,
        type: "FILL_BLOCK",
        blockText: "",
        blanks: [
            {
                slot: 1,
                answer: "",
                limit: "ONE WORD ONLY",
                note: "",
            },
        ],
        // FILL_BLOCK doesn't expose explanationHtml at the question level,
        // each blank can have its own note instead.
    };
}

// Matching pairs
function makeMATCH(number = 1) {
    return {
        number,
        type: "MATCH",
        prompt: "",
        pairs: [{ left: "A", right: "Example" }],
        explanationHtml: "",
    };
}

// choose correct template
function makeNewQuestion(number, kind = "MCQ") {
    switch (kind) {
        case "TFNG":
            return makeTFNG(number);
        case "FILL":
            return makeFILL(number);
        case "FILL_BLOCK":
            return makeFILLBLOCK(number);
        case "MATCH":
            return makeMATCH(number);
        default:
            return makeMCQ(number);
    }
}

// A new group of questions
function makeEmptyGroup() {
    return {
        title: "",
        instructions: "",
        imageUrl: "",
        audioUrl: "",
        passageHtml: "",
        questions: [makeMCQ(1)],
    };
}

// Initial single Reading section
function initialSections() {
    return [
        {
            name: "Reading",
            part: 7,
            durationMinutes: 75,
            linear: false,
            groups: [
                {
                    ...makeEmptyGroup(),
                    title: "Part 7 - Đọc hiểu",
                    instructions:
                        "Đọc đoạn văn và trả lời câu hỏi. Có thể TRUE/FALSE/NOT GIVEN, Điền từ nhiều ô, ...",
                    passageHtml:
                        "<p>Ví dụ đoạn văn / email nội bộ công ty / bài báo marketing ...</p>",
                },
            ],
        },
    ];
}

/* -------------------------------------------------
   Simple Uploader for image/audio
------------------------------------------------- */
function Uploader({ accept, onUploaded, buttonText = "Tải tệp", disabled }) {
    const fileRef = useRef(null);

    function extractPublicUrl(data) {
        const cands = [
            data?.absoluteUrl,
            data?.url,
            data?.path,
            data?.fileUrl,
            data?.location,
            data?.file?.url,
        ].filter(Boolean);
        if (cands.length) return cands[0];
        if (data?.filename) return `/uploads/${data.filename}`;
        return null;
    }

    async function handlePick(e) {
        const file = e.target.files?.[0];
        if (!file) return;
        const form = new FormData();
        form.append("file", file);

        try {
            const { data } = await api.post("/documents/upload", form);
            const url = extractPublicUrl(data);
            if (url) onUploaded(url);
            else alert("Tải xong nhưng không nhận được URL public.");
        } catch (err) {
            console.error("Upload error:", err?.response?.data || err);
            alert("Không thể tải tệp.");
        } finally {
            if (fileRef.current) fileRef.current.value = "";
        }
    }

    return (
        <>
            <input
                ref={fileRef}
                type="file"
                className="hidden"
                accept={accept}
                disabled={disabled}
                onChange={handlePick}
            />
            <button
                type="button"
                className="border rounded px-2 py-1 text-xs bg-gray-50 hover:bg-gray-100"
                onClick={() => fileRef.current?.click()}
                disabled={disabled}
            >
                {buttonText}
            </button>
        </>
    );
}

/* -------------------------------------------------
   Component
------------------------------------------------- */

export default function MockBuilder() {
    const navigate = useNavigate();

    const [title, setTitle] = useState("Đề thi thử Reading / IELTS / TOEIC");
    const [description, setDescription] = useState("");
    const [sections, _setSections] = useState(initialSections);
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState([]);

    // "Don't jump to top" fix when mutating deeply nested state
    const scrollBeforeUpdateRef = useRef(0);
    const setSectionsSafe = useCallback((updater) => {
        scrollBeforeUpdateRef.current = window.scrollY;
        _setSections((prev) =>
            typeof updater === "function" ? updater(prev) : updater
        );
    }, []);
    useLayoutEffect(() => {
        window.scrollTo({
            top: scrollBeforeUpdateRef.current,
            left: 0,
            // instant prevents the annoying jump-scroll animation
            behavior: "instant",
        });
    }, [sections]);

    /* -------------------------------------------------
       Mutators for sections, groups, questions
    ------------------------------------------------- */

    function updateSectionField(si, field, value) {
        setSectionsSafe((prev) => {
            const next = [...prev];
            next[si] = { ...next[si], [field]: value };
            return next;
        });
    }

    function addSection() {
        setSectionsSafe((prev) => [
            ...prev,
            {
                name: "Reading",
                part: 7,
                durationMinutes: 75,
                linear: false,
                groups: [makeEmptyGroup()],
            },
        ]);
    }

    function removeSection(si) {
        setSectionsSafe((prev) => prev.filter((_, i) => i !== si));
    }

    function updateGroupField(si, gi, field, value) {
        setSectionsSafe((prev) => {
            const next = [...prev];
            const sec = next[si];
            const groups = [...sec.groups];
            groups[gi] = { ...groups[gi], [field]: value };
            next[si] = { ...sec, groups };
            return next;
        });
    }

    function addGroup(si) {
        setSectionsSafe((prev) => {
            const next = [...prev];
            const sec = next[si];
            next[si] = { ...sec, groups: [...sec.groups, makeEmptyGroup()] };
            return next;
        });
    }

    function removeGroup(si, gi) {
        setSectionsSafe((prev) => {
            const next = [...prev];
            const sec = next[si];
            next[si] = {
                ...sec,
                groups: sec.groups.filter((_, idx) => idx !== gi),
            };
            return next;
        });
    }

    function nextQuestionNumber(group) {
        if (!group.questions?.length) return 1;
        const last = group.questions[group.questions.length - 1];
        const base = Number(last?.number) || 0;
        return base + 1;
    }

    function addQuestionOfType(si, gi, kind) {
        setSectionsSafe((prev) => {
            const next = [...prev];
            const sec = next[si];
            const groups = [...sec.groups];
            const g = groups[gi];
            const qArr = [...g.questions];
            qArr.push(makeNewQuestion(nextQuestionNumber(g), kind));
            groups[gi] = { ...g, questions: qArr };
            next[si] = { ...sec, groups };
            return next;
        });
    }

    function removeQuestion(si, gi, qi) {
        setSectionsSafe((prev) => {
            const next = [...prev];
            const sec = next[si];
            const groups = [...sec.groups];
            const g = groups[gi];
            groups[gi] = {
                ...g,
                questions: g.questions.filter((_, idx) => idx !== qi),
            };
            next[si] = { ...sec, groups };
            return next;
        });
    }

    // FULL REPLACE if changing "type"
    function updateQuestionField(si, gi, qi, field, value) {
        setSectionsSafe((prev) => {
            const next = [...prev];
            const sec = next[si];
            const groups = [...sec.groups];
            const g = groups[gi];
            const qs = [...g.questions];
            const oldQ = qs[qi] || {};

            if (field === "type") {
                // When type changes, reset to a fresh template for that kind.
                const newQ = makeNewQuestion(oldQ.number ?? 1, value);
                qs[qi] = newQ;
            } else {
                qs[qi] = { ...oldQ, [field]: value };
            }

            groups[gi] = { ...g, questions: qs };
            next[si] = { ...sec, groups };
            return next;
        });
    }

    // update MCQ option text
    function updateOptionText(si, gi, qi, key, text) {
        setSectionsSafe((prev) => {
            const next = [...prev];
            const sec = next[si];
            const groups = [...sec.groups];
            const g = groups[gi];
            const qs = [...g.questions];
            const q = { ...qs[qi] };

            const updatedOpts = (q.options || []).map((o) =>
                o.key === key ? { ...o, text } : o
            );
            q.options = updatedOpts;

            qs[qi] = q;
            groups[gi] = { ...g, questions: qs };
            next[si] = { ...sec, groups };
            return next;
        });
    }

    // FILL_BLOCK operations
    function addBlank(si, gi, qi) {
        setSectionsSafe((prev) => {
            const next = [...prev];
            const sec = next[si];
            const groups = [...sec.groups];
            const g = groups[gi];
            const qs = [...g.questions];
            const q = { ...qs[qi] };

            const blanks = Array.isArray(q.blanks) ? [...q.blanks] : [];
            const newSlot = (blanks[blanks.length - 1]?.slot || 0) + 1;
            blanks.push({
                slot: newSlot,
                answer: "",
                limit: "ONE WORD ONLY",
                note: "",
            });

            q.blanks = blanks;
            qs[qi] = q;
            groups[gi] = { ...g, questions: qs };
            next[si] = { ...sec, groups };
            return next;
        });
    }

    function updateBlankField(si, gi, qi, bi, field, value) {
        setSectionsSafe((prev) => {
            const next = [...prev];
            const sec = next[si];
            const groups = [...sec.groups];
            const g = groups[gi];
            const qs = [...g.questions];
            const q = { ...qs[qi] };

            const blanks = Array.isArray(q.blanks) ? [...q.blanks] : [];
            if (!blanks[bi]) return next;
            blanks[bi] = { ...blanks[bi], [field]: value };
            q.blanks = blanks;

            qs[qi] = q;
            groups[gi] = { ...g, questions: qs };
            next[si] = { ...sec, groups };
            return next;
        });
    }

    function removeBlank(si, gi, qi, bi) {
        setSectionsSafe((prev) => {
            const next = [...prev];
            const sec = next[si];
            const groups = [...sec.groups];
            const g = groups[gi];
            const qs = [...g.questions];
            const q = { ...qs[qi] };

            const blanks = Array.isArray(q.blanks) ? [...q.blanks] : [];
            q.blanks = blanks.filter((_, idx) => idx !== bi);

            qs[qi] = q;
            groups[gi] = { ...g, questions: qs };
            next[si] = { ...sec, groups };
            return next;
        });
    }

    /* -------------------------------------------------
       Validation (frontend) & normalization (before save)
    ------------------------------------------------- */

    function validateSections(payloadSections) {
        const errs = [];

        payloadSections.forEach((sec, si) => {
            if (!sec.name) {
                errs.push({
                    path: `Phần #${si + 1}`,
                    message: "Thiếu kỹ năng (Listening/Reading).",
                });
            }
            if (!sec.part) {
                errs.push({
                    path: `Phần #${si + 1}`,
                    message: "Thiếu Part (1–7).",
                });
            }
            if (!sec.durationMinutes) {
                errs.push({
                    path: `Phần #${si + 1}`,
                    message: "Thiếu thời lượng (phút).",
                });
            }

            const isListening = sec.name === "Listening";
            const isReading = sec.name === "Reading";

            (sec.groups || []).forEach((g, gi) => {
                if (isListening && Number(sec.part) === 1 && !g.imageUrl) {
                    errs.push({
                        path: `Phần #${si + 1} · Nhóm #${gi + 1}`,
                        message: "Part 1 (Listening) yêu cầu ảnh.",
                    });
                }
                if (
                    isListening &&
                    [2, 3, 4].includes(Number(sec.part)) &&
                    !g.audioUrl
                ) {
                    errs.push({
                        path: `Phần #${si + 1} · Nhóm #${gi + 1}`,
                        message: "Part 2/3/4 (Listening) yêu cầu audio.",
                    });
                }
                if (
                    isReading &&
                    [6, 7].includes(Number(sec.part)) &&
                    !g.passageHtml
                ) {
                    errs.push({
                        path: `Phần #${si + 1} · Nhóm #${gi + 1}`,
                        message: "Part 6/7 (Reading) cần đoạn văn.",
                    });
                }

                if (!g.questions?.length) {
                    errs.push({
                        path: `Phần #${si + 1} · Nhóm #${gi + 1}`,
                        message: "Cần ít nhất 1 câu hỏi.",
                    });
                }

                (g.questions || []).forEach((q, qi) => {
                    // Check base text
                    if (q.type !== "FILL_BLOCK") {
                        if (!q.prompt?.trim()) {
                            errs.push({
                                path: `Phần #${si + 1} · Nhóm #${gi + 1} · Câu #${qi + 1}`,
                                message: "Thiếu nội dung câu hỏi.",
                            });
                        }
                    } else {
                        if (!q.blockText?.trim()) {
                            errs.push({
                                path: `Phần #${si + 1} · Nhóm #${gi + 1} · Câu #${qi + 1}`,
                                message:
                                    "Đoạn điền từ (nhiều ô): thiếu đoạn văn có chỗ trống.",
                            });
                        }
                    }

                    if (q.type === "MCQ") {
                        const keys = (q.options || []).map((o) => o.key);
                        if (!["A", "B", "C", "D"].every((k) => keys.includes(k))) {
                            errs.push({
                                path: `Phần #${si + 1} · Nhóm #${gi + 1} · Câu #${qi + 1}`,
                                message: "Cần đủ 4 lựa chọn A/B/C/D.",
                            });
                        }
                        const normAns = (q.answer || "").toUpperCase().trim();
                        if (!["A", "B", "C", "D"].includes(normAns)) {
                            errs.push({
                                path: `Phần #${si + 1} · Nhóm #${gi + 1} · Câu #${qi + 1}`,
                                message: "Đáp án đúng phải là A/B/C/D.",
                            });
                        }
                    }

                    if (q.type === "TFNG") {
                        const normAns = normalizeTfngAnswer(q.answer);
                        if (!normAns) {
                            errs.push({
                                path: `Phần #${si + 1} · Nhóm #${gi + 1} · Câu #${qi + 1}`,
                                message:
                                    "Đáp án TFNG phải là TRUE / FALSE / NOT GIVEN.",
                            });
                        }
                    }

                    if (q.type === "FILL") {
                        if (!(q.answer || "").trim()) {
                            errs.push({
                                path: `Phần #${si + 1} · Nhóm #${gi + 1} · Câu #${qi + 1}`,
                                message:
                                    "Điền từ (1 ô): cần đáp án đúng để chấm.",
                            });
                        }
                    }

                    if (q.type === "FILL_BLOCK") {
                        return renderFILLBLOCK(q);
                    }


                    if (q.type === "MATCH") {
                        const pairs = Array.isArray(q.pairs) ? q.pairs : [];
                        if (!pairs.length) {
                            errs.push({
                                path: `Phần #${si + 1} · Nhóm #${gi + 1} · Câu #${qi + 1}`,
                                message:
                                    "Ghép cặp: cần ít nhất 1 cặp Trái/Phải.",
                            });
                        }
                    }
                });
            });
        });

        return errs;
    }

    // <- IMPORTANT FIX ->
    // We "clean" and normalize before sending to API.
    // This guarantees each FILL_BLOCK.blank has a valid numeric `slot`,
    // so backend won't scream "Path `slot` is required."
    function normalizeSectionsForSave(src) {
        return src.map((sec) => ({
            name: sec.name,
            part: Number(sec.part),
            durationMinutes: Number(sec.durationMinutes) || 0,
            linear: !!sec.linear,
            groups: (sec.groups || []).map((g) => ({
                title: g.title || "",
                instructions: g.instructions || "",
                passageHtml: g.passageHtml || "",
                imageUrl: g.imageUrl || "",
                audioUrl: g.audioUrl || "",
                questions: (g.questions || []).map((q) => {
                    switch (q.type) {
                        case "MCQ":
                            return {
                                number: Number(q.number),
                                type: "MCQ",
                                prompt: q.prompt || "",
                                options: (q.options || []).map((o) => ({
                                    key: o.key,
                                    text: (o.text || "").trim(),
                                })),
                                answer: (q.answer || "").toUpperCase().trim(),
                                explanationHtml: q.explanationHtml || "",
                            };

                        case "TFNG":
                            return {
                                number: Number(q.number),
                                type: "TFNG",
                                prompt: q.prompt || "",
                                answer: normalizeTfngAnswer(q.answer),
                                explanationHtml: q.explanationHtml || "",
                            };

                        case "FILL":
                            return {
                                number: Number(q.number),
                                type: "FILL",
                                prompt: q.prompt || "",
                                answer: (q.answer || "").trim(),
                                explanationHtml: q.explanationHtml || "",
                            };

                        case "FILL_BLOCK": {
                            // clean blanks:
                            const rawBlanks = Array.isArray(q.blanks)
                                ? q.blanks
                                : [];
                            const cleanedBlanks = rawBlanks.map((b, i) => {
                                const rawSlot = Number(b.slot);
                                // if slot is missing / 0 / NaN, fallback to index+1
                                const safeSlot =
                                    rawSlot && rawSlot > 0 ? rawSlot : i + 1;
                                return {
                                    slot: safeSlot,
                                    answer: (b.answer || "").trim(),
                                    limit:
                                        (b.limit || "ONE WORD ONLY").trim() ||
                                        "ONE WORD ONLY",
                                    note: (b.note || "").trim(),
                                };
                            });

                            return {
                                number: Number(q.number),
                                type: "FILL_BLOCK",
                                blockText: q.blockText || "",
                                blanks: cleanedBlanks,
                            };
                        }

                        case "MATCH":
                            return {
                                number: Number(q.number),
                                type: "MATCH",
                                prompt: q.prompt || "",
                                pairs: (q.pairs || []).map((p) => ({
                                    left: (p.left || "").trim(),
                                    right: (p.right || "").trim(),
                                })),
                                explanationHtml: q.explanationHtml || "",
                            };

                        default:
                            // fallback - shouldn't really hit
                            return {
                                number: Number(q.number) || 0,
                                type: q.type || "MCQ",
                                prompt: q.prompt || "",
                            };
                    }
                }),
            })),
        }));
    }

    // prettier error display for alert()
    function formatSaveError(err) {
        // axios style:
        const serverMsg =
            err?.response?.data?.message ||
            err?.response?.data?.error ||
            err?.message;
        if (!serverMsg) return "Failed to build test";
        // Collapse newlines a bit so the alert isn't a massive wall.
        return "Failed to build test\n\n" + serverMsg;
    }

    async function handleSave() {
        setSaving(true);
        setErrors([]);

        try {
            // 1. normalize local nested state into backend shape
            const normalized = normalizeSectionsForSave(sections);

            // 2. run the same validation rules we enforce in the UI
            const vErrs = validateSections(normalized);
            if (vErrs.length) {
                setErrors(vErrs);
                window.scrollTo({ top: 0, behavior: "smooth" });
                setSaving(false);
                return;
            }

            // 3. build payload
            const payload = {
                title: title.trim(),
                description: description.trim(),
                sections: normalized,
            };

            // 4. POST to builder endpoint
            await api.post("/mocktests/build", payload);

            alert("Tạo đề thi thành công!");
            navigate("/admin/tests");
        } catch (err) {
            console.error("SAVE ERROR:", err);
            alert(formatSaveError(err));
        } finally {
            setSaving(false);
        }
    }

    /* -------------------------------------------------
       Render subcomponents
    ------------------------------------------------- */

    function renderMCQ(si, gi, qi, q) {
        return (
            <>
                <div className="grid grid-cols-2 gap-2">
                    {(q.options || []).map((opt) => (
                        <div key={opt.key} className="flex flex-col">
                            <label className="text-xs font-semibold text-gray-600">
                                Đáp án {opt.key}
                            </label>
                            <input
                                className="border rounded px-2 py-1 text-sm"
                                value={opt.text || ""}
                                onChange={(e) =>
                                    updateOptionText(
                                        si,
                                        gi,
                                        qi,
                                        opt.key,
                                        e.target.value
                                    )
                                }
                            />
                        </div>
                    ))}
                </div>

                <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-gray-600">
                        Đáp án đúng (A/B/C/D)
                    </label>
                    <input
                        className="border rounded px-2 py-1 text-sm w-24"
                        value={q.answer || ""}
                        onChange={(e) =>
                            updateQuestionField(
                                si,
                                gi,
                                qi,
                                "answer",
                                (e.target.value || "").toUpperCase()
                            )
                        }
                    />
                </div>
            </>
        );
    }

    function renderTFNG(si, gi, qi, q) {
        return (
            <>
                <label className="text-xs font-semibold text-gray-600">
                    Đáp án đúng (TRUE / FALSE / NOT GIVEN)
                </label>
                <select
                    className="border rounded px-2 py-1 text-sm w-full md:w-64"
                    value={q.answer || ""}
                    onChange={(e) =>
                        updateQuestionField(
                            si,
                            gi,
                            qi,
                            "answer",
                            normalizeTfngAnswer(e.target.value)
                        )
                    }
                >
                    <option value="">-- chọn đáp án --</option>
                    <option value="TRUE">TRUE</option>
                    <option value="FALSE">FALSE</option>
                    <option value="NOT GIVEN">NOT GIVEN</option>
                </select>
            </>
        );
    }

    function renderFILL(si, gi, qi, q) {
        return (
            <>
                <label className="text-xs font-semibold text-gray-600">
                    Đáp án đúng (1 ô trống)
                </label>
                <input
                    className="border rounded px-2 py-1 text-sm w-full"
                    value={q.answer || ""}
                    onChange={(e) =>
                        updateQuestionField(
                            si,
                            gi,
                            qi,
                            "answer",
                            e.target.value
                        )
                    }
                    placeholder="creativity"
                />
                <div className="text-[11px] text-gray-500">
                    Học viên phải gõ đúng từ/cụm từ này để được tính đúng.
                </div>
            </>
        );
    }

    function renderFILLBLOCK(si, gi, qi, qRaw) {
        const q = {
            blockText: "",
            blanks: [],
            ...qRaw,
        };
        const blanks = Array.isArray(q.blanks) ? q.blanks : [];

        return (
            <>
                <label className="text-xs font-semibold text-gray-600">
                    Đoạn văn có chỗ trống (dùng __1__, __2__, __3__ ...)
                </label>
                <textarea
                    className="border rounded px-2 py-1 text-sm w-full min-h-[120px]"
                    value={q.blockText || ""}
                    onChange={(e) =>
                        updateQuestionField(si, gi, qi, "blockText", e.target.value)
                    }
                    placeholder={`Questions 1-8 Complete the notes below.
    
    Choose ONE WORD ONLY from the passage for each answer.
    
    Write your answers in boxes 1-8 on your answer sheet.
    
    building a 'magical kingdom' may help develop __1__
    board games involve __2__ and turn-taking
    ...`}
                />

                <div className="text-[11px] text-gray-500 mb-2">
                    Học viên sẽ thấy đoạn này và một ô nhập cho từng số trống.
                </div>

                <div className="border rounded p-2 bg-white space-y-2">
                    <div className="font-semibold text-xs text-gray-700">
                        Danh sách ô trống
                    </div>

                    {blanks.map((b, bi) => (
                        <div
                            key={bi}
                            className="border rounded p-2 bg-gray-50 space-y-2"
                        >
                            <div className="flex flex-wrap gap-2 items-start">
                                <div>
                                    <label className="text-[11px] font-semibold text-gray-600 block">
                                        Số ô trống (slot)
                                    </label>
                                    <input
                                        type="number"
                                        className="border rounded px-2 py-1 text-sm w-20"
                                        value={b.slot ?? ""}
                                        onChange={(e) =>
                                            updateBlankField(
                                                si,
                                                gi,
                                                qi,
                                                bi,
                                                "slot",
                                                parseInt(e.target.value || "0", 10) || 0
                                            )
                                        }
                                    />
                                </div>

                                <div className="flex-1 min-w-[140px]">
                                    <label className="text-[11px] font-semibold text-gray-600 block">
                                        Đáp án đúng
                                    </label>
                                    <input
                                        className="border rounded px-2 py-1 text-sm w-full"
                                        value={b.answer || ""}
                                        onChange={(e) =>
                                            updateBlankField(
                                                si,
                                                gi,
                                                qi,
                                                bi,
                                                "answer",
                                                e.target.value
                                            )
                                        }
                                        placeholder="creativity"
                                    />
                                </div>

                                <div>
                                    <label className="text-[11px] font-semibold text-gray-600 block">
                                        Giới hạn từ
                                    </label>
                                    <select
                                        className="border rounded px-2 py-1 text-sm"
                                        value={b.limit || "ONE WORD ONLY"}
                                        onChange={(e) =>
                                            updateBlankField(
                                                si,
                                                gi,
                                                qi,
                                                bi,
                                                "limit",
                                                e.target.value
                                            )
                                        }
                                    >
                                        <option value="ONE WORD ONLY">ONE WORD ONLY</option>
                                        <option value="TWO WORDS ONLY">TWO WORDS ONLY</option>
                                        <option value="THREE WORDS ONLY">THREE WORDS ONLY</option>
                                        <option value="NO WORD LIMIT">NO WORD LIMIT</option>
                                    </select>
                                </div>

                                <button
                                    type="button"
                                    className="text-red-600 text-xs underline ml-auto"
                                    onClick={() => removeBlank(si, gi, qi, bi)}
                                >
                                    Xoá ô
                                </button>
                            </div>

                            <div>
                                <label className="text-[11px] font-semibold text-gray-600 block">
                                    Giải thích sau khi nộp (KHÔNG hiển thị trong đề)
                                </label>
                                <input
                                    className="border rounded px-2 py-1 text-sm w-full"
                                    placeholder="Ví dụ: 'creativity' = 'khả năng sáng tạo', line 4."
                                    value={b.note || ""}
                                    onChange={(e) =>
                                        updateBlankField(
                                            si,
                                            gi,
                                            qi,
                                            bi,
                                            "note",
                                            e.target.value
                                        )
                                    }
                                />
                            </div>
                        </div>
                    ))}

                    <button
                        type="button"
                        className="text-blue-600 text-xs underline"
                        onClick={() => addBlank(si, gi, qi)}
                    >
                        + Thêm ô trống
                    </button>
                </div>

                <div className="text-[11px] text-gray-500">
                    Những “Giải thích sau khi nộp” ở trên sẽ chỉ hiển thị cho học viên
                    trong trang xem lại kết quả (sau khi nộp bài).
                </div>
            </>
        );
    }


    function renderMATCH(si, gi, qi, qRaw) {
        const q = { pairs: [], ...qRaw };
        const pairs = Array.isArray(q.pairs) ? q.pairs : [];

        function updatePair(pi, field, value) {
            const newPairs = [...pairs];
            newPairs[pi] = { ...newPairs[pi], [field]: value };
            updateQuestionField(si, gi, qi, "pairs", newPairs);
        }

        function addPair() {
            const newPairs = [...pairs, { left: "", right: "" }];
            updateQuestionField(si, gi, qi, "pairs", newPairs);
        }

        function removePair(pi) {
            const newPairs = pairs.filter((_, idx) => idx !== pi);
            updateQuestionField(si, gi, qi, "pairs", newPairs);
        }

        return (
            <>
                <div className="text-[11px] text-gray-500">
                    Ghép cột bên trái với mô tả bên phải.
                </div>

                {pairs.map((p, pi) => (
                    <div
                        key={pi}
                        className="flex flex-col md:flex-row gap-2 items-start border rounded p-2 bg-gray-50"
                    >
                        <div className="flex-1 min-w-[120px]">
                            <label className="text-[11px] font-semibold text-gray-600 block">
                                Trái
                            </label>
                            <input
                                className="border rounded px-2 py-1 text-sm w-full"
                                value={p.left || ""}
                                onChange={(e) =>
                                    updatePair(pi, "left", e.target.value)
                                }
                            />
                        </div>

                        <div className="flex-1 min-w-[200px]">
                            <label className="text-[11px] font-semibold text-gray-600 block">
                                Phải
                            </label>
                            <input
                                className="border rounded px-2 py-1 text-sm w-full"
                                value={p.right || ""}
                                onChange={(e) =>
                                    updatePair(pi, "right", e.target.value)
                                }
                            />
                        </div>

                        <button
                            type="button"
                            className="text-red-600 text-xs underline"
                            onClick={() => removePair(pi)}
                        >
                            Xoá cặp
                        </button>
                    </div>
                ))}

                <button
                    type="button"
                    className="text-blue-600 text-xs underline"
                    onClick={addPair}
                >
                    + Thêm cặp
                </button>
            </>
        );
    }

    // Render per-question body
    function renderQuestionBodyByType(q, si, gi, qi) {
        switch (q.type) {
            case "MCQ":
                return renderMCQ(si, gi, qi, q);
            case "TFNG":
                return renderTFNG(si, gi, qi, q);
            case "FILL":
                return renderFILL(si, gi, qi, q);
            case "FILL_BLOCK":
                return renderFILLBLOCK(si, gi, qi, q);
            case "MATCH":
                return renderMATCH(si, gi, qi, q);
            default:
                return renderMCQ(si, gi, qi, q);
        }
    }

    function renderQuestion(si, gi, q, qi) {
        const showExplanationField = q.type !== "FILL_BLOCK";

        return (
            <div
                key={qi}
                className="border rounded p-3 bg-white shadow-sm space-y-3"
            >
                <div className="flex flex-wrap items-start gap-3">
                    <div>
                        <label className="text-xs font-semibold text-gray-600">
                            Câu số
                        </label>
                        <input
                            type="number"
                            className="border rounded px-2 py-1 text-sm w-20"
                            value={q.number ?? ""}
                            onChange={(e) =>
                                updateQuestionField(
                                    si,
                                    gi,
                                    qi,
                                    "number",
                                    parseInt(e.target.value || "0", 10) ||
                                    0
                                )
                            }
                        />
                    </div>

                    <div>
                        <label className="text-xs font-semibold text-gray-600 block">
                            Loại câu hỏi
                        </label>
                        <select
                            className="border rounded px-2 py-1 text-sm"
                            value={q.type || "MCQ"}
                            onChange={(e) =>
                                updateQuestionField(
                                    si,
                                    gi,
                                    qi,
                                    "type",
                                    e.target.value
                                )
                            }
                        >
                            <option value="MCQ">
                                Trắc nghiệm (A/B/C/D)
                            </option>
                            <option value="TFNG">
                                TRUE / FALSE / NOT GIVEN
                            </option>
                            <option value="FILL">Điền từ (1 ô)</option>
                            <option value="FILL_BLOCK">
                                Đoạn điền từ (nhiều ô trống)
                            </option>
                            <option value="MATCH">Ghép cặp</option>
                        </select>
                    </div>

                    <button
                        type="button"
                        className="text-red-600 text-sm underline ml-auto"
                        onClick={() => removeQuestion(si, gi, qi)}
                    >
                        Xoá câu hỏi
                    </button>
                </div>

                {/* Prompt / heading */}
                {q.type !== "FILL_BLOCK" ? (
                    <>
                        <label className="text-xs font-semibold text-gray-600">
                            Nội dung câu hỏi
                        </label>
                        <textarea
                            className="border rounded px-2 py-1 text-sm w-full"
                            value={q.prompt || ""}
                            onChange={(e) =>
                                updateQuestionField(
                                    si,
                                    gi,
                                    qi,
                                    "prompt",
                                    e.target.value
                                )
                            }
                            placeholder={
                                q.type === "TFNG"
                                    ? "Do the following statements agree...?"
                                    : q.type === "FILL"
                                        ? "Write ONE WORD ONLY from the passage for each answer..."
                                        : "Câu hỏi..."
                            }
                        />
                    </>
                ) : (
                    <div className="text-xs text-gray-500 italic">
                        (Loại &quot;Đoạn điền từ (nhiều ô)&quot; dùng phần
                        &quot;Đoạn văn có chỗ trống&quot; bên dưới thay vì
                        prompt riêng.)
                    </div>
                )}

                {/* Type-specific fields */}
                {renderQuestionBodyByType(q, si, gi, qi)}

                {/* Explanation HTML (hide for FILL_BLOCK, since each blank can have its own note) */}
                {showExplanationField && (
                    <div className="flex flex-col">
                        <label className="text-xs font-semibold text-gray-600">
                            Giải thích (HTML) - hiển thị sau khi nộp
                        </label>
                        <textarea
                            className="border rounded px-2 py-1 text-sm w-full"
                            value={q.explanationHtml || ""}
                            onChange={(e) =>
                                updateQuestionField(
                                    si,
                                    gi,
                                    qi,
                                    "explanationHtml",
                                    e.target.value
                                )
                            }
                            placeholder="<p>Giải thích chi tiết...</p>"
                        />
                    </div>
                )}
            </div>
        );
    }

    // dropdown + button to add a new question at bottom of group
    function QuestionAdder({ si, gi }) {
        const [pendingType, setPendingType] = useState("MCQ");
        return (
            <div className="flex flex-wrap gap-2 items-center">
                <select
                    className="border rounded px-2 py-1 text-sm"
                    value={pendingType}
                    onChange={(e) => setPendingType(e.target.value)}
                >
                    <option value="MCQ">
                        Trắc nghiệm (A/B/C/D)
                    </option>
                    <option value="TFNG">
                        TRUE / FALSE / NOT GIVEN
                    </option>
                    <option value="FILL">Điền từ (1 ô)</option>
                    <option value="FILL_BLOCK">
                        Đoạn điền từ (nhiều ô trống)
                    </option>
                    <option value="MATCH">Ghép cặp</option>
                </select>
                <button
                    type="button"
                    className="bg-indigo-600 text-white text-xs rounded py-2 px-3 hover:bg-indigo-700"
                    onClick={() => addQuestionOfType(si, gi, pendingType)}
                >
                    + Thêm câu hỏi
                </button>
            </div>
        );
    }

    function renderGroup(si, gi, group, sectionName, part) {
        const isListening = sectionName === "Listening";
        const isReading = sectionName === "Reading";
        const needImage = isListening && Number(part) === 1;
        const needAudio = isListening && [2, 3, 4].includes(Number(part));
        const needPassage = isReading && [6, 7].includes(Number(part));

        return (
            <div
                key={gi}
                className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 space-y-4"
            >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* LEFT block */}
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-gray-700">
                            Tiêu đề nhóm / Part
                        </label>
                        <input
                            className="border rounded px-2 py-1 text-sm"
                            value={group.title || ""}
                            onChange={(e) =>
                                updateGroupField(
                                    si,
                                    gi,
                                    "title",
                                    e.target.value
                                )
                            }
                            placeholder={
                                isListening
                                    ? `Part ${part} - Listening`
                                    : `Part ${part} - Reading`
                            }
                        />

                        <label className="text-sm font-medium text-gray-700">
                            Hướng dẫn / Lời dặn
                        </label>
                        <textarea
                            className="border rounded px-2 py-1 text-sm"
                            value={group.instructions || ""}
                            onChange={(e) =>
                                updateGroupField(
                                    si,
                                    gi,
                                    "instructions",
                                    e.target.value
                                )
                            }
                            placeholder={
                                isListening
                                    ? "Nghe và chọn đáp án đúng nhất."
                                    : "Đọc đoạn văn và trả lời câu hỏi."
                            }
                        />

                        {/* Image */}
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-gray-700">
                                Ảnh minh hoạ (tuỳ chọn)
                                {needImage ? (
                                    <span className="text-red-600">
                                        {" "}
                                        · Part 1 yêu cầu
                                    </span>
                                ) : null}
                            </label>
                            <div className="flex gap-2 flex-wrap">
                                <input
                                    className="border rounded px-2 py-1 text-sm flex-1 min-w-[200px]"
                                    value={group.imageUrl || ""}
                                    onChange={(e) =>
                                        updateGroupField(
                                            si,
                                            gi,
                                            "imageUrl",
                                            e.target.value
                                        )
                                    }
                                    placeholder="https://...jpg"
                                />
                                <Uploader
                                    accept="image/*"
                                    buttonText="Tải ảnh"
                                    onUploaded={(url) =>
                                        updateGroupField(
                                            si,
                                            gi,
                                            "imageUrl",
                                            url
                                        )
                                    }
                                />
                            </div>
                            {group.imageUrl && (
                                <div className="text-xs text-gray-600 break-all">
                                    URL:{" "}
                                    <a
                                        className="text-blue-600 underline"
                                        href={group.imageUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        {group.imageUrl}
                                    </a>
                                </div>
                            )}
                        </div>

                        {/* Audio */}
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-gray-700">
                                Audio (tuỳ chọn)
                                {needAudio ? (
                                    <span className="text-red-600">
                                        {" "}
                                        · Part {part} yêu cầu
                                    </span>
                                ) : null}
                            </label>
                            <div className="flex gap-2 flex-wrap">
                                <input
                                    className="border rounded px-2 py-1 text-sm flex-1 min-w-[200px]"
                                    value={group.audioUrl || ""}
                                    onChange={(e) =>
                                        updateGroupField(
                                            si,
                                            gi,
                                            "audioUrl",
                                            e.target.value
                                        )
                                    }
                                    placeholder="https://...mp3"
                                />
                                <Uploader
                                    accept="audio/*"
                                    buttonText="Tải audio"
                                    onUploaded={(url) =>
                                        updateGroupField(
                                            si,
                                            gi,
                                            "audioUrl",
                                            url
                                        )
                                    }
                                />
                            </div>
                            {group.audioUrl && (
                                <div className="text-xs text-gray-600 break-all">
                                    URL:{" "}
                                    <a
                                        className="text-blue-600 underline"
                                        href={group.audioUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        {group.audioUrl}
                                    </a>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* RIGHT block: Reading passage */}
                    <div className="flex flex-col gap-2">
                        {isReading ? (
                            <>
                                <label className="text-sm font-medium text-gray-700">
                                    Đoạn văn / Passage (HTML)
                                    {needPassage ? (
                                        <span className="text-red-600">
                                            {" "}
                                            *
                                        </span>
                                    ) : null}
                                </label>
                                <textarea
                                    className="border rounded px-2 py-1 text-sm min-h-[140px] w-full"
                                    value={group.passageHtml || ""}
                                    onChange={(e) =>
                                        updateGroupField(
                                            si,
                                            gi,
                                            "passageHtml",
                                            e.target.value
                                        )
                                    }
                                    placeholder={
                                        Number(part) === 7
                                            ? "<p>Email/Thông báo/Bài đọc ...</p>"
                                            : "<p>Đoạn văn ...</p>"
                                    }
                                />
                            </>
                        ) : (
                            <div className="text-sm text-gray-500">
                                Đây là phần Listening. Đoạn văn không bắt buộc.
                            </div>
                        )}

                        {/* Quick-add buttons */}
                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                className="bg-green-600 text-white text-xs rounded py-2 px-3 hover:bg-green-700"
                                onClick={() =>
                                    addQuestionOfType(si, gi, "MCQ")
                                }
                            >
                                + Trắc nghiệm (A/B/C/D)
                            </button>
                            <button
                                type="button"
                                className="bg-indigo-600 text-white text-xs rounded py-2 px-3 hover:bg-indigo-700"
                                onClick={() =>
                                    addQuestionOfType(si, gi, "TFNG")
                                }
                            >
                                + TRUE / FALSE / NOT GIVEN
                            </button>
                            <button
                                type="button"
                                className="bg-purple-600 text-white text-xs rounded py-2 px-3 hover:bg-purple-700"
                                onClick={() =>
                                    addQuestionOfType(si, gi, "FILL")
                                }
                            >
                                + Điền từ (1 ô)
                            </button>
                            <button
                                type="button"
                                className="bg-orange-500 text-white text-xs rounded py-2 px-3 hover:bg-orange-600"
                                onClick={() =>
                                    addQuestionOfType(si, gi, "FILL_BLOCK")
                                }
                            >
                                + Đoạn điền từ (nhiều ô)
                            </button>
                            <button
                                type="button"
                                className="bg-pink-600 text-white text-xs rounded py-2 px-3 hover:bg-pink-700"
                                onClick={() =>
                                    addQuestionOfType(si, gi, "MATCH")
                                }
                            >
                                + Ghép cặp
                            </button>

                            <button
                                type="button"
                                className="text-red-600 text-xs underline ml-auto"
                                onClick={() => removeGroup(si, gi)}
                            >
                                Xoá nhóm
                            </button>
                        </div>
                    </div>
                </div>

                {/* QUESTIONS LIST */}
                <div className="space-y-4">
                    {(group.questions || []).map((q, qi) =>
                        renderQuestion(si, gi, q, qi)
                    )}
                </div>

                {/* bottom add-question area */}
                <QuestionAdder si={si} gi={gi} />
            </div>
        );
    }

    function renderSection(sec, si) {
        return (
            <div
                key={si}
                className="border rounded-xl p-4 mb-6 bg-white shadow space-y-4"
            >
                <div className="flex flex-col md:flex-row md:items-start gap-4">
                    <div className="grid grid-cols-2 gap-4 flex-1">
                        {/* skill */}
                        <div className="flex flex-col">
                            <label className="text-sm font-medium text-gray-700">
                                Kỹ năng
                            </label>
                            <select
                                className="border rounded px-2 py-1 text-sm"
                                value={sec.name}
                                onChange={(e) => {
                                    const name = e.target.value;
                                    updateSectionField(si, "name", name);
                                    updateSectionField(
                                        si,
                                        "durationMinutes",
                                        name === "Reading" ? 75 : 45
                                    );
                                    updateSectionField(
                                        si,
                                        "linear",
                                        name !== "Reading"
                                    );
                                    updateSectionField(
                                        si,
                                        "part",
                                        name === "Reading" ? 5 : 1
                                    );
                                }}
                            >
                                <option value="Listening">Listening</option>
                                <option value="Reading">Reading</option>
                            </select>
                        </div>

                        {/* part */}
                        <div className="flex flex-col">
                            <label className="text-sm font-medium text-gray-700">
                                Part
                            </label>
                            <input
                                type="number"
                                className="border rounded px-2 py-1 text-sm w-20"
                                value={sec.part ?? ""}
                                onChange={(e) =>
                                    updateSectionField(
                                        si,
                                        "part",
                                        parseInt(e.target.value || "0", 10) ||
                                        0
                                    )
                                }
                            />
                            <div className="text-[11px] text-gray-500 mt-1">
                                Listening: 1–4 · Reading: 5–7
                            </div>
                        </div>

                        {/* duration */}
                        <div className="flex flex-col">
                            <label className="text-sm font-medium text-gray-700">
                                Thời lượng (phút)
                            </label>
                            <input
                                type="number"
                                className="border rounded px-2 py-1 text-sm w-24"
                                value={sec.durationMinutes ?? ""}
                                onChange={(e) =>
                                    updateSectionField(
                                        si,
                                        "durationMinutes",
                                        parseInt(e.target.value || "0", 10) ||
                                        0
                                    )
                                }
                            />
                        </div>

                        {/* linear? */}
                        <div className="flex flex-col">
                            <label className="text-sm font-medium text-gray-700">
                                Bắt buộc theo thứ tự?
                            </label>
                            <select
                                className="border rounded px-2 py-1 text-sm w-24"
                                value={sec.linear ? "true" : "false"}
                                onChange={(e) =>
                                    updateSectionField(
                                        si,
                                        "linear",
                                        e.target.value === "true"
                                    )
                                }
                            >
                                <option value="true">Có</option>
                                <option value="false">Không</option>
                            </select>
                            <div className="text-[11px] text-gray-500 mt-1">
                                Listening nên để <b>Có</b>, Reading thường{" "}
                                <b>Không</b>.
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col justify-end md:ml-auto">
                        <button
                            type="button"
                            className="text-red-600 text-sm underline"
                            onClick={() => removeSection(si)}
                        >
                            Xoá phần
                        </button>
                    </div>
                </div>

                {/* groups in this section */}
                <div className="space-y-4">
                    {(sec.groups || []).map((g, gi) =>
                        renderGroup(si, gi, g, sec.name, sec.part)
                    )}
                </div>

                <button
                    type="button"
                    className="text-blue-700 text-sm underline"
                    onClick={() => addGroup(si)}
                >
                    + Thêm nhóm / đoạn
                </button>
            </div>
        );
    }

    /* -------------------------------------------------
       Page JSX
    ------------------------------------------------- */

    return (
        <div className="p-4 max-w-6xl mx-auto bg-gray-50 min-h-screen">
            <h1 className="text-2xl font-bold mb-2 text-gray-800">
                Xây dựng đề thi
            </h1>
            <p className="text-sm text-gray-600 mb-6">
                Hỗ trợ: Trắc nghiệm A/B/C/D, TRUE/FALSE/NOT GIVEN, Điền từ (1
                ô), Đoạn điền từ (nhiều ô trống), Ghép cặp. Mỗi nhóm có thể
                đính kèm ảnh, audio và/hoặc đoạn văn.
            </p>

            {errors.length > 0 && (
                <div className="mb-4 border-l-4 border-red-500 bg-red-50 p-4 rounded text-red-700 text-sm">
                    <div className="font-semibold mb-2">
                        Vui lòng sửa các lỗi sau:
                    </div>
                    <ul className="list-disc pl-5 space-y-1">
                        {errors.map((e, i) => (
                            <li key={i}>
                                <span className="font-medium">{e.path}:</span>{" "}
                                {e.message}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Test meta (title + description) */}
            <div className="bg-white border rounded-xl shadow p-4 mb-6 space-y-3">
                <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-gray-700">
                        Tiêu đề đề thi
                    </label>
                    <input
                        className="border rounded px-3 py-2 w-full text-sm"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Đề thi thử IELTS Reading 01"
                    />
                </div>

                <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-gray-700">
                        Mô tả / ghi chú nội bộ (không bắt buộc)
                    </label>
                    <textarea
                        className="border rounded px-3 py-2 w-full text-sm min-h-[60px]"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Ví dụ: đề cho lớp tối thứ 2/4."
                    />
                </div>
            </div>

            {/* Sections */}
            <div className="space-y-6">
                {sections.map((sec, si) => renderSection(sec, si))}
            </div>

            <button
                type="button"
                className="bg-indigo-600 text-white text-sm rounded py-2 px-3 hover:bg-indigo-700 mt-4"
                onClick={addSection}
            >
                + Thêm phần mới (Listening / Reading)
            </button>

            <div className="mt-8 flex justify-end">
                <button
                    disabled={saving}
                    type="button"
                    className="bg-green-600 text-white rounded-lg py-3 px-4 text-sm font-semibold hover:bg-green-700 disabled:opacity-50"
                    onClick={handleSave}
                >
                    {saving ? "Đang lưu..." : "Lưu đề thi"}
                </button>
            </div>
        </div>
    );
}

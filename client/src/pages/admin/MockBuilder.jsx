import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../utils/api";

/** Inline uploader (Multer -> /documents/upload) */
function Uploader({ accept, onUploaded, buttonText = "Tải tệp", disabled }) {
    const fileRef = useRef(null);

    function extractPublicUrl(data) {
        const candidates = [
            data?.absoluteUrl, // prefer absolute
            data?.url,
            data?.path,
            data?.fileUrl,
            data?.location,
            data?.file?.url,
        ].filter(Boolean);
        if (candidates.length) return candidates[0];
        if (data?.filename) return `/uploads/${data.filename}`;
        return null;
    }

    async function handlePick(e) {
        const file = e.target.files?.[0];
        if (!file) return;
        const form = new FormData();
        form.append("file", file);
        try {
            // let browser set Content-Type with boundary
            const { data } = await api.post("/documents/upload", form);
            const url = extractPublicUrl(data);
            if (url) onUploaded(url);
            else alert("Tải tệp xong nhưng chưa nhận được URL.");
        } catch (err) {
            console.error("Upload error:", err?.response?.data || err);
            alert("Không thể tải tệp. Vui lòng thử lại.");
        } finally {
            if (fileRef.current) fileRef.current.value = "";
        }
    }

    return (
        <>
            <input
                ref={fileRef}
                type="file"
                accept={accept}
                className="hidden"
                onChange={handlePick}
                disabled={disabled}
            />
            <button
                type="button"
                className="border rounded px-3 py-1.5 text-sm bg-gray-50 hover:bg-gray-100"
                onClick={() => fileRef.current?.click()}
                disabled={disabled}
            >
                {buttonText}
            </button>
        </>
    );
}

/* ---------- factories ---------- */
function makeEmptyQuestion(nextNumber = 1) {
    return {
        number: nextNumber,
        type: "MCQ",
        prompt: "",
        options: [
            { key: "A", text: "" },
            { key: "B", text: "" },
            { key: "C", text: "" },
            { key: "D", text: "" },
        ],
        answer: "A",
        explanationHtml: "",
        tags: [],
    };
}
function makeEmptyGroup() {
    return {
        title: "",
        instructions: "",
        imageUrl: "",
        audioUrl: "",
        passageHtml: "",
        questions: [makeEmptyQuestion(1)],
    };
}
function makeInitialSections() {
    return [
        {
            name: "Listening",
            part: 1,
            durationMinutes: 45,
            linear: true,
            groups: [
                {
                    ...makeEmptyGroup(),
                    title: "Part 1 - Mô tả tranh",
                    instructions: "Nghe và chọn câu mô tả đúng nhất cho bức tranh.",
                },
            ],
        },
        {
            name: "Reading",
            part: 7,
            durationMinutes: 75,
            linear: false,
            groups: [
                {
                    ...makeEmptyGroup(),
                    title: "Part 7 - Đọc hiểu",
                    instructions: "Đọc đoạn văn và trả lời câu hỏi.",
                    passageHtml: "<p>Ví dụ đoạn văn / email nội bộ công ty...</p>",
                },
            ],
        },
    ];
}

export default function MockBuilder() {
    const navigate = useNavigate();

    const [title, setTitle] = useState("Đề thi thử TOEIC");
    const [description, setDescription] = useState("");
    const [sections, setSections] = useState(makeInitialSections());
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState([]);

    /* ---------- immutable updates ---------- */
    function updateSectionField(si, field, value) {
        setSections((prev) => {
            const copy = [...prev];
            copy[si] = { ...copy[si], [field]: value };
            return copy;
        });
    }
    function addSection() {
        setSections((prev) => [
            ...prev,
            { name: "Listening", part: 2, durationMinutes: 45, linear: true, groups: [makeEmptyGroup()] },
        ]);
    }
    function removeSection(si) {
        setSections((prev) => prev.filter((_, i) => i !== si));
    }
    function addGroup(si) {
        setSections((prev) => {
            const copy = [...prev];
            copy[si] = { ...copy[si], groups: [...copy[si].groups, makeEmptyGroup()] };
            return copy;
        });
    }
    function removeGroup(si, gi) {
        setSections((prev) => {
            const copy = [...prev];
            const sec = copy[si];
            copy[si] = { ...sec, groups: sec.groups.filter((_, i) => i !== gi) };
            return copy;
        });
    }
    function updateGroupField(si, gi, field, value) {
        setSections((prev) => {
            const copy = [...prev];
            const sec = copy[si];
            const groups = [...sec.groups];
            groups[gi] = { ...groups[gi], [field]: value };
            copy[si] = { ...sec, groups };
            return copy;
        });
    }
    function addQuestion(si, gi) {
        setSections((prev) => {
            const copy = [...prev];
            const sec = copy[si];
            const groups = [...sec.groups];
            const group = groups[gi];
            const lastNum = group.questions.length ? group.questions[group.questions.length - 1].number : 0;
            groups[gi] = { ...group, questions: [...group.questions, makeEmptyQuestion((Number(lastNum) || 0) + 1)] };
            copy[si] = { ...sec, groups };
            return copy;
        });
    }
    function removeQuestion(si, gi, qi) {
        setSections((prev) => {
            const copy = [...prev];
            const sec = copy[si];
            const groups = [...sec.groups];
            const group = groups[gi];
            groups[gi] = { ...group, questions: group.questions.filter((_, i) => i !== qi) };
            copy[si] = { ...sec, groups };
            return copy;
        });
    }
    function updateQuestionField(si, gi, qi, field, value) {
        setSections((prev) => {
            const copy = [...prev];
            const sec = copy[si];
            const groups = [...sec.groups];
            const g = groups[gi];
            const qs = [...g.questions];
            qs[qi] = { ...qs[qi], [field]: value };
            groups[gi] = { ...g, questions: qs };
            copy[si] = { ...sec, groups };
            return copy;
        });
    }
    function updateOptionText(si, gi, qi, key, text) {
        setSections((prev) => {
            const copy = [...prev];
            const sec = copy[si];
            const groups = [...sec.groups];
            const g = groups[gi];
            const qs = [...g.questions];
            const q = { ...qs[qi] };
            q.options = q.options.map((o) => (o.key === key ? { ...o, text } : o));
            qs[qi] = q;
            groups[gi] = { ...g, questions: qs };
            copy[si] = { ...sec, groups };
            return copy;
        });
    }

    /* ---------- validation + save ---------- */
    function validateSections(payloadSections) {
        const errs = [];
        payloadSections.forEach((sec, si) => {
            if (!sec.name) errs.push({ path: `Phần #${si + 1}`, message: "Thiếu trường kỹ năng (Listening/Reading)." });
            if (!sec.part) errs.push({ path: `Phần #${si + 1}`, message: "Thiếu Part (1–7)." });
            if (!sec.durationMinutes) errs.push({ path: `Phần #${si + 1}`, message: "Thiếu thời lượng (phút)." });

            const isListening = sec.name === "Listening";
            const isReading = sec.name === "Reading";

            sec.groups?.forEach((g, gi) => {
                if (isListening && sec.part === 1 && !g.imageUrl)
                    errs.push({ path: `Phần #${si + 1} · Nhóm #${gi + 1}`, message: "Part 1 yêu cầu ảnh (imageUrl)." });
                if (isListening && [2, 3, 4].includes(sec.part) && !g.audioUrl)
                    errs.push({ path: `Phần #${si + 1} · Nhóm #${gi + 1}`, message: "Part 2/3/4 yêu cầu audio (audioUrl)." });
                if (isReading && [6, 7].includes(sec.part) && !g.passageHtml)
                    errs.push({ path: `Phần #${si + 1} · Nhóm #${gi + 1}`, message: "Part 6/7 yêu cầu đoạn văn (passageHtml)." });

                if (!g.questions?.length)
                    errs.push({ path: `Phần #${si + 1} · Nhóm #${gi + 1}`, message: "Cần ít nhất 1 câu hỏi." });

                (g.questions || []).forEach((q, qi) => {
                    if (!q.prompt?.trim())
                        errs.push({ path: `Phần #${si + 1} · Nhóm #${gi + 1} · Câu #${qi + 1}`, message: "Thiếu nội dung câu hỏi." });
                    const keys = (q.options || []).map((o) => o.key);
                    if (!["A", "B", "C", "D"].every((k) => keys.includes(k)))
                        errs.push({ path: `Phần #${si + 1} · Nhóm #${gi + 1} · Câu #${qi + 1}`, message: "Cần đủ 4 lựa chọn A/B/C/D." });
                    if (!["A", "B", "C", "D"].includes((q.answer || "").toUpperCase()))
                        errs.push({ path: `Phần #${si + 1} · Nhóm #${gi + 1} · Câu #${qi + 1}`, message: "Đáp án phải là A/B/C/D." });
                });
            });
        });
        return errs;
    }

    function normalizeSectionsForSave(src) {
        return src.map((sec) => ({
            name: sec.name,
            part: Number(sec.part),
            durationMinutes: Number(sec.durationMinutes) || (sec.name === "Listening" ? 45 : 75),
            linear: !!sec.linear,
            groups: (sec.groups || []).map((g) => ({
                title: (g.title || "").trim(),
                instructions: (g.instructions || "").trim(),
                passageHtml: (g.passageHtml || "").trim(),
                imageUrl: (g.imageUrl || "").trim(),
                audioUrl: (g.audioUrl || "").trim(),
                questions: (g.questions || []).map((q) => ({
                    number: Number(q.number),
                    prompt: (q.prompt || "").trim(),
                    type: "MCQ",
                    options: (q.options || []).map((o) => ({ key: o.key, text: (o.text || "").trim() })),
                    answer: (q.answer || "A").toUpperCase(),
                    explanationHtml: (q.explanationHtml || "").trim(),
                    tags: Array.isArray(q.tags) ? q.tags.filter(Boolean) : [],
                })),
            })),
        }));
    }

    async function save() {
        try {
            setSaving(true);
            setErrors([]);
            const normalized = normalizeSectionsForSave(sections);
            const vErrs = validateSections(normalized);
            if (vErrs.length) {
                setErrors(vErrs);
                window.scrollTo({ top: 0, behavior: "smooth" });
                return;
            }
            const payload = { title: title.trim(), description: description.trim(), sections: normalized };
            await api.post("/mocktests/build", payload);
            alert("Tạo đề thi thành công!");
            navigate("/admin");
        } catch (err) {
            console.error(err);
            alert(err?.response?.data?.error || "Lỗi tạo đề thi. Vui lòng kiểm tra dữ liệu.");
        } finally {
            setSaving(false);
        }
    }

    /* ---------- renders ---------- */
    function renderQuestion(si, gi, q, qi) {
        return (
            <div key={qi} className="border rounded p-3 bg-white shadow-sm space-y-2">
                <div className="flex flex-col md:flex-row md:items-center gap-2">
                    <div>
                        <label className="text-xs font-semibold text-gray-600">Câu số</label>
                        <input
                            type="number"
                            className="border rounded px-2 py-1 text-sm w-20"
                            value={q.number}
                            onChange={(e) => updateQuestionField(si, gi, qi, "number", parseInt(e.target.value, 10))}
                        />
                    </div>
                    <div className="flex-1">
                        <label className="text-xs font-semibold text-gray-600">Nội dung câu hỏi</label>
                        <textarea
                            className="border rounded px-2 py-1 text-sm w-full"
                            value={q.prompt}
                            onChange={(e) => updateQuestionField(si, gi, qi, "prompt", e.target.value)}
                        />
                    </div>
                    <button onClick={() => removeQuestion(si, gi, qi)} className="text-red-600 text-sm hover:underline ml-auto" type="button">
                        Xoá câu hỏi
                    </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                    {q.options.map((opt) => (
                        <div key={opt.key} className="flex flex-col">
                            <label className="text-xs font-semibold text-gray-600">Đáp án {opt.key}</label>
                            <input
                                className="border rounded px-2 py-1 text-sm"
                                value={opt.text}
                                onChange={(e) => updateOptionText(si, gi, qi, opt.key, e.target.value)}
                            />
                        </div>
                    ))}
                </div>

                <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-gray-600">Đáp án đúng (A/B/C/D)</label>
                    <input
                        className="border rounded px-2 py-1 text-sm w-24"
                        value={q.answer}
                        onChange={(e) => updateQuestionField(si, gi, qi, "answer", e.target.value.toUpperCase())}
                    />

                    <label className="text-xs font-semibold text-gray-600">Giải thích (HTML) - hiển thị sau khi nộp</label>
                    <textarea
                        className="border rounded px-2 py-1 text-sm w-full"
                        placeholder="<p>Giải thích chi tiết...</p>"
                        value={q.explanationHtml || ""}
                        onChange={(e) => updateQuestionField(si, gi, qi, "explanationHtml", e.target.value)}
                    />

                    <label className="text-xs font-semibold text-gray-600">Thẻ kỹ năng / ngữ pháp (phân tách bằng dấu phẩy)</label>
                    <input
                        className="border rounded px-2 py-1 text-sm w-full"
                        placeholder="thì hiện tại đơn, đại từ, suy luận"
                        value={(q.tags || []).join(", ")}
                        onChange={(e) =>
                            updateQuestionField(
                                si,
                                gi,
                                qi,
                                "tags",
                                e.target.value
                                    .split(",")
                                    .map((s) => s.trim())
                                    .filter(Boolean)
                            )
                        }
                    />
                </div>
            </div>
        );
    }

    function renderGroup(si, group, gi, secName, part) {
        const isListening = secName === "Listening";
        const isReading = secName === "Reading";
        const needImage = isListening && part === 1;               // required
        const needAudio = isListening && [2, 3, 4].includes(part); // required
        const needPassage = isReading && [6, 7].includes(part);

        return (
            <div key={gi} className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* LEFT META */}
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-gray-700">Tiêu đề nhóm / Part</label>
                        <input
                            className="border rounded px-2 py-1 text-sm"
                            value={group.title || ""}
                            placeholder={
                                isListening
                                    ? (part === 1 ? "Part 1 - Mô tả tranh" : part === 2 ? "Part 2 - Hỏi/Đáp" : part === 3 ? "Part 3 - Hội thoại" : "Part 4 - Bài nói")
                                    : (part === 5 ? "Part 5 - Câu rời" : part === 6 ? "Part 6 - Điền vào đoạn văn" : "Part 7 - Đọc hiểu")
                            }
                            onChange={(e) => updateGroupField(si, gi, "title", e.target.value)}
                        />

                        <label className="text-sm font-medium text-gray-700">Hướng dẫn / Lời dặn</label>
                        <textarea
                            className="border rounded px-2 py-1 text-sm"
                            value={group.instructions || ""}
                            placeholder={
                                isListening
                                    ? "Nghe và chọn đáp án đúng nhất."
                                    : part === 5
                                        ? "Chọn từ/cụm từ đúng nhất để hoàn thành câu."
                                        : "Đọc đoạn văn và trả lời câu hỏi."
                            }
                            onChange={(e) => updateGroupField(si, gi, "instructions", e.target.value)}
                        />

                        {/* MEDIA for ALL parts (image + audio) */}
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-gray-700">
                                Ảnh minh hoạ (tuỳ chọn){needImage ? <span className="text-red-600"> · Part 1 yêu cầu</span> : null}
                            </label>
                            <div className="flex gap-2">
                                <input
                                    className="border rounded px-2 py-1 text-sm flex-1"
                                    value={group.imageUrl || ""}
                                    placeholder="https://...jpg"
                                    onChange={(e) => updateGroupField(si, gi, "imageUrl", e.target.value)}
                                />
                                <Uploader accept="image/*" onUploaded={(url) => updateGroupField(si, gi, "imageUrl", url)} buttonText="Tải ảnh" />
                            </div>
                            {group.imageUrl && (
                                <div className="text-xs text-gray-600 break-all">
                                    URL:{" "}
                                    <a className="text-blue-600 underline" href={group.imageUrl} target="_blank" rel="noreferrer">
                                        {group.imageUrl}
                                    </a>
                                </div>
                            )}
                        </div>

                        <div className="space-y-1">
                            <label className="text-sm font-medium text-gray-700">
                                Audio (tuỳ chọn){needAudio ? <span className="text-red-600"> · Part {part} yêu cầu</span> : null}
                            </label>
                            <div className="flex gap-2">
                                <input
                                    className="border rounded px-2 py-1 text-sm flex-1"
                                    value={group.audioUrl || ""}
                                    placeholder="https://...mp3"
                                    onChange={(e) => updateGroupField(si, gi, "audioUrl", e.target.value)}
                                />
                                <Uploader accept="audio/*" onUploaded={(url) => updateGroupField(si, gi, "audioUrl", url)} buttonText="Tải audio" />
                            </div>
                            {group.audioUrl && (
                                <div className="text-xs text-gray-600 break-all">
                                    URL:{" "}
                                    <a className="text-blue-600 underline" href={group.audioUrl} target="_blank" rel="noreferrer">
                                        {group.audioUrl}
                                    </a>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* RIGHT: PASSAGE (READING-ONLY) */}
                    <div className="flex flex-col gap-2">
                        {isReading ? (
                            <>
                                <label className="text-sm font-medium text-gray-700">
                                    Đoạn văn / Passage (HTML){needPassage ? <span className="text-red-600"> *</span> : null}
                                </label>
                                <textarea
                                    className="border rounded px-2 py-1 text-sm min-h-[120px]"
                                    value={group.passageHtml || ""}
                                    placeholder={
                                        part === 5
                                            ? "Để trống đối với Part 5 (câu rời)."
                                            : part === 6
                                                ? "<p>Đoạn văn có chỗ trống... (Part 6)</p>"
                                                : "<p>Email / Thông báo / Bài đọc... (Part 7)</p>"
                                    }
                                    onChange={(e) => updateGroupField(si, gi, "passageHtml", e.target.value)}
                                />
                            </>
                        ) : (
                            <div className="text-sm text-gray-500">
                                Đây là phần Listening. Đoạn văn không bắt buộc.
                            </div>
                        )}

                        <div className="flex flex-wrap gap-2">
                            <button className="bg-green-600 text-white text-sm rounded py-2 px-3 hover:bg-green-700" onClick={() => addQuestion(si, gi)} type="button">
                                + Thêm câu hỏi
                            </button>
                            <button className="text-red-600 text-sm hover:underline ml-auto" onClick={() => removeGroup(si, gi)} type="button">
                                Xoá nhóm
                            </button>
                        </div>
                    </div>
                </div>

                {/* QUESTIONS */}
                <div className="space-y-3">{group.questions.map((q, qi) => renderQuestion(si, gi, q, qi))}</div>
            </div>
        );
    }

    function renderSection(sec, si) {
        return (
            <div key={si} className="border rounded-xl p-4 mb-6 bg-white shadow space-y-4">
                <div className="flex flex-col md:flex-row md:items-start gap-4">
                    <div className="grid grid-cols-2 gap-4 flex-1">
                        <div className="flex flex-col">
                            <label className="text-sm font-medium text-gray-700">Kỹ năng</label>
                            <select
                                className="border rounded px-2 py-1 text-sm"
                                value={sec.name}
                                onChange={(e) => {
                                    const name = e.target.value;
                                    updateSectionField(si, "name", name);
                                    updateSectionField(si, "durationMinutes", name === "Reading" ? 75 : 45);
                                    updateSectionField(si, "linear", name !== "Reading");
                                    updateSectionField(si, "part", name === "Reading" ? 5 : 1);
                                }}
                            >
                                <option value="Listening">Listening</option>
                                <option value="Reading">Reading</option>
                            </select>
                        </div>

                        <div className="flex flex-col">
                            <label className="text-sm font-medium text-gray-700">Part</label>
                            <input
                                type="number"
                                className="border rounded px-2 py-1 text-sm w-20"
                                value={sec.part}
                                onChange={(e) => updateSectionField(si, "part", parseInt(e.target.value, 10))}
                            />
                            <div className="text-xs text-gray-500 mt-1">Listening: 1–4 · Reading: 5–7</div>
                        </div>

                        <div className="flex flex-col">
                            <label className="text-sm font-medium text-gray-700">Thời lượng (phút)</label>
                            <input
                                type="number"
                                className="border rounded px-2 py-1 text-sm w-24"
                                value={sec.durationMinutes}
                                onChange={(e) => updateSectionField(si, "durationMinutes", parseInt(e.target.value, 10))}
                            />
                        </div>

                        <div className="flex flex-col">
                            <label className="text-sm font-medium text-gray-700">Bắt buộc theo thứ tự?</label>
                            <select
                                className="border rounded px-2 py-1 text-sm w-24"
                                value={sec.linear ? "true" : "false"}
                                onChange={(e) => updateSectionField(si, "linear", e.target.value === "true")}
                            >
                                <option value="true">Có</option>
                                <option value="false">Không</option>
                            </select>
                            <div className="text-xs text-gray-500 mt-1">
                                Listening nên để <b>Có</b>, Reading thường <b>Không</b>.
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col justify-end md:ml-auto">
                        <button className="text-red-600 text-sm hover:underline" onClick={() => removeSection(si)} type="button">
                            Xoá phần
                        </button>
                    </div>
                </div>

                {/* GROUPS */}
                <div className="space-y-4">{sec.groups.map((g, gi) => renderGroup(si, g, gi, sec.name, sec.part))}</div>

                <button className="text-blue-700 text-sm hover:underline" onClick={() => addGroup(si)} type="button">
                    + Thêm nhóm / đoạn
                </button>
            </div>
        );
    }

    return (
        <div className="p-4 max-w-6xl mx-auto">
            <h1 className="text-2xl font-bold mb-2 text-gray-800">Xây dựng đề thi TOEIC</h1>
            <p className="text-sm text-gray-600 mb-6">
                Giao diện hiển thị đúng theo kỹ năng/part. Có thể đính kèm <b>ảnh</b> và <b>audio</b> cho mọi nhóm (Part 1 bắt buộc ảnh · Part 2/3/4 bắt buộc audio).
            </p>

            {errors.length > 0 && (
                <div className="mb-4 border-l-4 border-red-500 bg-red-50 p-3 rounded">
                    <div className="font-semibold text-red-700 mb-1">Vui lòng sửa các lỗi sau:</div>
                    <ul className="list-disc pl-5 text-sm text-red-700 space-y-1">
                        {errors.map((e, i) => (
                            <li key={i}>
                                <span className="font-medium">{e.path}:</span> {e.message}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <div className="bg-white rounded-xl shadow p-4 mb-6 border space-y-3">
                <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-gray-700">Tiêu đề đề thi</label>
                    <input
                        className="border rounded px-3 py-2 w-full text-sm"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Đề thi thử TOEIC 01"
                    />
                </div>

                <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-gray-700">Mô tả / ghi chú nội bộ (không bắt buộc)</label>
                    <textarea
                        className="border rounded px-3 py-2 w-full text-sm"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Ví dụ: đề thi thử dành cho lớp TOEIC tối T2/T4."
                    />
                </div>
            </div>

            <div className="space-y-6">{sections.map((sec, si) => renderSection(sec, si))}</div>

            <button className="bg-indigo-600 text-white text-sm rounded py-2 px-3 hover:bg-indigo-700 mt-2" onClick={addSection} type="button">
                + Thêm phần mới (Listening / Reading)
            </button>

            <div className="mt-8 flex justify-end">
                <button
                    disabled={saving}
                    className="bg-green-600 text-white rounded-lg py-3 px-4 text-sm font-semibold hover:bg-green-700 disabled:opacity-50"
                    onClick={save}
                    type="button"
                >
                    {saving ? "Đang lưu..." : "Lưu đề thi"}
                </button>
            </div>
        </div>
    );
}

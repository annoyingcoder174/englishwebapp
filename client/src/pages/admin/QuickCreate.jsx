import { useState, useMemo } from "react";
import api from "../../utils/api";

/**
 * Bulk parser for Reading MCQs with answers + explanations.
 * Format example (blank lines optional):
 *
 * 1) What is the main idea of the passage?
 * A) Option A text
 * B) Option B text
 * C) Option C text
 * D) Option D text
 * Answer: C
 * Explain: Đây là giải thích vì sao C đúng...
 *
 * 2) The word "they" refers to:
 * A) suppliers
 * B) customers
 * C) managers
 * D) investors
 * Answer: B
 * Explain:
 * "they" nằm trong câu nói về thói quen mua sắm của khách hàng -> B.
 */
function parseBulkQuestions(text) {
    const lines = text.split(/\r?\n/);
    const questions = [];
    let i = 0;

    const takeExplain = (startIdx) => {
        const buff = [];
        let j = startIdx;
        while (j < lines.length) {
            if (/^\s*\d{1,3}\)\s+/.test(lines[j])) break; // next question
            if (/^\s*Answer\s*:/i.test(lines[j])) { j++; continue; }
            buff.push(lines[j]);
            j++;
        }
        return { html: buff.join("\n").trim(), next: j };
    };

    while (i < lines.length) {
        const m = lines[i]?.match(/^\s*(\d{1,3})\)\s+(.+)/);
        if (!m) { i++; continue; }

        const number = Number(m[1]);
        const prompt = m[2].trim();
        let A = "", B = "", C = "", D = "", answer = "", explanationHtml = "";

        i++;
        const readOpt = (key) => {
            const mm = lines[i]?.match(new RegExp(`^\\s*${key}[\\).]\\s*(.+)`, "i"));
            if (mm) { i++; return mm[1].trim(); }
            return "";
        };

        A = readOpt("A");
        B = readOpt("B");
        C = readOpt("C");
        D = readOpt("D");

        const am = lines[i]?.match(/^\s*Answer\s*:\s*([A-D])/i);
        if (am) {
            answer = am[1].toUpperCase();
            i++;
        }

        if (/^\s*Explain\s*:/i.test(lines[i] || "")) {
            const first = (lines[i].split(/Explain\s*:/i)[1] || "").trim();
            i++;
            if (first) {
                explanationHtml = first;
            } else {
                const { html, next } = takeExplain(i);
                explanationHtml = html;
                i = next;
            }
        }

        questions.push({
            number,
            prompt,
            choices: { A, B, C, D },
            answer,
            explanationHtml,
        });
    }
    return questions;
}

export default function QuickCreate() {
    const [title, setTitle] = useState("");
    const [groupTitle, setGroupTitle] = useState("");
    const [instructions, setInstructions] = useState("Chọn đáp án đúng nhất.");
    const [sectionName, setSectionName] = useState("Reading");
    const [part, setPart] = useState(7);
    const [durationMinutes, setDurationMinutes] = useState(75);

    const [passageHtml, setPassageHtml] = useState("");
    const [bulkText, setBulkText] = useState("");
    const parsed = useMemo(() => parseBulkQuestions(bulkText), [bulkText]);
    const [preview, setPreview] = useState([]);

    const handlePreview = () => setPreview(parsed);

    const handleCreate = async () => {
        if (!title || !sectionName || !part || !preview.length) {
            alert("Vui lòng nhập đủ tiêu đề/section/part và danh sách câu hỏi.");
            return;
        }
        try {
            const payload = {
                title,
                description: "",
                sectionName,
                part: Number(part),
                durationMinutes: Number(durationMinutes),
                passageHtml,
                instructions,
                groupTitle,
                questions: preview.map((q) => ({
                    number: q.number,
                    prompt: q.prompt,
                    choices: q.choices,
                    answer: q.answer,
                    explanationHtml: q.explanationHtml || "",
                })),
            };
            const { data } = await api.post("/mocktests/quick-create", payload);
            alert("Tạo đề thành công!");
            console.log("Created:", data);
        } catch (err) {
            console.error("Create failed:", err);
            alert("Không tạo được đề. Kiểm tra dữ liệu.");
        }
    };

    return (
        <div className="p-4 max-w-6xl mx-auto">
            <h1 className="text-xl font-bold mb-3">Tạo nhanh 1 nhóm (dán toàn bộ câu hỏi + giải thích)</h1>

            <div className="grid md:grid-cols-2 gap-4">
                {/* Left: meta + passage */}
                <div className="border rounded p-3 bg-white">
                    <div className="grid grid-cols-2 gap-2 mb-3">
                        <div>
                            <label className="block text-sm font-medium mb-1">Tiêu đề đề</label>
                            <input className="w-full border rounded p-2 text-sm" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Đề TOEIC - Reading Part 7" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Tên nhóm</label>
                            <input className="w-full border rounded p-2 text-sm" value={groupTitle} onChange={(e) => setGroupTitle(e.target.value)} placeholder="Bài đọc 1" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Section</label>
                            <select className="w-full border rounded p-2 text-sm" value={sectionName} onChange={(e) => setSectionName(e.target.value)}>
                                <option>Reading</option>
                                <option>Listening</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Part</label>
                            <input type="number" min={1} max={7} className="w-full border rounded p-2 text-sm" value={part} onChange={(e) => setPart(Number(e.target.value) || 7)} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Thời lượng (phút)</label>
                            <input type="number" className="w-full border rounded p-2 text-sm" value={durationMinutes} onChange={(e) => setDurationMinutes(Number(e.target.value) || 75)} />
                        </div>
                        <div className="col-span-2">
                            <label className="block text-sm font-medium mb-1">Hướng dẫn (instructions)</label>
                            <input className="w-full border rounded p-2 text-sm" value={instructions} onChange={(e) => setInstructions(e.target.value)} />
                        </div>
                    </div>

                    <label className="block text-sm font-medium mb-1">Đoạn văn (HTML được hỗ trợ)</label>
                    <textarea className="w-full border rounded p-2 text-sm h-48" value={passageHtml} onChange={(e) => setPassageHtml(e.target.value)} placeholder="<p>Paste passage ở đây...</p>" />
                </div>

                {/* Right: bulk area + actions */}
                <div className="border rounded p-3 bg-white">
                    <label className="block text-sm font-medium mb-1">Khối câu hỏi (dán tất cả ở đây)</label>
                    <textarea
                        className="w-full border rounded p-2 text-sm h-80"
                        value={bulkText}
                        onChange={(e) => setBulkText(e.target.value)}
                        placeholder={`Ví dụ:

1) What is the main idea of the passage?
A) The company expanded due to rising demand.
B) The sales dropped this quarter.
C) The CEO resigned after the meeting.
D) The factory moved overseas.
Answer: A
Explain: Dựa vào câu 'demand increased...' -> A.

2) The word "they" in line 14 refers to:
A) suppliers
B) customers
C) managers
D) investors
Answer: B
Explain:
"they" nằm trong câu nói về thói quen mua sắm của khách hàng -> B.
`}
                    />
                    <div className="mt-2 flex gap-2">
                        <button onClick={handlePreview} className="border px-3 py-1 rounded text-sm">Xem trước</button>
                        <button onClick={handleCreate} className="bg-blue-600 text-white px-3 py-1 rounded text-sm">Tạo đề</button>
                    </div>
                </div>
            </div>

            {/* Preview editor */}
            <div className="mt-6 border rounded p-3 bg-white">
                <div className="text-sm text-gray-700 font-semibold mb-2">Xem trước ({preview.length} câu)</div>
                {preview.length === 0 ? (
                    <div className="text-sm text-gray-500">Chưa có câu hỏi xem trước.</div>
                ) : (
                    <div className="space-y-3">
                        {preview.map((q, idx) => (
                            <div key={idx} className="border rounded p-2">
                                <div className="text-sm font-semibold mb-1">Câu {q.number}</div>
                                <div className="text-sm mb-2">{q.prompt}</div>
                                <ul className="text-sm list-disc pl-5 mb-2">
                                    <li>A. {q.choices.A}</li>
                                    <li>B. {q.choices.B}</li>
                                    <li>C. {q.choices.C}</li>
                                    <li>D. {q.choices.D}</li>
                                </ul>
                                <div className="text-xs mb-2">Đáp án: <b>{q.answer || "?"}</b></div>

                                <label className="block text-xs font-medium mb-1">Giải thích (HTML OK)</label>
                                <textarea
                                    className="w-full border rounded p-2 text-xs"
                                    value={q.explanationHtml || ""}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setPreview(prev => prev.map((p, ii) => ii === idx ? { ...p, explanationHtml: val } : p));
                                    }}
                                    placeholder="<p>Giải thích tại sao đáp án đúng...</p>"
                                />
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="mt-3 text-xs text-gray-500">
                <b>Tip:</b> Bạn có thể dán trực tiếp HTML trong phần Đoạn văn và Giải thích.
            </div>
        </div>
    );
}

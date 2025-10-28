import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../utils/api";
import { useAuth } from "../../context/AuthContext.jsx";

/**
 * Bulk parser for Reading MCQs with answers + explanations.
 * Format:
 *
 * 1) What is the main idea of the passage?
 * A) Option A text
 * B) Option B text
 * C) Option C text
 * D) Option D text
 * Answer: C
 * Explain: Đây là giải thích vì sao C đúng...
 *
 * 2) ...
 *
 * Result of parseBulkQuestions() is an array like:
 * {
 *   number: 1,
 *   prompt: "What is ... ?",
 *   choices: { A:"...", B:"...", C:"...", D:"..." },
 *   answer: "C",
 *   explanationHtml: "<p>why...</p>"
 * }
 */
function parseBulkQuestions(text) {
    const lines = text.split(/\r?\n/);
    const questions = [];
    let i = 0;

    const takeExplain = (startIdx) => {
        const buff = [];
        let j = startIdx;
        while (j < lines.length) {
            // next question starts with "12) ..." at line start:
            if (/^\s*\d{1,3}\)\s+/.test(lines[j])) break;

            // skip "Answer:" line in multiline explain block
            if (/^\s*Answer\s*:/i.test(lines[j])) {
                j++;
                continue;
            }
            // push the line
            buff.push(lines[j]);
            j++;
        }
        return { html: buff.join("\n").trim(), next: j };
    };

    while (i < lines.length) {
        // match "1) blah blah"
        const m = lines[i]?.match(/^\s*(\d{1,3})\)\s+(.+)/);
        if (!m) {
            i++;
            continue;
        }

        const number = Number(m[1]);
        const prompt = m[2].trim();

        i++;

        // helper to read a choice like "A) text" or "A. text"
        const readChoice = (letter) => {
            const mm = lines[i]?.match(
                new RegExp(`^\\s*${letter}[\\).]\\s*(.+)`, "i")
            );
            if (mm) {
                i++;
                return mm[1].trim();
            }
            return "";
        };

        const A = readChoice("A");
        const B = readChoice("B");
        const C = readChoice("C");
        const D = readChoice("D");

        // read Answer: X
        let answer = "";
        const am = lines[i]?.match(/^\s*Answer\s*:\s*([A-D])/i);
        if (am) {
            answer = am[1].toUpperCase();
            i++;
        }

        // read Explain:
        let explanationHtml = "";
        if (/^\s*Explain\s*:/i.test(lines[i] || "")) {
            // check if same line has immediate text after "Explain:"
            const first = (lines[i].split(/Explain\s*:/i)[1] || "").trim();
            i++;

            if (first) {
                // single-line explain
                explanationHtml = first;
            } else {
                // multi-line explain block until next question / end
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

/**
 * Convert multi-line teacher passage text (plain) to <p>...</p> chunks safely.
 * If teacher already pasted HTML (<p>..</p>) we keep it.
 *
 * Rules:
 * - If passageHtml starts with "<" we assume it's already HTML and return as-is.
 * - Else we wrap each paragraph (split by blank line) into <p>...</p> and escape < >
 */
function normalizePassageHtml(raw) {
    if (!raw) return "";

    // If teacher pasted real HTML (starts with "<"), just keep it.
    if (/^\s*</.test(raw)) {
        return raw.trim();
    }

    // Otherwise treat as plain text -> paragraphs
    const lines = raw.replace(/\r\n/g, "\n").split("\n");

    const paras = [];
    let buf = [];
    const flush = () => {
        if (buf.length) {
            const htmlSafe = buf
                .join(" ")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;");
            paras.push(`<p>${htmlSafe}</p>`);
            buf = [];
        }
    };

    for (const line of lines) {
        const t = line.trim();
        if (!t) {
            flush();
        } else {
            buf.push(t);
        }
    }
    flush();

    return paras.join("\n");
}

/**
 * Convert the "preview" question objects from parseBulkQuestions()
 * into the EXACT format MockBuilder & MockTestRunner expect.
 *
 * Needed shape for each MCQ question in DB:
 * {
 *   number: 1,
 *   type: "MCQ",
 *   prompt: "What ...?",
 *   options: [
 *      { key:"A", text:"..." },
 *      { key:"B", text:"..." },
 *      { key:"C", text:"..." },
 *      { key:"D", text:"..." },
 *   ],
 *   answer: "C",
 *   explanationHtml: "<p>...</p>"
 * }
 */
function mapParsedQuestionsToBuilderQuestions(previewQs) {
    return previewQs.map((q) => {
        const opts = [];
        if (q.choices?.A) opts.push({ key: "A", text: q.choices.A });
        if (q.choices?.B) opts.push({ key: "B", text: q.choices.B });
        if (q.choices?.C) opts.push({ key: "C", text: q.choices.C });
        if (q.choices?.D) opts.push({ key: "D", text: q.choices.D });

        return {
            number: Number(q.number) || 0,
            type: "MCQ",
            prompt: q.prompt || "",
            options: opts,
            answer: q.answer || "",
            explanationHtml: q.explanationHtml || "",
            // other types (FILL, TFNG, etc.) fields are not needed here
            tfngAnswer: "",
            blanks: [],
            pairs: [],
        };
    });
}

export default function QuickCreate() {
    const navigate = useNavigate();
    const { logout } = useAuth();

    // high-level test data
    const [title, setTitle] = useState("");
    const [instructions, setInstructions] = useState("Chọn đáp án đúng nhất.");
    const [sectionName, setSectionName] = useState("Reading"); // "Reading" or "Listening"
    const [part, setPart] = useState(7);
    const [durationMinutes, setDurationMinutes] = useState(75);

    // group/passsage data
    const [groupTitle, setGroupTitle] = useState("Bài đọc 1");
    const [passageHtml, setPassageHtml] = useState("");

    // bulk paste box
    const [bulkText, setBulkText] = useState("");

    // derived parsed questions
    const parsed = useMemo(() => parseBulkQuestions(bulkText), [bulkText]);

    // what we actually plan to submit (after "Xem trước")
    const [preview, setPreview] = useState([]);

    function handlePreview() {
        setPreview(parsed);
    }

    async function handleCreate() {
        if (!title.trim()) {
            alert("Thiếu tiêu đề đề thi.");
            return;
        }
        if (!preview.length) {
            alert("Chưa có câu hỏi. Hãy bấm 'Xem trước' trước khi tạo.");
            return;
        }

        // 1. Convert preview -> builder-style MCQ questions[]
        const builderQuestions = mapParsedQuestionsToBuilderQuestions(preview);

        // 2. Prepare one "group" that matches MockBuilder's schema
        // This is exactly what MockTestRunner expects under sections[*].groups[*].
        const groupObj = {
            title: groupTitle || "",
            instructions: instructions || "",
            passageHtml: normalizePassageHtml(passageHtml || ""),
            imageUrl: "",
            audioUrl: "",
            questions: builderQuestions,
        };

        // 3. Build final body in the same structure our server /quick-create route
        // will upsert into the MockTest model.
        //
        // We send ONE section with ONE group. The server will wrap this
        // section into `sections: [ ... ]` on insert.
        //
        // NOTE: visibility defaults to "all" here. You can change later in admin.
        const payload = {
            title,
            description: "",

            sectionName,               // "Reading" or "Listening"
            part: Number(part) || 1,   // e.g. 5,6,7...
            durationMinutes: Number(durationMinutes) || 60,
            linear: false,             // you can make a checkbox if you want

            groups: [groupObj],

            visibility: "all",
            allowedStudents: [],
            blockedStudents: [],
        };

        try {
            const res = await api.post("/mocktests/quick-create", payload);

            if (res.data?.ok) {
                alert("Tạo đề thành công!");
                // Jump to admin tests so you can see/edit the test
                navigate("/admin/tests");
            } else {
                console.error("Server responded but not ok:", res.data);
                alert("Server trả về phản hồi lạ. (Không ok)");
            }
        } catch (err) {
            console.error("Create failed:", err?.response?.data || err);
            alert(
                err?.response?.data?.error ||
                "Không tạo được đề. Kiểm tra lại dữ liệu hoặc server route /mocktests/quick-create."
            );
        }
    }

    function handleLogout() {
        logout();
        navigate("/");
    }

    return (
        <div className="p-4 max-w-6xl mx-auto text-sm">
            <div className="flex items-start justify-between mb-4">
                <h1 className="text-xl font-bold text-gray-800">
                    ⚡ Tạo nhanh 1 nhóm câu hỏi (dán hàng loạt)
                </h1>

                <button
                    onClick={handleLogout}
                    className="bg-red-600 text-white text-xs font-semibold rounded px-3 py-2 hover:bg-red-700"
                >
                    🔓 Logout
                </button>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
                {/* LEFT SIDE: meta + passage */}
                <div className="border rounded-lg bg-white p-3 space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col">
                            <label className="text-xs font-medium text-gray-700 mb-1">
                                Tiêu đề đề
                            </label>
                            <input
                                className="border rounded px-2 py-1 text-sm"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Đề TOEIC - Reading Part 7"
                            />
                        </div>

                        <div className="flex flex-col">
                            <label className="text-xs font-medium text-gray-700 mb-1">
                                Tên nhóm / Passage
                            </label>
                            <input
                                className="border rounded px-2 py-1 text-sm"
                                value={groupTitle}
                                onChange={(e) => setGroupTitle(e.target.value)}
                                placeholder="Bài đọc 1"
                            />
                        </div>

                        <div className="flex flex-col">
                            <label className="text-xs font-medium text-gray-700 mb-1">
                                Section
                            </label>
                            <select
                                className="border rounded px-2 py-1 text-sm"
                                value={sectionName}
                                onChange={(e) => setSectionName(e.target.value)}
                            >
                                <option value="Reading">Reading</option>
                                <option value="Listening">Listening</option>
                            </select>
                        </div>

                        <div className="flex flex-col">
                            <label className="text-xs font-medium text-gray-700 mb-1">
                                Part
                            </label>
                            <input
                                className="border rounded px-2 py-1 text-sm"
                                type="number"
                                min={1}
                                max={7}
                                value={part}
                                onChange={(e) =>
                                    setPart(Number(e.target.value) || 7)
                                }
                            />
                        </div>

                        <div className="flex flex-col">
                            <label className="text-xs font-medium text-gray-700 mb-1">
                                Thời lượng (phút)
                            </label>
                            <input
                                className="border rounded px-2 py-1 text-sm"
                                type="number"
                                value={durationMinutes}
                                onChange={(e) =>
                                    setDurationMinutes(Number(e.target.value) || 75)
                                }
                            />
                        </div>

                        <div className="flex flex-col col-span-2">
                            <label className="text-xs font-medium text-gray-700 mb-1">
                                Hướng dẫn (instructions)
                            </label>
                            <input
                                className="border rounded px-2 py-1 text-sm"
                                value={instructions}
                                onChange={(e) => setInstructions(e.target.value)}
                                placeholder="Chọn đáp án đúng nhất."
                            />
                        </div>
                    </div>

                    <div className="flex flex-col">
                        <label className="text-xs font-medium text-gray-700 mb-1">
                            Đoạn văn / Passage
                            <span className="text-[10px] text-gray-500 ml-1">
                                (Bạn có thể dán HTML hoặc plain text. Xuống dòng sẽ giữ đoạn.)
                            </span>
                        </label>
                        <textarea
                            className="border rounded px-2 py-1 text-sm h-48 font-mono"
                            value={passageHtml}
                            onChange={(e) => setPassageHtml(e.target.value)}
                            placeholder={`<p>THE IMPORTANCE OF CHILDREN’S PLAY</p>
<p>Brick by brick, six-year-old Alice ...</p>`}
                        />
                    </div>

                    <div className="text-[11px] text-gray-500 italic">
                        Tip: Nếu bạn không dùng thẻ &lt;p&gt;, mình sẽ tự wrap các đoạn
                        thành &lt;p&gt;...&lt;/p&gt; để hiển thị đẹp trong MockTestRunner.
                    </div>
                </div>

                {/* RIGHT SIDE: bulk paste + actions */}
                <div className="border rounded-lg bg-white p-3 flex flex-col">
                    <label className="text-xs font-medium text-gray-700 mb-1">
                        Khối câu hỏi (dán tất cả ở đây)
                    </label>
                    <textarea
                        className="border rounded px-2 py-1 text-sm h-80 font-mono flex-1"
                        value={bulkText}
                        onChange={(e) => setBulkText(e.target.value)}
                        placeholder={`1) What is the main idea of the passage?
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
"they" nằm trong câu nói về thói quen mua sắm của khách hàng -> B.`}
                    />

                    <div className="mt-2 flex gap-2">
                        <button
                            onClick={handlePreview}
                            className="border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-xs font-medium rounded px-3 py-2"
                        >
                            Xem trước
                        </button>

                        <button
                            onClick={handleCreate}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded px-3 py-2 shadow"
                        >
                            🚀 Tạo đề
                        </button>
                    </div>
                </div>
            </div>

            {/* PREVIEW BLOCK */}
            <div className="mt-6 border rounded-lg bg-white p-3">
                <div className="text-sm font-semibold text-gray-800 mb-2">
                    Xem trước ({preview.length} câu)
                </div>

                {preview.length === 0 ? (
                    <div className="text-sm text-gray-500">
                        Chưa có câu hỏi xem trước.
                    </div>
                ) : (
                    <div className="space-y-4">
                        {preview.map((q, idx) => (
                            <div
                                key={idx}
                                className="border rounded p-3 bg-gray-50 text-sm"
                            >
                                <div className="font-semibold text-gray-800 mb-1">
                                    Câu {q.number}
                                </div>

                                <div className="text-gray-900 whitespace-pre-line mb-2">
                                    {q.prompt}
                                </div>

                                <ul className="list-disc pl-5 text-gray-800 mb-2">
                                    <li>
                                        <b>A.</b> {q.choices.A}
                                    </li>
                                    <li>
                                        <b>B.</b> {q.choices.B}
                                    </li>
                                    <li>
                                        <b>C.</b> {q.choices.C}
                                    </li>
                                    <li>
                                        <b>D.</b> {q.choices.D}
                                    </li>
                                </ul>

                                <div className="text-[11px] text-gray-700 mb-2">
                                    Đáp án:{" "}
                                    <b className="text-indigo-600">{q.answer || "?"}</b>
                                </div>

                                <label className="block text-[11px] font-medium text-gray-700 mb-1">
                                    Giải thích (HTML OK, chỉ hiện sau khi học viên nộp bài)
                                </label>
                                <textarea
                                    className="w-full border rounded px-2 py-1 text-[11px] min-h-[60px]"
                                    value={q.explanationHtml || ""}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setPreview((prev) =>
                                            prev.map((p, ii) =>
                                                ii === idx ? { ...p, explanationHtml: val } : p
                                            )
                                        );
                                    }}
                                    placeholder="<p>Giải thích tại sao đáp án đúng...</p>"
                                />
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="mt-3 text-[11px] text-gray-500 leading-relaxed">
                <b>Lưu ý:</b> Sau khi ấn “Tạo đề”, đề sẽ xuất hiện trong Admin →
                Tests. Học viên sẽ thấy đề này trong StudyHome (nếu visibility là
                'all'). Khi làm xong và bấm Nộp bài, trang Review sẽ hiển thị
                Đáp án đúng và Giải thích của từng câu.
            </div>
        </div>
    );
}

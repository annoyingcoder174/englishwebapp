// client/src/pages/student/MockTestRunner.jsx
import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../utils/api";
import ProgressBar from "../../components/ProgressBar";

// Helper: read ?section=Listening from URL, default later if invalid
const getInitialSectionFromQuery = () =>
    new URLSearchParams(window.location.search).get("section") || null;

// Turn /uploads/foo.mp3 into absolute URL for browser
function toAssetUrl(u) {
    if (!u) return "";
    if (/^https?:\/\//i.test(u)) return u;

    const base =
        import.meta?.env?.VITE_API_URL ||
        `${window.location.protocol}//${window.location.hostname}:5001/api`;

    // We serve uploads at /api/uploads/*
    // Builder might save "uploads/..." or "/uploads/..." or a full URL.
    if (u.startsWith("http://") || u.startsWith("https://")) return u;
    if (u.startsWith("/uploads/")) return `${base}${u.replace(/^\/api/, "")}`;
    if (u.startsWith("uploads/")) return `${base}/${u}`;
    return `${base}${u.startsWith("/") ? u : `/${u}`}`;
}

// Convert submission.answers ( [{section, number, choice}, ...] )
// into { [questionNumber]: choice } for the given section
function answersArrayToMap(submission, sectionName) {
    const map = {};
    if (!submission?.answers) return map;
    submission.answers.forEach((a) => {
        if (a.section === sectionName && (a.number || a.number === 0)) {
            map[a.number] = a.choice;
        }
    });
    return map;
}

export default function MockTestRunner() {
    const { id } = useParams();
    const navigate = useNavigate();

    // server data
    const [test, setTest] = useState(null); // MockTest
    const [submission, setSubmission] = useState(null); // MockSubmission

    // which test section ("Listening"/"Reading") is active
    const [sectionName, setSectionName] = useState(getInitialSectionFromQuery());

    // which flat question index within that section
    const [currentIdx, setCurrentIdx] = useState(0);

    // timer state
    const [timerSec, setTimerSec] = useState(null);
    const timerRef = useRef(null);

    // answer tracking
    const [draftAnswers, setDraftAnswers] = useState({});
    const [savedAnswers, setSavedAnswers] = useState({});
    const [autosaveBusy, setAutosaveBusy] = useState(false);

    // -------------------------------------------------
    // INITIAL LOAD
    // -------------------------------------------------
    useEffect(() => {
        (async () => {
            try {
                // 1. full test (will 403 if not allowed or 404 if deleted)
                const tRes = await api.get(`/mocktests/${id}`);
                const fullTest = tRes.data;

                // 2. ensure submission record exists (POST /start)
                //    may 403 if blocked etc
                await api.post(`/mocktests/${id}/start`);

                // 3. fetch submission data
                const subRes = await api.get(`/mocktests/${id}/submission`);

                setTest(fullTest);
                setSubmission(subRes.data);

                // figure initial section
                const wanted = getInitialSectionFromQuery();
                const names = (fullTest.sections || []).map((s) => s.name);
                const fallback = names[0] || null;
                const chosenSection = names.includes(wanted) ? wanted : fallback;
                setSectionName(chosenSection || null);

                // load saved answers for that chosen section
                const initMap = answersArrayToMap(subRes.data, chosenSection || "");
                setSavedAnswers(initMap);
                setDraftAnswers(initMap);
            } catch (err) {
                console.error("Failed to load runner:", err?.response?.data || err);
                alert(
                    err?.response?.data?.error ||
                    "Không tạo được phiên làm bài. Có thể đề đã bị xoá hoặc bạn không còn quyền truy cập."
                );
            }
        })();
    }, [id]);

    // -------------------------------------------------
    // BUILD DERIVED SECTION / QUESTION LIST
    // -------------------------------------------------
    const { sectionObj, flatQuestions } = useMemo(() => {
        if (!test || !sectionName) {
            return { sectionObj: null, flatQuestions: [] };
        }
        const sec = (test.sections || []).find((s) => s.name === sectionName);
        if (!sec) {
            return { sectionObj: null, flatQuestions: [] };
        }

        // flatten questions but keep reference to group metadata
        const out = [];
        (sec.groups || []).forEach((g, gi) => {
            (g.questions || []).forEach((q, qi) => {
                out.push({
                    ...q,
                    _groupIdx: gi,
                    _qIdx: qi,
                    _group: g,
                });
            });
        });

        // sort by question.number for stable nav
        out.sort((a, b) => (a.number || 0) - (b.number || 0));

        return { sectionObj: sec, flatQuestions: out };
    }, [test, sectionName]);

    // Clamp currentIdx if switching section or fewer questions
    useEffect(() => {
        if (currentIdx >= flatQuestions.length) {
            setCurrentIdx(0);
        }
    }, [flatQuestions, currentIdx]);

    // -------------------------------------------------
    // TIMER
    // -------------------------------------------------
    // set (or reset) timer when we get a sectionObj
    useEffect(() => {
        if (!sectionObj) return;
        const totalSeconds =
            (sectionObj.durationMinutes ||
                (sectionObj.name === "Listening" ? 45 : 75)) * 60;
        setTimerSec(totalSeconds);
    }, [sectionObj]);

    // countdown effect
    useEffect(() => {
        if (timerSec === null) return;
        if (timerRef.current) clearInterval(timerRef.current);

        timerRef.current = setInterval(() => {
            setTimerSec((prev) => {
                if (prev === null) return prev;
                if (prev <= 1) {
                    clearInterval(timerRef.current);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timerRef.current);
    }, [timerSec]);

    // -------------------------------------------------
    // SYNC ANSWERS WHEN SECTION CHANGES OR SUBMISSION UPDATES
    // -------------------------------------------------
    useEffect(() => {
        if (!submission || !sectionName) return;
        const map = answersArrayToMap(submission, sectionName);
        setSavedAnswers(map);
        // keep any local unsaved stuff merged, but ensure section answers are there
        setDraftAnswers((prev) => ({ ...map, ...prev }));
        setCurrentIdx(0);
    }, [submission, sectionName]);

    // current question + its group
    const currentQ = flatQuestions[currentIdx] || null;
    const currentGroup = currentQ?._group || null;

    // chosen answer for currentQ from draftAnswers
    const chosenChoice = useMemo(() => {
        if (!currentQ) return "";
        return draftAnswers[currentQ.number] ?? "";
    }, [draftAnswers, currentQ]);

    // -------------------------------------------------
    // AUTOSAVE
    // -------------------------------------------------
    const handleSelectChoice = useCallback(
        async (choice) => {
            if (!currentQ || !sectionObj) return;
            const qNum = currentQ.number;

            // local UI first
            setDraftAnswers((prev) => ({
                ...prev,
                [qNum]: choice,
            }));

            setAutosaveBusy(true);
            try {
                // send to backend
                await api.post(`/mocktests/${id}/answer`, {
                    section: sectionObj.name,
                    number: qNum,
                    choice,
                });

                // refetch submission so savedAnswers stays aligned
                const subRes = await api.get(`/mocktests/${id}/submission`);
                setSubmission(subRes.data);

                const syncMap = answersArrayToMap(subRes.data, sectionObj.name);
                setSavedAnswers(syncMap);
            } catch (err) {
                console.error("autosave failed:", err?.response?.data || err);
            } finally {
                setAutosaveBusy(false);
            }
        },
        [currentQ, sectionObj, id]
    );

    // -------------------------------------------------
    // NAV HELPERS
    // -------------------------------------------------
    const goPrev = () => {
        setCurrentIdx((i) => Math.max(i - 1, 0));
    };
    const goNext = () => {
        setCurrentIdx((i) => Math.min(i + 1, flatQuestions.length - 1));
    };
    const goToQuestion = (idx) => {
        if (idx >= 0 && idx < flatQuestions.length) {
            setCurrentIdx(idx);
        }
    };

    // switch Listening <-> Reading
    const handleSwitchSection = () => {
        if (!test) return;
        const names = (test.sections || []).map((s) => s.name);
        if (names.length < 2) return;
        const i = names.indexOf(sectionName);
        const nextName = names[(i + 1) % names.length];

        setSectionName(nextName);
        setCurrentIdx(0);

        // also reflect in URL (?section=)
        navigate(`/mock/${id}/run?section=${encodeURIComponent(nextName)}`, {
            replace: true,
        });
    };

    // submit test
    async function handleSubmitScore() {
        try {
            await api.post(`/mocktests/${id}/finish`);
            navigate(`/mock/${id}/review`);
        } catch (err) {
            console.error("finish error:", err?.response?.data || err);
            alert(err?.response?.data?.error || "Lỗi khi nộp bài.");
        }
    }

    // -------------------------------------------------
    // UI HELPERS
    // -------------------------------------------------
    const mm = Math.floor((timerSec ?? 0) / 60)
        .toString()
        .padStart(2, "0");
    const ss = ((timerSec ?? 0) % 60).toString().padStart(2, "0");

    const timePct =
        sectionObj && sectionObj.durationMinutes
            ? 1 - (timerSec ?? 0) / (sectionObj.durationMinutes * 60)
            : 0;

    // color for nav chips
    function chipClassFor(qNum, idx) {
        const draft = draftAnswers[qNum];
        const saved = savedAnswers[qNum];
        const st = !draft ? "empty" : draft !== saved ? "unsaved" : "saved";

        let base =
            "w-8 h-8 flex items-center justify-center rounded text-xs font-semibold cursor-pointer border transition-all duration-150";
        if (st === "empty")
            base += " bg-white text-gray-700 border-gray-300";
        if (st === "unsaved")
            base += " bg-yellow-100 text-yellow-800 border-yellow-400";
        if (st === "saved")
            base += " bg-blue-100 text-blue-800 border-blue-400";
        if (idx === currentIdx) base += " ring-2 ring-indigo-500";
        return base + " hover:scale-105";
    }

    // -------------------------------------------------
    // RENDER QUESTION TYPES
    // -------------------------------------------------

    // FILL_BLOCK helper (NO teacher notes here!)
    function renderFillBlock(q) {
        // We'll store all blanks for this block question as a single choice string:
        // "slot=ans||slot2=ans2||..."
        const blanks = q.blanks || [];

        const combinedRaw = chosenChoice || "";
        const mapPerSlot = {};
        combinedRaw.split("||").forEach((part) => {
            const [slotStr, ans] = part.split("=");
            if (slotStr && ans !== undefined) {
                mapPerSlot[slotStr.trim()] = ans;
            }
        });

        function updateSlot(slotNumber, value) {
            const newMap = { ...mapPerSlot, [slotNumber]: value };
            const joined = Object.entries(newMap)
                .map(([slot, ans]) => `${slot}=${ans}`)
                .join("||");
            handleSelectChoice(joined);
        }

        return (
            <div className="space-y-4">
                {/* blockText / passage */}
                <div className="text-sm text-gray-700 whitespace-pre-line border rounded bg-white p-3 shadow-inner">
                    {q.blockText || "(Đoạn văn có chỗ trống...)"}
                </div>

                {/* each blank input */}
                <div className="space-y-3">
                    {blanks.map((b, i) => (
                        <div
                            key={b.slot ?? i}
                            className="border rounded p-3 bg-gray-50 text-sm space-y-2"
                        >
                            <div className="font-semibold text-gray-800 flex flex-wrap items-center gap-2">
                                <span>Ô trống #{b.slot}</span>
                                {b.limit ? (
                                    <span className="text-[11px] px-2 py-0.5 rounded bg-blue-100 text-blue-700 border border-blue-300">
                                        {b.limit}
                                    </span>
                                ) : null}
                            </div>

                            <input
                                className="border rounded px-2 py-1 text-sm w-full"
                                placeholder="Câu trả lời của bạn..."
                                value={mapPerSlot[b.slot] ?? ""}
                                onChange={(e) => updateSlot(b.slot, e.target.value)}
                            />

                            {/* IMPORTANT:
                  We DO NOT render b.note here.
                  This hides teacher explanation (giải thích) during the test.
              */}
                        </div>
                    ))}
                </div>

                <div className="text-[11px] text-gray-500">
                    (Lưu ý: Hệ thống sẽ so sánh từng ô trống với đáp án giáo viên đặt.
                    Phân biệt chính tả.)
                </div>
            </div>
        );
    }

    function renderQuestionBody(q) {
        if (!q) return null;

        // 1) Multiple choice
        if (q.type === "MCQ") {
            return (
                <div className="space-y-2">
                    {(q.options || []).map((opt, i) => (
                        <label
                            key={opt.key || i}
                            className={`block border rounded p-2 cursor-pointer text-sm transition-colors duration-150 ${chosenChoice === opt.key
                                ? "bg-blue-50 border-blue-500"
                                : "bg-white hover:bg-gray-50"
                                } animate-slide-up`}
                            style={{ animationDelay: `${i * 40}ms` }}
                        >
                            <input
                                type="radio"
                                className="mr-2 accent-indigo-600"
                                name={`q-${q.number}`}
                                checked={chosenChoice === opt.key}
                                onChange={() => handleSelectChoice(opt.key)}
                            />
                            <span className="font-semibold">{opt.key}.</span>{" "}
                            <span>{opt.text}</span>
                        </label>
                    ))}
                </div>
            );
        }

        // 2) TRUE / FALSE / NOT GIVEN
        if (q.type === "TFNG") {
            const tfngChoices = ["TRUE", "FALSE", "NOT GIVEN"];
            return (
                <div className="space-y-2">
                    {tfngChoices.map((label, i) => (
                        <label
                            key={label}
                            className={`block border rounded p-2 cursor-pointer text-sm transition-colors duration-150 ${chosenChoice === label
                                ? "bg-blue-50 border-blue-500"
                                : "bg-white hover:bg-gray-50"
                                } animate-slide-up`}
                            style={{ animationDelay: `${i * 40}ms` }}
                        >
                            <input
                                type="radio"
                                className="mr-2 accent-indigo-600"
                                name={`q-${q.number}`}
                                checked={chosenChoice === label}
                                onChange={() => handleSelectChoice(label)}
                            />
                            <span className="font-semibold">{label}</span>
                        </label>
                    ))}
                </div>
            );
        }

        // 3) Short answer (single fill)
        if (q.type === "FILL") {
            return (
                <div className="space-y-2">
                    <input
                        type="text"
                        className="w-full border rounded p-2 text-sm"
                        placeholder="Nhập câu trả lời..."
                        value={chosenChoice ?? ""}
                        onChange={(e) => handleSelectChoice(e.target.value)}
                    />
                    <div className="text-[11px] text-gray-500">
                        (Chính tả quan trọng)
                    </div>
                </div>
            );
        }

        // 4) Many blanks in one block
        if (q.type === "FILL_BLOCK") {
            return renderFillBlock(q);
        }

        // 5) MATCH (pairing). We'll store student's answers as "left=>typed||left2=>typed2"
        if (q.type === "MATCH") {
            const pairs = q.pairs || [];
            const combinedRaw = chosenChoice || ""; // "left=>ans||left2=>ans2"
            const mapLeftToRight = {};
            combinedRaw.split("||").forEach((chunk) => {
                const [L, R] = chunk.split("=>");
                if (L && R !== undefined) {
                    mapLeftToRight[L.trim()] = R;
                }
            });

            function updatePair(leftVal, typedVal) {
                const newMap = { ...mapLeftToRight, [leftVal]: typedVal };
                const joined = Object.entries(newMap)
                    .map(([L, R]) => `${L}=>${R}`)
                    .join("||");
                handleSelectChoice(joined);
            }

            return (
                <div className="space-y-2">
                    <div className="text-[13px] text-gray-700 font-medium">
                        Ghép cặp / Match
                    </div>
                    <div className="space-y-2">
                        {pairs.map((p, i) => (
                            <div
                                key={i}
                                className="border rounded p-3 bg-white text-sm flex flex-col gap-2 shadow-sm"
                            >
                                <div className="font-semibold text-gray-800">
                                    {p.left || `Mục ${i + 1}`}
                                </div>
                                <input
                                    className="border rounded px-2 py-1 text-sm w-full"
                                    placeholder="Cặp với gì?"
                                    value={mapLeftToRight[p.left] ?? ""}
                                    onChange={(e) => updatePair(p.left, e.target.value)}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            );
        }

        // fallback / unknown type
        return (
            <div className="text-sm text-gray-500 italic">
                (Loại câu hỏi chưa được hỗ trợ hiển thị)
            </div>
        );
    }

    // render left panel (media/instructions/passage)
    function renderGroupContext() {
        if (!currentGroup || !sectionObj) {
            return (
                <div className="text-gray-400 italic animate-fade-in">
                    (Không có nội dung nhóm)
                </div>
            );
        }

        const isListening = sectionObj.name === "Listening";
        const partNum = sectionObj.part;

        const imgUrl = currentGroup.imageUrl
            ? toAssetUrl(currentGroup.imageUrl)
            : "";
        const audioUrl = currentGroup.audioUrl
            ? toAssetUrl(currentGroup.audioUrl)
            : "";

        const showImage = !!imgUrl;
        const showAudio =
            !!audioUrl &&
            isListening &&
            (partNum === 1 || partNum === 2 || partNum === 3 || partNum === 4);

        const passageRaw = currentGroup.passageHtml || "";
        const trimmed = passageRaw.trim();

        // naive "does teacher seem to have typed HTML tags?"
        const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(trimmed);

        const showPassage = !isListening && trimmed !== "";

        return (
            <>
                {showAudio && (
                    <div className="space-y-2 animate-slide-up">
                        <div className="text-sm font-semibold text-gray-700">
                            Nghe đoạn hội thoại / bài nói
                        </div>
                        <audio controls className="w-full" src={audioUrl}>
                            Trình duyệt của bạn không hỗ trợ audio.
                        </audio>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                            <input
                                type="checkbox"
                                disabled
                                className="accent-indigo-600"
                            />
                            <span>Chỉ phát 1 lần (đang khoá)</span>
                        </div>
                    </div>
                )}

                {showImage && (
                    <div className="w-full flex justify-center animate-scale-in">
                        <img
                            src={imgUrl}
                            alt="Hình minh hoạ"
                            className="max-h-64 object-contain rounded shadow"
                        />
                    </div>
                )}

                {showPassage && (
                    <div className="animate-slide-up">
                        <div className="text-sm font-semibold text-gray-700 mb-2">
                            Đoạn văn
                        </div>

                        {looksLikeHtml ? (
                            // Teacher pasted HTML (bold, <p>, etc). Render as HTML.
                            <div
                                className="prose prose-sm max-w-none text-gray-800 bg-white rounded border shadow p-3"
                                dangerouslySetInnerHTML={{
                                    __html: passageRaw,
                                }}
                            />
                        ) : (
                            // Teacher just typed text with line breaks. Preserve \n.
                            <div className="prose prose-sm max-w-none text-gray-800 bg-white rounded border shadow p-3 whitespace-pre-line">
                                {passageRaw}
                            </div>
                        )}
                    </div>
                )}

                {!showImage && !showAudio && !showPassage && (
                    <div className="text-gray-400 italic animate-fade-in">
                        (Không có nội dung mô tả cho nhóm này)
                    </div>
                )}
            </>
        );
    }


    // -------------------------------------------------
    // RENDER WHOLE PAGE
    // -------------------------------------------------
    if (!test) {
        return (
            <div className="p-4 text-center text-gray-600 animate-fade-in">
                Đang tải đề...
            </div>
        );
    }

    if (!sectionObj) {
        return (
            <div className="p-4 text-center text-gray-600 animate-fade-in">
                Không tìm thấy phần thi hợp lệ (Listening / Reading). Hãy quay lại.
            </div>
        );
    }

    if (!flatQuestions.length) {
        return (
            <div className="p-4 text-center text-gray-600 animate-fade-in">
                Phần {sectionObj.name} hiện chưa có câu hỏi. Vui lòng chọn phần khác.
                <div className="mt-4 flex justify-center">
                    <button
                        className="bg-indigo-600 hover:bg-indigo-700 text-white rounded px-4 py-2 btn-press text-sm"
                        onClick={handleSwitchSection}
                    >
                        Chuyển phần
                    </button>
                </div>
            </div>
        );
    }

    if (!currentQ) {
        return (
            <div className="p-4 text-center text-gray-600 animate-fade-in">
                Đang tải đề...
            </div>
        );
    }

    return (
        <div className="flex flex-col md:flex-row h-screen animate-fade-in bg-gradient-to-br from-indigo-50 via-white to-violet-100 antialiased">
            {/* LEFT PANE (media, time, controls) */}
            <div className="md:w-1/2 border-r flex flex-col bg-white/50 backdrop-blur-sm">
                {/* header */}
                <div className="p-3 border-b bg-gray-50/80 backdrop-blur flex flex-col gap-2">
                    <div className="mb-2">
                        <ProgressBar value={timePct} label="Tiến độ thời gian" />
                    </div>

                    <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                            <div className="text-[10px] text-gray-500 uppercase">
                                {sectionObj.name} - Part {sectionObj.part}
                            </div>
                            <div className="font-semibold text-gray-800 text-sm truncate">
                                {currentGroup?.title || "Nhóm câu hỏi"}
                            </div>
                            <div className="text-[11px] text-gray-600 line-clamp-2">
                                {currentGroup?.instructions ||
                                    "Chọn / nhập câu trả lời đúng."}
                            </div>
                        </div>

                        <div className="text-right shrink-0">
                            <div className="text-[10px] text-gray-500 uppercase">
                                Thời gian còn lại
                            </div>
                            <div className="text-lg font-mono font-bold text-red-600">
                                {mm}:{ss}
                            </div>
                        </div>
                    </div>
                </div>

                {/* body (media/passages) */}
                <div className="flex-1 overflow-auto p-4 space-y-4">
                    {renderGroupContext()}
                </div>

                {/* footer controls */}
                <div className="border-t p-4 flex flex-wrap gap-2 text-xs bg-white/70 backdrop-blur">
                    <div className="text-gray-600 mr-auto truncate">
                        {test.title || "Đề TOEIC"} · Phần {sectionObj.name}
                    </div>

                    {(test.sections || []).length > 1 && (
                        <button
                            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded px-3 py-2 btn-press"
                            onClick={handleSwitchSection}
                        >
                            {sectionObj.name === "Reading"
                                ? "Chuyển sang Nghe"
                                : "Chuyển sang Đọc"}
                        </button>
                    )}

                    <button
                        className="bg-red-600 hover:bg-red-700 text-white rounded px-3 py-2 btn-press"
                        onClick={handleSubmitScore}
                        disabled={autosaveBusy}
                    >
                        Nộp bài
                    </button>
                </div>
            </div>

            {/* RIGHT PANE (question nav + question answer UI) */}
            <div className="md:w-1/2 flex flex-col bg-white/70 backdrop-blur">
                {/* Navigator */}
                <div className="border-b bg-gray-50/80 backdrop-blur p-3">
                    <div className="text-[11px] text-gray-600 font-semibold mb-2">
                        Điều hướng câu hỏi ({sectionObj.name})
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {flatQuestions.map((q, idx) => (
                            <button
                                key={q.number ?? idx}
                                className={chipClassFor(q.number, idx)}
                                onClick={() => goToQuestion(idx)}
                            >
                                {q.number ?? idx + 1}
                            </button>
                        ))}
                    </div>

                    <div className="text-[10px] text-gray-500 mt-2 flex flex-wrap gap-4">
                        <span className="flex items-center gap-1">
                            <span className="w-3 h-3 border border-gray-300 bg-white rounded inline-block" />
                            Chưa chọn
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="w-3 h-3 border border-yellow-400 bg-yellow-100 rounded inline-block" />
                            Chưa lưu
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="w-3 h-3 border border-blue-400 bg-blue-100 rounded inline-block" />
                            Đã lưu
                        </span>
                    </div>
                </div>

                {/* Question */}
                <div className="flex-1 overflow-auto p-4 space-y-4">
                    <div className="text-sm text-gray-500 animate-fade-in">
                        Câu{" "}
                        <span className="font-semibold">
                            {currentQ.number} / {flatQuestions.length}
                        </span>
                    </div>

                    {/* prompt */}
                    <div className="font-medium text-base whitespace-pre-line animate-slide-up text-gray-900">
                        {currentQ.prompt || "(Không có nội dung câu hỏi)"}
                    </div>

                    {/* answer UI depends on q.type */}
                    {renderQuestionBody(currentQ)}
                </div>

                {/* nav prev / next */}
                <div className="border-t p-4 flex items-center justify-between bg-white/70 backdrop-blur">
                    <button
                        className="bg-gray-200 hover:bg-gray-300 text-gray-800 rounded px-3 py-2 text-sm btn-press"
                        onClick={goPrev}
                        disabled={currentIdx === 0}
                    >
                        ← Trước
                    </button>

                    <button
                        className="bg-gray-200 hover:bg-gray-300 text-gray-800 rounded px-3 py-2 text-sm btn-press"
                        onClick={goNext}
                        disabled={currentIdx === flatQuestions.length - 1}
                    >
                        Tiếp →
                    </button>
                </div>

                {autosaveBusy && (
                    <div className="px-4 pb-3 text-[11px] text-gray-500 animate-fade-in">
                        Đang lưu câu trả lời...
                    </div>
                )}
            </div>
        </div>
    );
}

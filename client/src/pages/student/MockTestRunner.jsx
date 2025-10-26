import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../utils/api";
import ProgressBar from "../../components/ProgressBar";

const getSectionFromQuery = () =>
    new URLSearchParams(window.location.search).get("section") || "Reading";

/** Convert /uploads/* to absolute so <audio>/<img> can load */
const toAssetUrl = (u) => {
    if (!u) return "";
    if (/^https?:\/\//i.test(u)) return u;
    const base =
        import.meta?.env?.VITE_API_URL ||
        `${window.location.protocol}//${window.location.hostname}:5001`;
    return `${base}${u.startsWith("/") ? u : `/${u}`}`;
};

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

    const [test, setTest] = useState(null);
    const [submission, setSubmission] = useState(null);

    const [sectionName, setSectionName] = useState(getSectionFromQuery());
    const [currentIdx, setCurrentIdx] = useState(0);

    const [timerSec, setTimerSec] = useState(null);
    const timerRef = useRef(null);

    const [draftAnswers, setDraftAnswers] = useState({});
    const [savedAnswers, setSavedAnswers] = useState({});
    const [autosaveBusy, setAutosaveBusy] = useState(false);

    useEffect(() => {
        async function load() {
            try {
                const tRes = await api.get(`/mocktests/${id}`);
                setTest(tRes.data);

                await api.post(`/mocktests/${id}/start`);
                const subRes = await api.get(`/mocktests/${id}/submission`);
                setSubmission(subRes.data);

                const initialMap = answersArrayToMap(subRes.data, getSectionFromQuery());
                setSavedAnswers(initialMap);
                setDraftAnswers(initialMap);
            } catch (err) {
                console.error("Failed to load runner:", err);
                alert("Không tải được đề thi/phiên làm bài.");
            }
        }
        load();
    }, [id]);

    useEffect(() => {
        if (!test) return;
        const secObj = test.sections?.find((s) => s.name === sectionName);
        if (!secObj) return;
        const totalSeconds =
            (secObj.durationMinutes || (sectionName === "Listening" ? 45 : 75)) * 60;
        setTimerSec(totalSeconds);
    }, [test, sectionName]);

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

    const { flatQuestions, sectionObj } = useMemo(() => {
        if (!test) return { flatQuestions: [], sectionObj: null };
        const sec = test.sections?.find((s) => s.name === sectionName);
        const out = [];
        sec?.groups?.forEach((g, gi) => {
            g.questions?.forEach((q, qi) => {
                out.push({
                    ...q,
                    groupTitle: g.title || "",
                    _group: g,
                    _groupIndex: gi,
                    _questionIndexInGroup: qi,
                });
            });
        });
        out.sort((a, b) => (a.number || 0) - (b.number || 0));
        return { flatQuestions: out, sectionObj: sec || null };
    }, [test, sectionName]);

    const currentQ = flatQuestions[currentIdx] || null;
    const currentGroup = currentQ?._group;

    useEffect(() => {
        if (!submission) return;
        const map = answersArrayToMap(submission, sectionName);
        setSavedAnswers(map);
        setDraftAnswers((prev) => ({ ...map, ...prev }));
        setCurrentIdx(0);
    }, [sectionName, submission]);

    const chosenChoice = useMemo(() => {
        if (!currentQ) return "";
        return draftAnswers[currentQ.number] ?? "";
    }, [draftAnswers, currentQ]);

    const handleSelectChoice = useCallback(
        async (choice) => {
            if (!currentQ) return;
            const qNum = currentQ.number;
            setDraftAnswers((prev) => ({ ...prev, [qNum]: choice }));
            setAutosaveBusy(true);
            try {
                await api.post(`/mocktests/${id}/answer`, {
                    section: sectionName,
                    number: qNum,
                    choice,
                });
                const subRes = await api.get(`/mocktests/${id}/submission`);
                setSubmission(subRes.data);
                const syncMap = answersArrayToMap(subRes.data, sectionName);
                setSavedAnswers(syncMap);
            } catch (err) {
                console.error("autosave failed:", err);
            } finally {
                setAutosaveBusy(false);
            }
        },
        [currentQ, id, sectionName]
    );

    const goPrev = () => setCurrentIdx((i) => Math.max(i - 1, 0));
    const goNext = () =>
        setCurrentIdx((i) => Math.min(i + 1, flatQuestions.length - 1));
    const goToQuestion = (idx) => {
        if (idx >= 0 && idx < flatQuestions.length) setCurrentIdx(idx);
    };

    const handleSwitchSection = () => {
        const next = sectionName === "Reading" ? "Listening" : "Reading";
        setSectionName(next);
        setCurrentIdx(0);
        navigate(`/mock/${id}/run?section=${encodeURIComponent(next)}`, {
            replace: true,
        });
    };

    async function handleSubmitScore() {
        try {
            await api.post(`/mocktests/${id}/finish`);
            navigate(`/mock/${id}/review`);
        } catch (err) {
            console.error("finish error:", err);
            const msg = err?.response?.data?.error || "Lỗi khi nộp bài.";
            alert(msg);
        }
    }

    const mm = Math.floor((timerSec ?? 0) / 60).toString().padStart(2, "0");
    const ss = ((timerSec ?? 0) % 60).toString().padStart(2, "0");
    const timePct =
        sectionObj && sectionObj.durationMinutes
            ? 1 - (timerSec ?? 0) / (sectionObj.durationMinutes * 60)
            : 0;

    if (!test || !currentQ || !sectionObj) {
        return (
            <div className="p-4 text-center text-gray-600 animate-fade-in">
                Đang tải đề...
            </div>
        );
    }

    const isListening = sectionObj.name === "Listening";
    const partNum = sectionObj.part;

    const imgUrl = currentGroup?.imageUrl ? toAssetUrl(currentGroup.imageUrl) : "";
    const audioUrl = currentGroup?.audioUrl ? toAssetUrl(currentGroup.audioUrl) : "";

    const showImage = !!imgUrl && (isListening || !isListening); // cho phép ảnh ở mọi phần
    const showAudio =
        isListening && (partNum === 1 || partNum === 2 || partNum === 3 || partNum === 4) && !!audioUrl;
    const showPassage = !isListening && currentGroup?.passageHtml;

    function chipClassFor(qNum, idx) {
        const draft = draftAnswers[qNum];
        const saved = savedAnswers[qNum];
        const st = !draft ? "empty" : draft !== saved ? "unsaved" : "saved";
        let base =
            "w-8 h-8 flex items-center justify-center rounded text-xs font-semibold cursor-pointer border transition-all duration-150";
        if (st === "empty") base += " bg-white text-gray-700 border-gray-300";
        if (st === "unsaved") base += " bg-yellow-100 text-yellow-800 border-yellow-400";
        if (st === "saved") base += " bg-blue-100 text-blue-800 border-blue-400";
        if (idx === currentIdx) base += " ring-2 ring-indigo-500";
        return base + " hover:scale-105";
    }

    const mcqChoices = (currentQ.options || []).map((opt, i) => (
        <label
            key={opt.key}
            className={`block border rounded p-2 cursor-pointer text-sm transition-colors duration-150 ${chosenChoice === opt.key ? "bg-blue-50 border-blue-500" : "bg-white hover:bg-gray-50"
                } animate-slide-up`}
            style={{ animationDelay: `${i * 40}ms` }}
        >
            <input
                type="radio"
                className="mr-2 accent-indigo-600"
                name={`q-${currentQ.number}`}
                checked={chosenChoice === opt.key}
                onChange={() => handleSelectChoice(opt.key)}
            />
            <span className="font-semibold">{opt.key}.</span>{" "}
            <span>{opt.text}</span>
        </label>
    ));

    return (
        <div className="flex flex-col md:flex-row h-screen animate-fade-in">
            {/* LEFT */}
            <div className="md:w-1/2 border-r flex flex-col">
                <div className="p-3 border-b bg-gray-50">
                    <div className="mb-2">
                        <ProgressBar value={timePct} label="Tiến độ thời gian" />
                    </div>
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-xs text-gray-500 uppercase">
                                {sectionObj.name} - Part {sectionObj.part}
                            </div>
                            <div className="font-semibold text-gray-800 text-sm">
                                {currentGroup?.title || "Nhóm câu hỏi"}
                            </div>
                            <div className="text-xs text-gray-600">
                                {currentGroup?.instructions || "Chọn đáp án đúng nhất."}
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-xs text-gray-500 uppercase">
                                Thời gian còn lại
                            </div>
                            <div className="text-lg font-mono font-bold text-red-600">
                                {mm}:{ss}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-auto p-4 space-y-4">
                    {showAudio && (
                        <div className="space-y-2 animate-slide-up">
                            <div className="text-sm font-semibold text-gray-700">
                                Nghe đoạn hội thoại / bài nói
                            </div>
                            <audio controls className="w-full" src={audioUrl}>
                                Trình duyệt của bạn không hỗ trợ audio.
                            </audio>
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                                <input type="checkbox" disabled className="accent-indigo-600" />
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
                            <div
                                className="prose prose-sm max-w-none text-gray-800 bg-white rounded border shadow p-3"
                                dangerouslySetInnerHTML={{
                                    __html: currentGroup.passageHtml || "",
                                }}
                            />
                        </div>
                    )}

                    {!showImage && !showAudio && !showPassage && (
                        <div className="text-gray-400 italic animate-fade-in">
                            (Không có nội dung mô tả cho nhóm này)
                        </div>
                    )}
                </div>

                <div className="border-t p-4 flex flex-wrap gap-2 text-xs">
                    <div className="text-gray-600 mr-auto">
                        {test.title || "Đề TOEIC"} · Phần {sectionName}
                    </div>

                    <button
                        className="bg-indigo-600 hover:bg-indigo-700 text-white rounded px-3 py-2 btn-press"
                        onClick={handleSwitchSection}
                    >
                        {sectionName === "Reading" ? "Chuyển sang Nghe" : "Chuyển sang Đọc"}
                    </button>

                    <button
                        className="bg-red-600 hover:bg-red-700 text-white rounded px-3 py-2 btn-press"
                        onClick={handleSubmitScore}
                        disabled={autosaveBusy}
                    >
                        Nộp bài
                    </button>
                </div>
            </div>

            {/* RIGHT */}
            <div className="md:w-1/2 flex flex-col">
                {/* Navigator */}
                <div className="border-b bg-gray-50 p-3">
                    <div className="text-xs text-gray-600 font-semibold mb-2">
                        Điều hướng câu hỏi ({sectionObj.name})
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {flatQuestions.map((q, idx) => (
                            <button
                                key={q.number}
                                className={chipClassFor(q.number, idx)}
                                onClick={() => goToQuestion(idx)}
                            >
                                {q.number}
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

                    <div className="font-medium text-base whitespace-pre-line animate-slide-up">
                        {currentQ.prompt}
                    </div>

                    {currentQ.type === "MCQ" ? (
                        <div className="space-y-2">{mcqChoices}</div>
                    ) : (
                        <input
                            type="text"
                            className="w-full border rounded p-2 text-sm"
                            placeholder="Nhập câu trả lời..."
                            value={chosenChoice ?? ""}
                            onChange={(e) => handleSelectChoice(e.target.value)}
                        />
                    )}
                </div>

                <div className="border-t p-4 flex items-center justify-between">
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
                    <div className="px-4 pb-3 text-xs text-gray-500 animate-fade-in">
                        Đang lưu câu trả lời...
                    </div>
                )}
            </div>
        </div>
    );
}

// client/src/pages/student/MockReviewPage.jsx
import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import api from "../../utils/api";

export default function MockReviewPage() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    // -------------------------------------------------
    // LOAD REVIEW DATA
    // -------------------------------------------------
    useEffect(() => {
        (async () => {
            try {
                const res = await api.get(`/mocktests/${id}/review`);
                setData(res.data);
            } catch (err) {
                console.error("Error loading review:", err?.response?.data || err);
                alert("Không tải được kết quả. Có thể bạn chưa nộp bài.");
                navigate(`/mock/${id}/run`, { replace: true });
            } finally {
                setLoading(false);
            }
        })();
    }, [id, navigate]);

    if (loading) {
        return (
            <div className="p-4 text-center text-gray-600 animate-fade-in">
                Đang tải kết quả...
            </div>
        );
    }
    if (!data) {
        return (
            <div className="p-4 text-center text-red-600 animate-fade-in">
                Không có dữ liệu xem lại.
            </div>
        );
    }

    // -------------------------------------------------
    // DATA SHAPING / FALLBACKS
    // -------------------------------------------------
    const {
        title = "Đề thi",
        description = "",
        finishedAt,
        sectionScores = [],
        totalCorrect = 0,
        totalQuestions = 0,
        items = [],
    } = data;

    // Build a quick lookup for sectionScores by section name
    const secScoreMap = {};
    sectionScores.forEach((s) => {
        secScoreMap[s.section] = s;
    });

    // overall %
    const overallPct =
        totalQuestions > 0
            ? Math.round((totalCorrect / totalQuestions) * 100)
            : 0;

    // We’ll pull the first non-empty Reading / Listening score card for summary.
    const readingCard = secScoreMap["Reading"];
    const listeningCard = secScoreMap["Listening"];

    // -------------------------------------------------
    // RENDER HELPERS
    // -------------------------------------------------

    function ScoreCard({ label, card, color = "indigo" }) {
        const correct = card?.correct ?? 0;
        const total = card?.total ?? 0;
        const pct =
            total > 0 ? Math.round((correct / total) * 100) : 0;

        // "color" controls classes
        const palette = {
            indigo: {
                box: "bg-indigo-50 border-indigo-200 text-indigo-700",
                pct: "text-indigo-700",
            },
            violet: {
                box: "bg-violet-50 border-violet-200 text-violet-700",
                pct: "text-violet-700",
            },
            blue: {
                box: "bg-blue-50 border-blue-200 text-blue-700",
                pct: "text-blue-700",
            },
            green: {
                box: "bg-green-50 border-green-200 text-green-700",
                pct: "text-green-700",
            },
        }[color];

        return (
            <div
                className={`rounded-lg border p-3 text-center text-xs font-medium ${palette.box}`}
            >
                <div className="uppercase font-semibold">{label}</div>
                <div className="text-2xl font-bold leading-tight">
                    {correct} / {total}
                </div>
                <div className={`text-[11px] font-semibold ${palette.pct}`}>
                    {pct}%
                </div>
            </div>
        );
    }

    // Render MCQ / TFNG / FILL style comparison
    function renderSimpleQA(item, i) {
        const {
            number,
            prompt,
            chosen,
            correctAnswer,
            correct,
            explanationHtml,
            type,
        } = item;

        return (
            <div
                key={i}
                className={`border rounded-lg p-4 animate-slide-up ${correct
                        ? "border-green-400 bg-green-50"
                        : "border-red-400 bg-red-50"
                    }`}
                style={{ animationDelay: `${i * 25}ms` }}
            >
                {/* header */}
                <div className="flex justify-between items-start mb-2">
                    <div className="text-sm font-semibold text-gray-800">
                        Câu {number}{" "}
                        <span className="text-[11px] font-normal text-gray-500">
                            ({type})
                        </span>
                    </div>
                    <div className="text-xs font-mono">
                        {correct ? (
                            <span className="text-green-700 font-semibold">Đúng</span>
                        ) : (
                            <span className="text-red-700 font-semibold">Sai</span>
                        )}
                    </div>
                </div>

                {/* prompt */}
                <div className="text-sm text-gray-900 mb-3 whitespace-pre-line">
                    {prompt || "(Không có nội dung câu hỏi)"}
                </div>

                {/* answers */}
                <div className="text-xs text-gray-800 mb-2 space-y-1">
                    <div>
                        Bạn chọn:{" "}
                        <b className="text-gray-900 break-words">
                            {String(chosen ?? "—")}
                        </b>
                    </div>
                    <div>
                        Đáp án đúng:{" "}
                        <b className="text-gray-900 break-words">
                            {String(correctAnswer ?? "—")}
                        </b>
                    </div>
                </div>

                {/* explanation */}
                {explanationHtml ? (
                    <div className="mt-3">
                        <div className="text-xs font-semibold text-gray-700 mb-1">
                            Giải thích
                        </div>
                        <div
                            className="prose prose-xs max-w-none text-gray-800 bg-white rounded border p-2 shadow-sm"
                            // teacher's explanationHtml from MockBuilder per-question
                            dangerouslySetInnerHTML={{ __html: explanationHtml }}
                        />
                    </div>
                ) : null}
            </div>
        );
    }

    // Render FILL_BLOCK (many blanks with note/explanation per blank)
    function renderFillBlockQA(item, i) {
        const {
            number,
            prompt,
            type,
            correct, // overall correct flag (not super meaningful for multi-blank, but ok)
            blanksReview = [],
            // explanationHtml is usually empty for FILL_BLOCK
        } = item;

        return (
            <div
                key={i}
                className={`border rounded-lg p-4 animate-slide-up ${correct
                        ? "border-green-400 bg-green-50"
                        : "border-red-400 bg-red-50"
                    }`}
                style={{ animationDelay: `${i * 25}ms` }}
            >
                {/* header */}
                <div className="flex justify-between items-start mb-2">
                    <div className="text-sm font-semibold text-gray-800">
                        Câu {number}{" "}
                        <span className="text-[11px] font-normal text-gray-500">
                            ({type})
                        </span>
                    </div>
                    <div className="text-xs font-mono">
                        {correct ? (
                            <span className="text-green-700 font-semibold">Đúng</span>
                        ) : (
                            <span className="text-red-700 font-semibold">Xem đáp án</span>
                        )}
                    </div>
                </div>

                {/* optional high-level prompt for the block */}
                {prompt && (
                    <div className="text-sm text-gray-900 mb-3 whitespace-pre-line">
                        {prompt}
                    </div>
                )}

                {/* table-ish list of blanks */}
                <div className="space-y-3">
                    {blanksReview.map((b, bi) => {
                        const slotLabel = `Ô trống #${b.slot ?? bi + 1}`;
                        const studentOk =
                            (b.studentAnswer || "").trim().toLowerCase() ===
                            (b.correctAnswer || "").trim().toLowerCase();

                        return (
                            <div
                                key={bi}
                                className={`rounded border p-3 bg-white text-xs shadow-sm ${studentOk
                                        ? "border-green-300 bg-green-50/30"
                                        : "border-red-300 bg-red-50/30"
                                    }`}
                            >
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                    <div className="font-semibold text-gray-800">
                                        {slotLabel}{" "}
                                        {b.limit ? (
                                            <span className="text-[10px] font-normal text-gray-600 ml-2 px-2 py-0.5 rounded bg-gray-100 border border-gray-300">
                                                {b.limit}
                                            </span>
                                        ) : null}
                                    </div>
                                    <div className="text-[10px] font-mono">
                                        {studentOk ? (
                                            <span className="text-green-700 font-semibold">
                                                Đúng
                                            </span>
                                        ) : (
                                            <span className="text-red-700 font-semibold">
                                                Sai
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                                    <div className="bg-white/70 rounded border p-2">
                                        <div className="text-[10px] uppercase text-gray-500 font-semibold">
                                            Bạn trả lời
                                        </div>
                                        <div className="text-sm font-medium text-gray-900 break-words">
                                            {b.studentAnswer || "—"}
                                        </div>
                                    </div>

                                    <div className="bg-white/70 rounded border p-2">
                                        <div className="text-[10px] uppercase text-gray-500 font-semibold">
                                            Đáp án đúng
                                        </div>
                                        <div className="text-sm font-medium text-gray-900 break-words">
                                            {b.correctAnswer || "—"}
                                        </div>
                                    </div>
                                </div>

                                {b.note ? (
                                    <div className="mt-2 text-[11px] text-gray-700 leading-relaxed">
                                        {/* THIS is the teacher's explanation for that blank,
                       filled in MockBuilder as "note".
                       We DIDN'T show this to the student during the test.
                       Now we reveal it. */}
                                        {b.note}
                                    </div>
                                ) : null}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    // Render MATCH question review
    function renderMatchQA(item, i) {
        const {
            number,
            prompt,
            type,
            pairsReview = [],
            correct,
            explanationHtml,
        } = item;

        return (
            <div
                key={i}
                className={`border rounded-lg p-4 animate-slide-up ${correct
                        ? "border-green-400 bg-green-50"
                        : "border-red-400 bg-red-50"
                    }`}
                style={{ animationDelay: `${i * 25}ms` }}
            >
                <div className="flex justify-between items-start mb-2">
                    <div className="text-sm font-semibold text-gray-800">
                        Câu {number}{" "}
                        <span className="text-[11px] font-normal text-gray-500">
                            ({type})
                        </span>
                    </div>
                    <div className="text-xs font-mono">
                        {correct ? (
                            <span className="text-green-700 font-semibold">Đúng</span>
                        ) : (
                            <span className="text-red-700 font-semibold">Sai</span>
                        )}
                    </div>
                </div>

                <div className="text-sm text-gray-900 mb-3 whitespace-pre-line">
                    {prompt || "(Ghép cặp)"}
                </div>

                <div className="text-[11px] text-gray-700 bg-white rounded border p-2 shadow-sm">
                    {pairsReview.length === 0 ? (
                        <div className="italic text-gray-500">
                            (Không có dữ liệu ghép cặp để hiển thị)
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse text-[11px]">
                            <thead>
                                <tr className="text-gray-500 uppercase">
                                    <th className="border-b border-gray-300 py-1 pr-2 font-semibold">
                                        Trái
                                    </th>
                                    <th className="border-b border-gray-300 py-1 pr-2 font-semibold">
                                        Bạn chọn
                                    </th>
                                    <th className="border-b border-gray-300 py-1 pr-2 font-semibold">
                                        Đáp án đúng
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {pairsReview.map((p, pi) => {
                                    const ok =
                                        (p.studentRight || "").trim().toLowerCase() ===
                                        (p.correctRight || "").trim().toLowerCase();
                                    return (
                                        <tr
                                            key={pi}
                                            className={ok ? "text-green-700" : "text-red-700"}
                                        >
                                            <td className="border-b border-gray-200 py-1 pr-2 text-gray-900 font-medium">
                                                {p.left || ""}
                                            </td>
                                            <td className="border-b border-gray-200 py-1 pr-2 font-semibold">
                                                {p.studentRight || "—"}
                                            </td>
                                            <td className="border-b border-gray-200 py-1 pr-2 text-gray-900 font-semibold">
                                                {p.correctRight || "—"}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                {explanationHtml ? (
                    <div className="mt-3">
                        <div className="text-xs font-semibold text-gray-700 mb-1">
                            Giải thích
                        </div>
                        <div
                            className="prose prose-xs max-w-none text-gray-800 bg-white rounded border p-2 shadow-sm"
                            dangerouslySetInnerHTML={{ __html: explanationHtml }}
                        />
                    </div>
                ) : null}
            </div>
        );
    }

    // master renderer for each question item in review
    function renderItem(item, i) {
        if (item.type === "FILL_BLOCK") {
            return renderFillBlockQA(item, i);
        }
        if (item.type === "MATCH") {
            return renderMatchQA(item, i);
        }
        // MCQ / TFNG / FILL fallback:
        return renderSimpleQA(item, i);
    }

    // -------------------------------------------------
    // PAGE JSX
    // -------------------------------------------------

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-violet-100 antialiased text-gray-800 p-4">
            <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
                {/* HEADER */}
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div className="space-y-1">
                        <h1 className="text-xl font-bold text-gray-900">
                            Kết quả bài thi: {title}
                        </h1>
                        <div className="text-sm text-gray-600 whitespace-pre-line">
                            {description || ""}
                        </div>
                        <div className="text-[11px] text-gray-500">
                            Nộp lúc:{" "}
                            {finishedAt
                                ? new Date(finishedAt).toLocaleString()
                                : "Chưa nộp"}
                        </div>
                    </div>

                    <div className="flex gap-2 flex-shrink-0">
                        <Link
                            to="/study/home"
                            className="inline-flex items-center gap-2 bg-indigo-600 text-white px-3 py-2 rounded-md text-sm font-semibold hover:bg-indigo-700 btn-press"
                        >
                            ← Về trang chính
                        </Link>

                        <button
                            onClick={() => navigate(0)}
                            className="inline-flex items-center gap-2 border px-3 py-2 rounded-md text-sm hover:bg-gray-50 btn-press"
                            title="Tải lại trang"
                        >
                            Tải lại
                        </button>
                    </div>
                </div>

                {/* SCORE SUMMARY CARD */}
                <div className="bg-white/80 backdrop-blur border rounded-xl shadow p-4 flex flex-col gap-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                        {/* TOTAL */}
                        <ScoreCard
                            label="Tổng"
                            card={{ correct: totalCorrect, total: totalQuestions }}
                            color="violet"
                        />

                        {/* LISTENING (if exists) */}
                        {listeningCard ? (
                            <ScoreCard label="Listening" card={listeningCard} color="blue" />
                        ) : null}

                        {/* READING (if exists) */}
                        {readingCard ? (
                            <ScoreCard label="Reading" card={readingCard} color="green" />
                        ) : null}
                    </div>

                    <div className="text-[11px] text-gray-500 text-center">
                        Điểm tổng: {totalCorrect}/{totalQuestions} ({overallPct}%)
                    </div>
                </div>

                {/* QUESTION-BY-QUESTION REVIEW */}
                <div className="space-y-4">
                    {items.length === 0 ? (
                        <div className="text-center text-gray-600 italic">
                            Không có câu hỏi nào để hiển thị.
                        </div>
                    ) : (
                        items.map((it, i) => renderItem(it, i))
                    )}
                </div>

                <div className="flex justify-end pt-4">
                    <Link
                        to="/study/home"
                        className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-semibold hover:bg-indigo-700 btn-press"
                    >
                        ← Về trang chính
                    </Link>
                </div>
            </div>
        </div>
    );
}

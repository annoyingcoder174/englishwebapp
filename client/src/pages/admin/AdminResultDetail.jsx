import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../../utils/api";

export default function AdminResultDetail() {
    const { submissionId } = useParams();
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");
    const [data, setData] = useState(null);

    useEffect(() => {
        (async () => {
            try {
                setLoading(true);
                setErr("");

                const res = await api.get(
                    `/mocktests/admin/results/${submissionId}`
                );

                if (!res.data?.ok) {
                    setErr("Không tải được chi tiết bài làm.");
                } else {
                    setData(res.data);
                }
            } catch (e) {
                console.error("load detail failed:", e);
                setErr("Không tải được chi tiết bài làm (500?)");
            } finally {
                setLoading(false);
            }
        })();
    }, [submissionId]);

    if (loading) {
        return (
            <div className="p-4 text-gray-600 text-center">Đang tải...</div>
        );
    }
    if (err) {
        return (
            <div className="p-4 text-red-600 text-center">{err}</div>
        );
    }
    if (!data) {
        return (
            <div className="p-4 text-gray-600 text-center">
                Không có dữ liệu.
            </div>
        );
    }

    const {
        student,
        test,
        finishedAt,
        totalCorrect,
        totalQuestions,
        sectionScores = [],
        items = [],
    } = data;

    const finishedStr = finishedAt
        ? new Date(finishedAt).toLocaleString()
        : "Chưa nộp";

    return (
        <div className="max-w-5xl w-full mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="space-y-1">
                    <div className="text-2xl font-bold text-gray-800">
                        Kết quả của {student?.name || "Unknown"}
                    </div>
                    <div className="text-sm text-gray-600">
                        Đề: {test?.title || "(đề đã xoá?)"}
                    </div>
                    <div className="text-xs text-gray-500">
                        Nộp lúc: {finishedStr}
                    </div>
                    <div className="text-xs text-gray-500">
                        Tổng điểm:{" "}
                        <b>
                            {totalCorrect ?? 0} / {totalQuestions ?? 0}
                        </b>
                    </div>
                    <div className="text-xs text-gray-500">
                        {sectionScores
                            .map(
                                (s) =>
                                    `${s.section}: ${s.correct}/${s.total} (${s.percentage}%)`
                            )
                            .join(" · ")}
                    </div>
                </div>

                <div className="flex gap-2">
                    <Link
                        to="/admin/results"
                        className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium px-3 py-2 rounded"
                    >
                        ← Quay lại danh sách
                    </Link>
                </div>
            </div>

            {/* Questions review */}
            <div className="space-y-4">
                {items.length === 0 ? (
                    <div className="text-center text-gray-600 italic">
                        Không có câu hỏi.
                    </div>
                ) : (
                    items.map((q, i) => {
                        const correct = q.correct;
                        const colorBox = correct
                            ? "border-green-400 bg-green-50"
                            : "border-red-400 bg-red-50";

                        return (
                            <div
                                key={i}
                                className={`border rounded-lg p-4 ${colorBox}`}
                            >
                                <div className="flex flex-wrap justify-between gap-2 mb-2">
                                    <div className="text-sm font-semibold text-gray-800">
                                        [{q.section}] Câu {q.number}
                                    </div>
                                    <div className="text-xs font-mono">
                                        {correct ? (
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

                                {/* Passage / context */}
                                {q.group?.passageHtml && (
                                    <div className="mb-3 text-[11px] text-gray-600">
                                        <div className="font-semibold text-gray-700 mb-1">
                                            Đoạn văn / Nghe:
                                        </div>
                                        <div
                                            className="prose prose-xs max-w-none bg-white border rounded p-2 text-gray-800"
                                            dangerouslySetInnerHTML={{
                                                __html: q.group.passageHtml,
                                            }}
                                        />
                                    </div>
                                )}

                                {/* Prompt */}
                                <div className="text-sm text-gray-900 mb-2 whitespace-pre-line">
                                    {q.prompt}
                                </div>

                                {/* Choices (MCQ) */}
                                {Array.isArray(q.options) && q.options.length > 0 && (
                                    <ul className="text-xs text-gray-800 mb-2 space-y-1">
                                        {q.options.map((opt, oi) => (
                                            <li key={oi}>
                                                <span className="font-semibold">
                                                    {opt.key}:
                                                </span>{" "}
                                                {opt.text}
                                            </li>
                                        ))}
                                    </ul>
                                )}

                                {/* Student vs correct */}
                                <div className="text-xs text-gray-800 mb-2 space-y-1">
                                    <div>
                                        <span className="font-semibold">
                                            Học viên chọn:
                                        </span>{" "}
                                        <b>{q.chosen || "—"}</b>
                                    </div>
                                    <div>
                                        <span className="font-semibold">
                                            Đáp án đúng:
                                        </span>{" "}
                                        <b>{q.correctAnswer || "—"}</b>
                                    </div>
                                </div>

                                {/* Explanation */}
                                {q.explanationHtml && (
                                    <div className="mt-3">
                                        <div className="text-[11px] font-semibold text-gray-700 mb-1">
                                            Giải thích
                                        </div>
                                        <div
                                            className="prose prose-xs max-w-none text-gray-800 bg-white rounded border p-2"
                                            dangerouslySetInnerHTML={{
                                                __html: q.explanationHtml,
                                            }}
                                        />
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}

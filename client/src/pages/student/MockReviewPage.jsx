import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import api from "../../utils/api";

export default function MockReviewPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            try {
                const res = await api.get(`/mocktests/${id}/review`);
                setData(res.data);
            } catch (err) {
                console.error("Error loading review:", err);
                alert("Không tải được kết quả. Có thể bạn chưa nộp bài.");
                navigate(`/mock/${id}/run`, { replace: true });
            } finally {
                setLoading(false);
            }
        })();
    }, [id, navigate]);

    if (loading)
        return (
            <div className="p-4 text-center text-gray-600 animate-fade-in">
                Đang tải kết quả...
            </div>
        );
    if (!data)
        return (
            <div className="p-4 text-center text-red-600 animate-fade-in">
                Không có dữ liệu xem lại.
            </div>
        );

    const {
        title = "Đề thi TOEIC",
        score,
        total,
        percentage,
        items = [],
    } = data;

    return (
        <div className="p-4 max-w-5xl mx-auto space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-bold text-gray-800">
                    Kết quả bài thi: {title}
                </h1>
                <div className="flex gap-2">
                    <Link
                        to="/study"
                        className="inline-flex items-center gap-2 bg-indigo-600 text-white px-3 py-2 rounded-md text-sm hover:bg-indigo-700 btn-press"
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

            {/* Summary */}
            <div className="bg-white border rounded-xl shadow p-4 animate-scale-in">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <div className="text-xs uppercase text-blue-600 font-semibold">
                            Listening
                        </div>
                        <div className="text-2xl font-bold text-blue-700">
                            {Math.round((percentage || 0) / 2)}%
                        </div>
                    </div>
                    <div
                        className="bg-green-50 border border-green-200 rounded-lg p-3"
                        style={{ animationDelay: "60ms" }}
                    >
                        <div className="text-xs uppercase text-green-600 font-semibold">
                            Reading
                        </div>
                        <div className="text-2xl font-bold text-green-700">
                            {Math.round((percentage || 0) / 2)}%
                        </div>
                    </div>
                    <div
                        className="bg-purple-50 border border-purple-200 rounded-lg p-3"
                        style={{ animationDelay: "120ms" }}
                    >
                        <div className="text-xs uppercase text-purple-600 font-semibold">
                            Tổng
                        </div>
                        <div className="text-2xl font-bold text-purple-700">
                            {score ?? "--"} / {total ?? "--"}
                        </div>
                    </div>
                </div>
            </div>

            {/* Questions */}
            <div className="space-y-4">
                {items.length === 0 ? (
                    <div className="text-center text-gray-600 italic">
                        Không có câu hỏi nào để hiển thị.
                    </div>
                ) : (
                    items.map((q, qi) => {
                        const isCorrect = q.correct;
                        const borderColor = isCorrect
                            ? "border-green-400 bg-green-50"
                            : "border-red-400 bg-red-50";

                        return (
                            <div
                                key={qi}
                                className={`border rounded-lg p-4 ${borderColor} animate-slide-up`}
                                style={{ animationDelay: `${qi * 30}ms` }}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <div className="text-sm font-semibold text-gray-800">
                                        Câu {q.number}
                                    </div>
                                    <div className="text-xs font-mono">
                                        {isCorrect ? (
                                            <span className="text-green-700 font-semibold">Đúng</span>
                                        ) : (
                                            <span className="text-red-700 font-semibold">Sai</span>
                                        )}
                                    </div>
                                </div>

                                <div className="text-sm text-gray-900 mb-2 whitespace-pre-line">
                                    {q.prompt}
                                </div>

                                <div className="text-xs text-gray-800 mb-2">
                                    <div>
                                        Đáp án của bạn:{" "}
                                        <b>{q.chosen ?? q.chosenAnswer ?? "—"}</b>
                                    </div>
                                    <div>
                                        Đáp án đúng: <b>{q.correctAnswer ?? "—"}</b>
                                    </div>
                                </div>

                                {q.explanationHtml && (
                                    <div className="mt-3">
                                        <div className="text-xs font-semibold text-gray-700 mb-1">
                                            Giải thích
                                        </div>
                                        <div
                                            className="prose prose-xs max-w-none text-gray-800 bg-white rounded border p-2"
                                            dangerouslySetInnerHTML={{ __html: q.explanationHtml }}
                                        />
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            <div className="flex justify-end">
                <Link
                    to="/study"
                    className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-md text-sm hover:bg-indigo-700 btn-press"
                >
                    ← Về trang chính
                </Link>
            </div>
        </div>
    );
}

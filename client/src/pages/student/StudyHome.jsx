// client/src/pages/student/StudyHome.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../utils/api";
import { useAuth } from "../../context/AuthContext.jsx";

export default function StudyHome() {
    const navigate = useNavigate();
    const { user, logout } = useAuth();

    const [tests, setTests] = useState([]);
    const [docs, setDocs] = useState([]);
    const [scores, setScores] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            try {
                // 1. get list of visible tests
                const tRes = await api.get("/mocktests");
                const allTests = tRes.data || [];

                // 2. get list of docs
                const dRes = await api.get("/documents");
                const allDocs = dRes.data || [];

                // 3. fetch score summary for each test
                const scoreMap = {};
                for (const test of allTests) {
                    try {
                        // GET /mocktests/:id/submission, then derive score
                        const subRes = await api.get(
                            `/mocktests/${test._id}/submission`
                        );
                        const sub = subRes.data;
                        if (sub && sub.finishedAt) {
                            scoreMap[test._id] = {
                                finishedAt: sub.finishedAt,
                                totalCorrect: sub.totalCorrect ?? 0,
                                totalQuestions: sub.totalQuestions ?? 0,
                            };
                        }
                    } catch {
                        // student hasn't started, ignore
                    }
                }

                setTests(allTests);
                setDocs(allDocs);
                setScores(scoreMap);
            } catch (err) {
                console.error("StudyHome load failed:", err?.response?.data || err);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    function handleStart(testId) {
        // let MockTestRunner pick first section automatically
        navigate(`/mock/${testId}/run`);
    }

    function openDoc(url) {
        window.open(url, "_blank", "noopener,noreferrer");
    }

    // derive dashboard stats
    const attempts = Object.values(scores);
    const totalDone = attempts.length;
    const avgPct = attempts.length
        ? Math.round(
            attempts.reduce((acc, s) => {
                if (!s.totalQuestions) return acc;
                const pct =
                    (s.totalCorrect / s.totalQuestions) * 100;
                return acc + pct;
            }, 0) / attempts.length
        )
        : 0;

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-violet-100 antialiased text-gray-800 p-4">
            <div className="max-w-4xl mx-auto space-y-6">
                {/* HEADER CARD */}
                <div className="bg-white/70 backdrop-blur rounded-xl border shadow p-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div className="space-y-1">
                        <div className="text-sm text-gray-500">
                            Xin chào 👋
                        </div>
                        <div className="text-xl font-semibold text-gray-900 flex items-center gap-2 flex-wrap">
                            <span>{user?.name || "Học viên"}</span>
                            <span className="text-indigo-600 text-sm font-normal">
                                ({user?.role || "student"})
                            </span>
                        </div>
                        <div className="text-xs text-gray-600 leading-relaxed max-w-[40ch]">
                            Đây là khu vực luyện đề. Làm đề thử TOEIC/IELTS và
                            xem tài liệu giáo viên upload.
                        </div>
                    </div>

                    <div className="flex-shrink-0 flex flex-col items-end">
                        <button
                            onClick={() => {
                                logout();
                                navigate("/");
                            }}
                            className="text-xs bg-red-600 hover:bg-red-700 text-white font-medium px-3 py-2 rounded-lg shadow-sm transition"
                        >
                            Đăng xuất
                        </button>

                        <div className="mt-3 text-[11px] text-gray-600 bg-white/60 border rounded-lg px-3 py-2 shadow-sm leading-snug">
                            <div>
                                <span className="font-semibold text-gray-900">
                                    {totalDone}
                                </span>{" "}
                                đề đã nộp
                            </div>
                            <div>
                                Điểm TB:{" "}
                                <span className="font-semibold text-indigo-600">
                                    {avgPct}%
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* TESTS CARD */}
                <div className="bg-white/70 backdrop-blur rounded-xl border shadow p-4">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                        <div>
                            <div className="text-lg font-semibold text-gray-900">
                                Đề thi thử
                            </div>
                            <div className="text-xs text-gray-500">
                                Chọn đề và bấm “Làm ngay”
                            </div>
                        </div>
                        {loading && (
                            <div className="text-[11px] text-gray-400 italic">
                                Đang tải...
                            </div>
                        )}
                    </div>

                    <div className="divide-y divide-gray-200 mt-4">
                        {tests.map((t) => {
                            const sc = scores[t._id];
                            const submitted = !!sc;
                            const pct =
                                submitted && sc.totalQuestions
                                    ? Math.round(
                                        (sc.totalCorrect /
                                            sc.totalQuestions) *
                                        100
                                    )
                                    : null;

                            return (
                                <div
                                    key={t._id}
                                    className="py-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3"
                                >
                                    <div className="min-w-0 flex-1">
                                        <div className="font-medium text-sm text-gray-900">
                                            {t.title || "Đề không tên"}
                                        </div>

                                        <div className="text-[11px] text-gray-500 line-clamp-2">
                                            {t.description?.trim() ||
                                                "Không có mô tả"}
                                        </div>

                                        <div className="text-[10px] text-gray-400 mt-1">
                                            {t.createdAt
                                                ? new Date(
                                                    t.createdAt
                                                ).toLocaleString()
                                                : ""}
                                        </div>

                                        {submitted ? (
                                            <div className="mt-1 text-[11px] text-green-700 bg-green-50 border border-green-200 rounded px-2 py-1 inline-block">
                                                Đã nộp · {pct}%
                                            </div>
                                        ) : null}
                                    </div>

                                    <div className="flex-shrink-0 flex flex-col items-stretch gap-2 text-xs">
                                        <button
                                            onClick={() =>
                                                handleStart(t._id)
                                            }
                                            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded px-3 py-2 font-semibold shadow-sm transition"
                                        >
                                            {submitted
                                                ? "Làm lại"
                                                : "Làm ngay"}{" "}
                                            →
                                        </button>

                                        {submitted && (
                                            <button
                                                onClick={() =>
                                                    navigate(
                                                        `/mock/${t._id}/review`
                                                    )
                                                }
                                                className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 rounded px-3 py-2 font-medium shadow-sm transition"
                                            >
                                                Xem kết quả
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}

                        {!tests.length && !loading && (
                            <div className="py-6 text-center text-sm text-gray-400 italic">
                                Chưa có đề thi nào.
                            </div>
                        )}
                    </div>
                </div>

                {/* DOCS CARD */}
                <div className="bg-white/70 backdrop-blur rounded-xl border shadow p-4">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                        <div>
                            <div className="text-lg font-semibold text-gray-900">
                                Tài liệu giáo viên upload
                            </div>
                            <div className="text-xs text-gray-500">
                                Có thể biến mất nếu server restart, nên tải
                                về 📥
                            </div>
                        </div>
                    </div>

                    <div className="divide-y divide-gray-200 mt-4">
                        {docs.map((d) => {
                            // normalize file url
                            let absoluteUrl = "";
                            if (/^https?:\/\//.test(d.fileUrl || "")) {
                                absoluteUrl = d.fileUrl;
                            } else {
                                const base =
                                    import.meta?.env?.VITE_API_URL ||
                                    `${window.location.protocol}//${window.location.hostname}:5001/api`;

                                if (d.fileUrl?.startsWith("/uploads/")) {
                                    absoluteUrl = `${base}${d.fileUrl}`;
                                } else if (d.fileUrl) {
                                    absoluteUrl = `${base}/uploads/${d.fileUrl.replace(
                                        /^\/+/,
                                        ""
                                    )}`;
                                }
                            }

                            return (
                                <div
                                    key={d._id || d.fileUrl}
                                    className="py-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3"
                                >
                                    <div className="min-w-0 flex-1">
                                        <div className="font-medium text-sm text-gray-900 break-words">
                                            {d.title ||
                                                d.originalName ||
                                                d.fileUrl ||
                                                "Tài liệu"}
                                        </div>
                                        <div className="text-[11px] text-gray-500 break-words line-clamp-2">
                                            {d.description || "—"}
                                        </div>

                                        <div className="text-[10px] text-gray-400 mt-1">
                                            {d.createdAt
                                                ? new Date(
                                                    d.createdAt
                                                ).toLocaleString()
                                                : ""}
                                        </div>
                                    </div>

                                    <div className="flex-shrink-0 flex flex-col items-stretch gap-2 text-xs">
                                        <button
                                            onClick={() =>
                                                openDoc(absoluteUrl)
                                            }
                                            className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 rounded px-3 py-2 font-medium shadow-sm transition"
                                        >
                                            Mở / Tải ↗
                                        </button>
                                    </div>
                                </div>
                            );
                        })}

                        {!docs.length && !loading && (
                            <div className="py-6 text-center text-sm text-gray-400 italic">
                                Chưa có tài liệu nào.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

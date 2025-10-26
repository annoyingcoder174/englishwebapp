import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../utils/api";
import { ArrowRightCircle, Trophy, BookOpen, BarChart3 } from "lucide-react";

export default function Study() {
    const [tests, setTests] = useState([]);
    const [stats, setStats] = useState({ taken: 0, avg: 0, best: 0 });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            try {
                const res = await api.get("/mocktests");
                const list = res.data || [];
                setTests(list);

                // Compute stats
                const done = list.filter((t) => t.lastScore != null);
                const avg =
                    done.length > 0
                        ? Math.round(
                            done.reduce((sum, t) => sum + (t.lastScore || 0), 0) / done.length
                        )
                        : 0;
                const best = done.reduce(
                    (max, t) => Math.max(max, t.lastScore || 0),
                    0
                );
                setStats({ taken: done.length, avg, best });
            } catch (err) {
                console.error(err);
                alert("Không tải được danh sách đề thi.");
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    if (loading)
        return (
            <div className="p-6 text-center text-gray-500 animate-fade-in">
                Đang tải dữ liệu...
            </div>
        );

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-violet-100">
            {/* Header */}
            <div className="max-w-6xl mx-auto px-4 py-8">
                <div className="mb-6 text-center">
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-1">
                        Chào mừng trở lại 👋
                    </h1>
                    <p className="text-gray-600">
                        Lo học để thi đi ku!
                    </p>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
                    <div className="bg-white border rounded-xl shadow p-4 flex items-center gap-3">
                        <BookOpen className="text-indigo-600 w-8 h-8" />
                        <div>
                            <div className="text-xs uppercase text-gray-500">Đề đã làm</div>
                            <div className="text-xl font-bold text-gray-800">
                                {stats.taken}
                            </div>
                        </div>
                    </div>
                    <div className="bg-white border rounded-xl shadow p-4 flex items-center gap-3">
                        <BarChart3 className="text-green-600 w-8 h-8" />
                        <div>
                            <div className="text-xs uppercase text-gray-500">Điểm trung bình</div>
                            <div className="text-xl font-bold text-gray-800">{stats.avg}</div>
                        </div>
                    </div>
                    <div className="bg-white border rounded-xl shadow p-4 flex items-center gap-3">
                        <Trophy className="text-yellow-500 w-8 h-8" />
                        <div>
                            <div className="text-xs uppercase text-gray-500">Điểm cao nhất</div>
                            <div className="text-xl font-bold text-gray-800">{stats.best}</div>
                        </div>
                    </div>
                </div>

                {/* Test Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {tests.length === 0 ? (
                        <div className="col-span-full text-center text-gray-500 italic">
                            Hiện chưa có đề thi nào. Hãy quay lại sau!
                        </div>
                    ) : (
                        tests.map((t, idx) => (
                            <div
                                key={t._id || idx}
                                className="bg-white border rounded-xl shadow p-5 hover:shadow-md transition-all duration-200 animate-fade-in"
                                style={{ animationDelay: `${idx * 40}ms` }}
                            >
                                <div className="text-sm text-gray-500 mb-1 uppercase">
                                    TOEIC Mock Test
                                </div>
                                <h2 className="font-semibold text-lg text-gray-800 mb-2">
                                    {t.title || "Đề thi chưa đặt tên"}
                                </h2>

                                <p className="text-xs text-gray-600 mb-4 line-clamp-2">
                                    {t.description || "Bài luyện tập chuẩn TOEIC có giới hạn thời gian."}
                                </p>

                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-gray-500">
                                        {t.lastScore != null ? (
                                            <>
                                                Lần gần nhất:{" "}
                                                <span className="font-semibold text-indigo-600">
                                                    {t.lastScore} điểm
                                                </span>
                                            </>
                                        ) : (
                                            "Chưa làm lần nào"
                                        )}
                                    </span>

                                    <Link
                                        to={`/mock/${t._id}/run`}
                                        className="inline-flex items-center gap-1 bg-indigo-600 text-white px-3 py-1.5 rounded-md text-sm hover:bg-indigo-700 btn-press"
                                    >
                                        {t.lastScore ? "Làm lại" : "Bắt đầu"}{" "}
                                        <ArrowRightCircle className="w-4 h-4" />
                                    </Link>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

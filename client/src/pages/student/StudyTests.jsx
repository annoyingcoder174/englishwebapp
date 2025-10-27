// client/src/pages/student/StudyTests.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../utils/api";

export default function StudyTests() {
    const [tests, setTests] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        let active = true;
        (async () => {
            try {
                const res = await api.get("/mocktests");
                if (active) setTests(res.data || []);
            } catch (err) {
                console.error("Failed to load tests:", err);
            } finally {
                if (active) setLoading(false);
            }
        })();
        return () => {
            active = false;
        };
    }, []);

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-violet-100 text-gray-800 p-4 flex justify-center">
            <div className="w-full max-w-4xl space-y-6">

                <header className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-semibold text-gray-900">
                            Danh sách đề thi thử
                        </h1>
                        <p className="text-sm text-gray-500">
                            Chọn đề và bấm “Làm ngay”.
                        </p>
                    </div>

                    <button
                        onClick={() => navigate("/study")}
                        className="text-xs text-indigo-600 underline hover:text-indigo-700"
                    >
                        ← Quay về trang học
                    </button>
                </header>

                <section className="bg-white border rounded-xl shadow divide-y">
                    {loading ? (
                        <div className="p-4 text-sm text-gray-500 animate-pulse">
                            Đang tải đề thi...
                        </div>
                    ) : tests.length === 0 ? (
                        <div className="p-4 text-sm text-gray-500">
                            Chưa có đề thi nào.
                        </div>
                    ) : (
                        tests.map((t, i) => (
                            <div key={t._id || i} className="p-4 flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                    <div className="font-semibold text-gray-800 text-sm md:text-base truncate">
                                        {t.title || "Đề thi"}
                                    </div>
                                    <div className="text-[11px] text-gray-500 mb-1">
                                        {t.description || "Không có mô tả"}
                                    </div>
                                    <div className="text-[10px] text-gray-400">
                                        {t.createdAt
                                            ? new Date(t.createdAt).toLocaleString()
                                            : ""}
                                    </div>
                                </div>

                                <div className="flex-shrink-0">
                                    <button
                                        className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2 rounded-lg btn-press"
                                        onClick={() =>
                                            navigate(`/mock/${t._id}/run?section=Listening`)
                                        }
                                    >
                                        Làm ngay →
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </section>
            </div>
        </div>
    );
}

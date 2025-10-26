// client/src/pages/student/MockTestIntro.jsx
import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import api from "../../utils/api";

export default function MockTestIntro() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [test, setTest] = useState(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");

    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const { data } = await api.get(`/mocktests/${id}`);
                if (mounted) setTest(data);
            } catch (e) {
                setErr("Không tải được đề thi.");
            } finally { setLoading(false); }
        })();
        return () => (mounted = false);
    }, [id]);

    const start = async (firstSection) => {
        try {
            await api.post(`/mocktests/${id}/start`);
            // go to runner with chosen section
            navigate(`/mock/${id}/run?section=${encodeURIComponent(firstSection)}`);
        } catch {
            alert("Không bắt đầu được bài thi.");
        }
    };

    if (loading) return <div className="p-6">Đang tải…</div>;
    if (err) return <div className="p-6 text-red-600">{err}</div>;
    if (!test) return null;

    // find first Listening and first Reading sections to show info
    const listening = test.sections.find((s) => s.name === "Listening");
    const reading = test.sections.find((s) => s.name === "Reading");

    return (
        <div className="max-w-3xl mx-auto p-6">
            <div className="bg-white rounded-xl shadow p-6 space-y-3">
                <h1 className="text-2xl font-bold text-blue-700">{test.title}</h1>
                <p className="text-gray-600">{test.description || "Đề thi mô phỏng TOEIC"}</p>

                <div className="grid md:grid-cols-2 gap-3">
                    {listening && (
                        <div className="border rounded p-4">
                            <div className="font-semibold">🎧 Nghe (Listening)</div>
                            <div className="text-sm text-gray-600">
                                Part {listening.part} • {listening.durationMinutes || 45} phút
                            </div>
                            <button
                                className="mt-2 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                                onClick={() => start("Listening")}
                            >
                                Bắt đầu với Listening
                            </button>
                        </div>
                    )}

                    {reading && (
                        <div className="border rounded p-4">
                            <div className="font-semibold">📖 Đọc (Reading)</div>
                            <div className="text-sm text-gray-600">
                                Part {reading.part} • {reading.durationMinutes || 75} phút
                            </div>
                            <button
                                className="mt-2 px-3 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700"
                                onClick={() => start("Reading")}
                            >
                                Bắt đầu với Reading
                            </button>
                        </div>
                    )}
                </div>

                <div className="text-sm">
                    <Link to="/study" className="text-blue-600 hover:underline">← Quay lại danh sách đề</Link>
                </div>
            </div>
        </div>
    );
}

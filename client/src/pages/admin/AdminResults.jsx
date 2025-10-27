import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../utils/api";

export default function AdminResults() {
    const [loading, setLoading] = useState(true);
    const [rows, setRows] = useState([]);
    const [err, setErr] = useState("");

    useEffect(() => {
        (async () => {
            try {
                setLoading(true);
                setErr("");
                const res = await api.get("/mocktests/admin/results");
                if (res.data?.ok) {
                    setRows(res.data.results || []);
                } else {
                    setErr("Không lấy được kết quả.");
                }
            } catch (e) {
                console.error("load admin results failed:", e);
                setErr("Không tải được kết quả (500?)");
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    return (
        <div className="max-w-5xl w-full mx-auto space-y-6">
            <div className="space-y-1">
                <div className="text-2xl font-bold text-gray-800">
                    Kết quả bài thi (tất cả học viên)
                </div>
                <div className="text-sm text-gray-600">
                    Nhấp vào một dòng để xem chi tiết bài làm.
                </div>
            </div>

            <div className="bg-white border rounded-lg shadow-sm overflow-hidden text-sm">
                <div className="hidden md:grid grid-cols-5 gap-3 px-4 py-2 bg-gray-50 border-b text-[11px] font-semibold text-gray-600">
                    <div>Học viên</div>
                    <div>Đề thi</div>
                    <div>Điểm</div>
                    <div>Thời gian nộp</div>
                    <div className="text-right pr-2">Xem chi tiết</div>
                </div>

                {loading ? (
                    <div className="px-4 py-8 text-center text-gray-500">
                        Đang tải...
                    </div>
                ) : err ? (
                    <div className="px-4 py-8 text-center text-red-600">{err}</div>
                ) : rows.length === 0 ? (
                    <div className="px-4 py-8 text-center text-gray-500">
                        Chưa có bài nộp nào.
                    </div>
                ) : (
                    rows.map((r) => {
                        const finishedStr = r.finishedAt
                            ? new Date(r.finishedAt).toLocaleString()
                            : "Chưa nộp";

                        return (
                            <div
                                key={r.submissionId}
                                className="border-b last:border-b-0 px-4 py-3 grid grid-cols-1 md:grid-cols-5 gap-3 items-start"
                            >
                                <div className="text-gray-800 text-sm">
                                    <div className="font-semibold break-words">
                                        {r.studentName || "(Không tên)"}
                                    </div>
                                    <div className="text-[11px] text-gray-500 break-all">
                                        {r.studentEmail || ""}
                                    </div>
                                </div>

                                <div className="text-gray-800 text-sm">
                                    <div className="font-semibold break-words">
                                        {r.testTitle || "(Đề đã xoá?)"}
                                    </div>
                                    <div className="text-[11px] text-gray-500">
                                        {r.testId}
                                    </div>
                                </div>

                                <div className="text-gray-800 text-sm">
                                    <div className="font-semibold">
                                        {r.totalCorrect ?? 0} / {r.totalQuestions ?? 0}
                                    </div>
                                    <div className="text-[11px] text-gray-500">
                                        {r.sectionScores
                                            .map(
                                                (s) =>
                                                    `${s.section}: ${s.correct}/${s.total}`
                                            )
                                            .join(" · ")}
                                    </div>
                                </div>

                                <div className="text-gray-800 text-sm">
                                    <div className="font-semibold">
                                        {finishedStr}
                                    </div>
                                </div>

                                <div className="text-right md:text-right">
                                    <Link
                                        to={`/admin/results/${r.submissionId}`}
                                        className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium px-3 py-1.5 rounded"
                                    >
                                        Xem
                                    </Link>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}

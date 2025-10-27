// client/src/pages/admin/ManageTests.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../utils/api";

/**
 * Quản lý đề thi (admin)
 * - list all tests
 * - delete test
 * - open builder to edit
 *
 * NOTE:
 * This component is rendered INSIDE AdminDashboard,
 * which already draws the left admin panel sidebar.
 * So here we only render the right/main content column.
 */
export default function ManageTests() {
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [tests, setTests] = useState([]);
    const [error, setError] = useState("");

    /* -------------------------------------------------
       Load tests from server
    ------------------------------------------------- */
    async function load() {
        try {
            setLoading(true);
            setError("");

            // server route: GET /mocktests/admin/list
            // responds with { ok: true, tests: [...] }
            const res = await api.get("/mocktests/admin/list");

            if (!res.data?.ok) {
                setError("Không lấy được danh sách đề");
                setTests([]);
            } else {
                setTests(res.data.tests || []);
            }
        } catch (err) {
            console.error("load tests failed:", err);
            setError("Không lấy được danh sách đề (lỗi máy chủ)");
            setTests([]);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        load();
    }, []);

    /* -------------------------------------------------
       Delete a test
    ------------------------------------------------- */
    async function handleDelete(testId) {
        const yes = window.confirm(
            "Xoá đề này? (Hành động này không thể hoàn tác.)"
        );
        if (!yes) return;

        try {
            // backend expects DELETE /mocktests/admin/:testId  (admin only)
            await api.delete(`/mocktests/admin/${testId}`);

            // optimistically update UI without refetch
            setTests((prev) => prev.filter((t) => t._id !== testId));
        } catch (err) {
            console.error("delete failed", err);
            alert("Xoá đề thất bại");
        }
    }

    /* -------------------------------------------------
       Edit in builder
    ------------------------------------------------- */
    function handleEdit(testId) {
        // We'll open the builder with a query param so it can load & edit that test
        navigate(`/admin/mock/builder?edit=${testId}`);
    }

    /* -------------------------------------------------
       Helpers
    ------------------------------------------------- */

    function formatDate(ts) {
        if (!ts) return "-";
        const d = new Date(ts);
        return d.toLocaleString(); // local readable date+time
    }

    function renderRow(test) {
        // server gives us parts: [{ name, part, qCount }]
        const totalQs = Array.isArray(test.parts)
            ? test.parts.reduce(
                (sum, p) => sum + (p.qCount ? Number(p.qCount) : 0),
                0
            )
            : 0;

        const partSummary = Array.isArray(test.parts)
            ? test.parts
                .map((p) => {
                    const labelPart =
                        p.part != null && p.part !== ""
                            ? `Part ${p.part}`
                            : "";
                    const labelName = p.name || "";
                    const labelQ = `${p.qCount ?? 0} câu`;
                    // ex: "Reading Part 7 (12 câu)"
                    return `${labelName} ${labelPart} (${labelQ})`.trim();
                })
                .join(" · ")
            : "";

        return (
            <div
                key={test._id}
                className="border-b last:border-b-0 px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"
            >
                {/* LEFT: info block */}
                <div className="text-sm text-gray-800 space-y-1">
                    <div className="font-semibold text-indigo-700 break-words">
                        {test.title || "Không tên"}
                    </div>

                    {test.description ? (
                        <div className="text-gray-500 text-xs break-words">
                            {test.description}
                        </div>
                    ) : (
                        <div className="text-gray-400 text-xs italic">
                            (không có mô tả)
                        </div>
                    )}

                    <div className="text-[11px] text-gray-500">
                        {formatDate(test.createdAt)} · {totalQs} câu hỏi
                    </div>

                    {partSummary && (
                        <div className="text-[11px] text-gray-500 break-words">
                            {partSummary}
                        </div>
                    )}
                </div>

                {/* RIGHT: actions */}
                <div className="flex flex-wrap gap-2 text-xs sm:text-[11px]">
                    <button
                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded font-medium"
                        onClick={() => handleEdit(test._id)}
                    >
                        Sửa đề
                    </button>

                    <button
                        className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded font-medium"
                        onClick={() => handleDelete(test._id)}
                    >
                        Xoá
                    </button>
                </div>
            </div>
        );
    }

    /* -------------------------------------------------
       JSX
    ------------------------------------------------- */

    return (
        <div className="max-w-4xl w-full mx-auto space-y-6 p-4">
            {/* Page header */}
            <div className="space-y-1">
                <div className="text-2xl font-bold text-gray-800">
                    Quản lý đề thi
                </div>
                <div className="text-sm text-gray-600">
                    Tạo mới, chỉnh sửa, hoặc xoá đề.
                </div>
            </div>

            {/* "Tạo đề mới" button */}
            <div>
                <button
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded"
                    onClick={() => navigate("/admin/mock/builder")}
                >
                    + Tạo đề mới
                </button>
            </div>

            {/* Table-ish list */}
            <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
                {/* Header row (desktop only) */}
                <div className="hidden sm:flex text-[11px] font-semibold text-gray-600 border-b bg-gray-50 px-4 py-2">
                    <div className="flex-1">TIÊU ĐỀ / MÔ TẢ</div>
                    <div className="w-[10rem] text-right">HÀNH ĐỘNG</div>
                </div>

                {/* Body */}
                {loading ? (
                    <div className="px-4 py-8 text-center text-sm text-gray-500">
                        Đang tải...
                    </div>
                ) : error ? (
                    <div className="px-4 py-8 text-center text-sm text-red-600">
                        {error}
                    </div>
                ) : tests.length === 0 ? (
                    <div className="px-4 py-8 text-center text-sm text-gray-500">
                        Chưa có đề nào.
                    </div>
                ) : (
                    tests.map((t) => renderRow(t))
                )}
            </div>
        </div>
    );
}

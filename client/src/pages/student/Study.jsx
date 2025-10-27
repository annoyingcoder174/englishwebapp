import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../../utils/api";
import { useAuth } from "../../context/AuthContext.jsx";

function formatDate(ts) {
    if (!ts) return "";
    const d = new Date(ts);
    const date = d.toLocaleDateString();
    const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    return `${date}, ${time}`;
}

// Build a fully qualified file URL that the browser can open
function resolveFileUrl(fileUrl) {
    if (!fileUrl) return "#";
    // already absolute? (https:// or http://)
    if (/^https?:\/\//i.test(fileUrl)) return fileUrl;

    // otherwise it's like "/uploads/abc.png"
    // get base API origin. Our api.js baseURL is like "http://localhost:5001/api"
    // so strip the trailing "/api".
    let base = api.defaults.baseURL || "";
    // base might be "http://localhost:5001/api"
    base = base.replace(/\/api\/?$/, ""); // -> "http://localhost:5001"

    return base + fileUrl; // -> "http://localhost:5001/uploads/abc.png"
}

export default function Study() {
    const { user } = useAuth(); // assuming AuthContext exposes user {name, role} etc
    const navigate = useNavigate();

    const [tests, setTests] = useState([]);
    const [docs, setDocs] = useState([]);
    const [loadingTests, setLoadingTests] = useState(true);
    const [loadingDocs, setLoadingDocs] = useState(true);
    const [errTests, setErrTests] = useState("");
    const [errDocs, setErrDocs] = useState("");

    useEffect(() => {
        // fetch mock tests
        (async () => {
            try {
                const res = await api.get("/mocktests");
                setTests(res.data || []);
            } catch (err) {
                console.error("Failed to load tests:", err);
                setErrTests("Không tải được danh sách đề.");
            } finally {
                setLoadingTests(false);
            }
        })();

        // fetch uploaded documents
        (async () => {
            try {
                const res = await api.get("/documents");
                setDocs(res.data || []);
            } catch (err) {
                console.error("Failed to load documents:", err);
                setErrDocs("Không tải được tài liệu.");
            } finally {
                setLoadingDocs(false);
            }
        })();
    }, []);

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-violet-100 text-gray-800 p-4 md:p-8">
            {/* HEADER CARD */}
            <div className="max-w-4xl mx-auto bg-white/70 backdrop-blur border rounded-xl shadow p-4 mb-6">
                <div className="text-sm text-gray-500">Xin chào 👋</div>
                <div className="text-xl font-semibold text-gray-900">
                    {user?.name || "Học viên"}{" "}
                    <span className="text-indigo-600 text-base font-medium">
                        ({user?.role || "student"})
                    </span>
                </div>
                <div className="text-sm text-gray-600 mt-2">
                    Đây là khu vực luyện đề TOEIC/IELTS và xem tài liệu giáo viên upload.
                </div>
            </div>

            <div className="max-w-4xl mx-auto flex flex-col gap-8">
                {/* CARD: TESTS */}
                <section className="bg-white/80 backdrop-blur border rounded-xl shadow overflow-hidden">
                    <header className="flex flex-col md:flex-row md:items-start md:justify-between p-4 border-b">
                        <div>
                            <div className="text-base font-semibold text-gray-900">
                                Danh sách đề thi thử
                            </div>
                            <div className="text-[13px] text-gray-500">
                                Chọn đề và bấm “Làm ngay”
                            </div>
                        </div>
                        {errTests && (
                            <div className="text-xs text-red-600 mt-2 md:mt-0">{errTests}</div>
                        )}
                    </header>

                    {loadingTests ? (
                        <div className="p-4 text-sm text-gray-500">Đang tải đề thi...</div>
                    ) : tests.length === 0 ? (
                        <div className="p-4 text-sm text-gray-500 italic">
                            (Chưa có đề thi nào)
                        </div>
                    ) : (
                        <ul className="divide-y divide-gray-200">
                            {tests.map((t) => (
                                <li key={t._id} className="p-4 flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="font-semibold text-gray-900 text-sm md:text-base truncate">
                                            {t.title || "Đề thi"}
                                        </div>
                                        <div className="text-[13px] text-gray-500 line-clamp-2">
                                            {t.description || "Không có mô tả"}
                                        </div>
                                        <div className="text-[12px] text-gray-400 mt-1">
                                            {formatDate(t.createdAt)}
                                        </div>
                                    </div>

                                    <div className="flex-shrink-0">
                                        <button
                                            className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg px-3 py-2 shadow"
                                            onClick={() => {
                                                // push to /mock/:id/run?section=Listening by default maybe,
                                                // we can choose default section "Listening" if it exists, else "Reading"
                                                navigate(`/mock/${t._id}/run?section=Listening`);
                                            }}
                                        >
                                            Làm ngay →
                                        </button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>

                {/* CARD: DOCUMENTS */}
                <section className="bg-white/80 backdrop-blur border rounded-xl shadow overflow-hidden">
                    <header className="flex flex-col md:flex-row md:items-start md:justify-between p-4 border-b">
                        <div>
                            <div className="text-base font-semibold text-gray-900">
                                Tài liệu giáo viên upload
                            </div>
                            <div className="text-[13px] text-gray-500">
                                PDF/Ảnh/Bài nghe… (lưu lại nếu cần)
                            </div>
                        </div>
                        {errDocs && (
                            <div className="text-xs text-red-600 mt-2 md:mt-0">{errDocs}</div>
                        )}
                    </header>

                    {loadingDocs ? (
                        <div className="p-4 text-sm text-gray-500">Đang tải tài liệu...</div>
                    ) : docs.length === 0 ? (
                        <div className="p-4 text-sm text-gray-500 italic">
                            (Chưa có tài liệu nào)
                        </div>
                    ) : (
                        <ul className="divide-y divide-gray-200">
                            {docs.map((doc) => {
                                const fileHref = resolveFileUrl(doc.fileUrl);
                                return (
                                    <li
                                        key={doc._id}
                                        className="p-4 flex flex-col md:flex-row md:items-start md:justify-between gap-3"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className="font-semibold text-gray-900 text-sm md:text-base truncate">
                                                {doc.title || doc.originalName || "Tài liệu"}
                                            </div>
                                            {doc.description && (
                                                <div className="text-[13px] text-gray-500 line-clamp-2">
                                                    {doc.description}
                                                </div>
                                            )}
                                            <div className="text-[12px] text-gray-400 mt-1">
                                                {formatDate(doc.createdAt)}
                                            </div>
                                        </div>

                                        <div className="flex-shrink-0">
                                            <a
                                                href={fileHref}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex items-center gap-1 bg-gray-900 hover:bg-black text-white text-xs font-medium rounded-lg px-3 py-2 shadow"
                                            >
                                                <span>Mở / Tải</span>
                                                <span aria-hidden>↗</span>
                                            </a>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </section>
            </div>
        </div>
    );
}

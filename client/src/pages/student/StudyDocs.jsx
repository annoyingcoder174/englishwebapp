// client/src/pages/student/StudyDocs.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../utils/api";

// same helper we discussed
function resolveFileUrl(fileUrl) {
    if (!fileUrl) return "#";
    if (/^https?:\/\//i.test(fileUrl)) return fileUrl;
    let base = api.defaults.baseURL || "";
    // api.defaults.baseURL is something like "http://localhost:5001/api"
    base = base.replace(/\/api\/?$/, "");
    return base + fileUrl; // "/uploads/filename"
}

export default function StudyDocs() {
    const [docs, setDocs] = useState([]);
    const [loadingDocs, setLoadingDocs] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        let active = true;
        (async () => {
            try {
                const res = await api.get("/documents");
                if (active) setDocs(res.data || []);
            } catch (err) {
                console.error("Failed to load docs:", err);
            } finally {
                if (active) setLoadingDocs(false);
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
                            Tài liệu giáo viên upload
                        </h1>
                        <p className="text-sm text-gray-500">
                            Ảnh, PDF, audio,... bấm "Mở / Tải".
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
                    {loadingDocs ? (
                        <div className="p-4 text-sm text-gray-500 animate-pulse">
                            Đang tải tài liệu...
                        </div>
                    ) : docs.length === 0 ? (
                        <div className="p-4 text-sm text-gray-500">
                            Chưa có tài liệu nào.
                        </div>
                    ) : (
                        docs.map((d, i) => (
                            <div key={d._id || i} className="p-4 flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                    <div className="font-semibold text-gray-800 text-sm md:text-base truncate">
                                        {d.title || d.originalName || "Tài liệu"}
                                    </div>
                                    <div className="text-[11px] text-gray-500 mb-1 line-clamp-2">
                                        {d.description || "Không có mô tả"}
                                    </div>
                                    <div className="text-[10px] text-gray-400">
                                        {d.createdAt
                                            ? new Date(d.createdAt).toLocaleString()
                                            : ""}
                                    </div>
                                </div>

                                <div className="flex-shrink-0">
                                    <a
                                        className="inline-flex items-center bg-gray-800 hover:bg-black text-white text-xs font-semibold px-4 py-2 rounded-lg btn-press"
                                        href={resolveFileUrl(d.fileUrl)}
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        Mở / Tải →
                                    </a>
                                </div>
                            </div>
                        ))
                    )}
                </section>

                <div className="text-[10px] text-center text-gray-400 pt-6 pb-10">
                    Lưu ý: file có thể biến mất nếu server bị restart miễn phí 🫠
                </div>
            </div>
        </div>
    );
}

// client/src/components/DocumentsPanel.jsx
import { useEffect, useState } from "react";
import api from "../utils/api";
import { toAssetUrl } from "../utils/assets";

export default function DocumentsPanel() {
    const [docs, setDocs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            try {
                const res = await api.get("/documents");
                setDocs(res.data || []);
            } catch (err) {
                console.error("Failed to load docs:", err);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    return (
        <div className="bg-white rounded-xl shadow border p-4">
            <div className="flex items-baseline justify-between mb-3">
                <h2 className="text-lg font-semibold text-gray-800">
                    Tài liệu giáo viên upload
                </h2>
                <div className="text-[10px] text-gray-400">
                    (file có thể biến mất nếu server restart)
                </div>
            </div>

            {loading ? (
                <div className="text-gray-500 text-sm">Đang tải tài liệu...</div>
            ) : docs.length === 0 ? (
                <div className="text-gray-400 text-sm italic">
                    Chưa có tài liệu nào.
                </div>
            ) : (
                <ul className="divide-y">
                    {docs.map((d) => {
                        // where is the actual file?
                        // we try fileUrl first, fallback absoluteUrl
                        const rawUrl = d.fileUrl || d.absoluteUrl || "";
                        const publicUrl = toAssetUrl(rawUrl);

                        return (
                            <li
                                key={d._id}
                                className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                            >
                                <div className="min-w-0">
                                    <div className="font-medium text-gray-900 truncate">
                                        {d.title || d.originalName || "Tài liệu không tên"}
                                    </div>
                                    <div className="text-xs text-gray-500 break-all">
                                        {d.description || "Không có mô tả"}
                                    </div>
                                </div>

                                {publicUrl ? (
                                    <a
                                        href={publicUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center bg-gray-800 text-white text-xs font-semibold rounded-lg px-3 py-2 hover:bg-black"
                                    >
                                        Mở / Tải →
                                    </a>
                                ) : (
                                    <span className="text-red-600 text-[11px] font-medium">
                                        (link không khả dụng)
                                    </span>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}

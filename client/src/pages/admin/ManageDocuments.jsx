import { useEffect, useRef, useState } from "react";
import api from "../../utils/api";

export default function ManageDocuments() {
    const fileInputRef = useRef(null);

    const [docs, setDocs] = useState([]);
    const [loading, setLoading] = useState(true);

    // Upload form state
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [section, setSection] = useState("Reading"); // or Listening/etc.
    const [uploading, setUploading] = useState(false);

    async function loadDocs() {
        try {
            setLoading(true);
            const { data } = await api.get("/documents");
            setDocs(data || []);
        } catch (err) {
            console.error(err);
            alert("Không tải được danh sách tài liệu");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadDocs();
    }, []);

    async function handleUpload(e) {
        e.preventDefault();
        const file = fileInputRef.current?.files?.[0];
        if (!file) {
            alert("Chọn file trước đã.");
            return;
        }

        try {
            setUploading(true);
            const form = new FormData();
            form.append("file", file);
            form.append("title", title);
            form.append("description", description);
            form.append("section", section);

            await api.post("/documents/upload", form, {
                headers: { "Content-Type": "multipart/form-data" },
            });

            // reset
            setTitle("");
            setDescription("");
            setSection("Reading");
            if (fileInputRef.current) fileInputRef.current.value = "";

            // refresh list
            loadDocs();
        } catch (err) {
            console.error(err);
            alert(
                err?.response?.data?.error ||
                "Tải tài liệu thất bại. (Bạn có quyền admin chứ?)"
            );
        } finally {
            setUploading(false);
        }
    }

    async function handleDelete(id) {
        if (!window.confirm("Xoá tài liệu này?")) return;
        try {
            await api.delete(`/documents/${id}`);
            loadDocs();
        } catch (err) {
            console.error(err);
            alert("Xoá thất bại.");
        }
    }

    return (
        <div className="space-y-8">
            <header className="border-b pb-4 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                <div>
                    <h1 className="text-xl font-bold text-gray-800">
                        Quản lý tài liệu
                    </h1>
                    <p className="text-sm text-gray-600">
                        Upload PDF, audio, hình ảnh,... Sau đó học viên có thể xem/
                        tải ở trang học.
                    </p>
                </div>
            </header>

            {/* Upload form */}
            <section className="bg-white border rounded-xl shadow p-4 space-y-4">
                <h2 className="text-lg font-semibold text-gray-800">
                    Tải tài liệu mới
                </h2>

                <form
                    className="grid grid-cols-1 md:grid-cols-2 gap-4"
                    onSubmit={handleUpload}
                >
                    <div className="flex flex-col">
                        <label className="text-sm font-medium text-gray-700">
                            Tiêu đề hiển thị
                        </label>
                        <input
                            className="border rounded px-3 py-2 text-sm"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Đề cương ngữ pháp thì Hiện Tại Hoàn Thành"
                            required
                        />
                    </div>

                    <div className="flex flex-col">
                        <label className="text-sm font-medium text-gray-700">
                            Danh mục / Section
                        </label>
                        <select
                            className="border rounded px-3 py-2 text-sm"
                            value={section}
                            onChange={(e) => setSection(e.target.value)}
                        >
                            <option value="Reading">Reading</option>
                            <option value="Listening">Listening</option>
                            <option value="Grammar">Grammar</option>
                            <option value="Vocabulary">Vocabulary</option>
                            <option value="Other">Other</option>
                        </select>
                        <p className="text-[11px] text-gray-500 mt-1">
                            (phải match enum server nếu bạn keep enum strict – hoặc nới enum để cho phép thêm)
                        </p>
                    </div>

                    <div className="flex flex-col md:col-span-2">
                        <label className="text-sm font-medium text-gray-700">
                            Mô tả / ghi chú
                        </label>
                        <textarea
                            className="border rounded px-3 py-2 text-sm"
                            rows={2}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Bài này ôn lại cấu trúc câu điều kiện loại 2 và một số collocations quan trọng."
                        />
                    </div>

                    <div className="flex flex-col md:col-span-2">
                        <label className="text-sm font-medium text-gray-700">
                            File
                        </label>
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="text-sm"
                            required
                        />
                        <p className="text-[11px] text-gray-500">
                            Hỗ trợ PDF / MP3 / JPG / PNG / ...
                        </p>
                    </div>

                    <div className="md:col-span-2 flex justify-end">
                        <button
                            disabled={uploading}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded px-4 py-2 disabled:opacity-50"
                        >
                            {uploading ? "Đang tải..." : "Upload"}
                        </button>
                    </div>
                </form>
            </section>

            {/* Documents list */}
            <section className="bg-white border rounded-xl shadow p-4">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">
                    Tài liệu đã upload
                </h2>

                {loading ? (
                    <div className="text-gray-500 text-sm">Đang tải...</div>
                ) : docs.length === 0 ? (
                    <div className="text-gray-400 italic text-sm">
                        Chưa có tài liệu nào.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead>
                                <tr className="text-left bg-gray-50 text-gray-600">
                                    <th className="p-2">Tiêu đề</th>
                                    <th className="p-2">Mô tả</th>
                                    <th className="p-2">Danh mục</th>
                                    <th className="p-2">File</th>
                                    <th className="p-2 w-16">Xoá</th>
                                </tr>
                            </thead>
                            <tbody>
                                {docs.map((d) => (
                                    <tr
                                        key={d._id}
                                        className="border-t last:border-b text-gray-800"
                                    >
                                        <td className="p-2 align-top font-medium">
                                            {d.title || d.originalName}
                                        </td>
                                        <td className="p-2 align-top text-gray-600">
                                            {d.description || "—"}
                                        </td>
                                        <td className="p-2 align-top text-gray-600">
                                            {d.section || "—"}
                                        </td>
                                        <td className="p-2 align-top text-blue-600 underline break-all">
                                            <a
                                                href={
                                                    import.meta.env.VITE_API_URL
                                                        ? `${import.meta.env.VITE_API_URL}${d.fileUrl}`
                                                        : `${window.location.origin}${d.fileUrl}`
                                                }
                                                target="_blank"
                                                rel="noreferrer"
                                            >
                                                {d.originalName || d.fileUrl}
                                            </a>
                                        </td>
                                        <td className="p-2 align-top">
                                            <button
                                                onClick={() => handleDelete(d._id)}
                                                className="text-red-600 hover:underline text-xs"
                                            >
                                                Xoá
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </div>
    );
}

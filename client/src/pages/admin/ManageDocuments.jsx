// client/src/pages/admin/ManageDocuments.jsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../utils/api"; // shared axios instance w/ token

export default function ManageDocuments() {
    const [docs, setDocs] = useState([]);
    const [file, setFile] = useState(null);
    const [title, setTitle] = useState("");
    const [section, setSection] = useState("Reading");
    const [description, setDescription] = useState("");
    const [busy, setBusy] = useState(false);
    const [progress, setProgress] = useState(0);

    const loadDocs = async () => {
        try {
            const { data } = await api.get("/documents");
            setDocs(data);
        } catch (err) {
            console.error("❌ Error loading documents:", err);
            if (err.response?.status === 401) alert("Unauthorized - please log in again.");
        }
    };

    useEffect(() => {
        loadDocs();
    }, []);

    const handleUpload = async (e) => {
        e.preventDefault();
        if (!file) return alert("Please select a file");

        const formData = new FormData();
        formData.append("file", file);
        formData.append("title", title);
        formData.append("section", section);
        formData.append("description", description);

        try {
            setBusy(true);
            setProgress(0);
            await api.post("/documents/upload", formData, {
                headers: { "Content-Type": "multipart/form-data" },
                onUploadProgress: (evt) => {
                    if (!evt.total) return;
                    const pct = Math.round((evt.loaded / evt.total) * 100);
                    setProgress(pct);
                },
            });
            alert("✅ Upload successful!");
            setFile(null);
            setTitle("");
            setDescription("");
            setProgress(0);
            await loadDocs();
        } catch (err) {
            console.error("❌ Upload failed:", err);
            if (err.response?.status === 401) {
                alert("Unauthorized - please log in again.");
            } else {
                alert("Upload failed ❌");
            }
        } finally {
            setBusy(false);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm("Delete this document?")) return;
        try {
            await api.delete(`/documents/${id}`);
            await loadDocs();
        } catch (err) {
            console.error("❌ Delete failed:", err);
            alert("Delete failed");
        }
    };

    return (
        <div className="space-y-6">
            {/* Header with quick button */}
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-semibold">📘 Manage Documents</h2>
                <Link
                    to="/admin/mock-import"
                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                >
                    🧩 Go to Mock Import
                </Link>
            </div>

            {/* Upload form */}
            <form onSubmit={handleUpload} className="bg-white rounded border p-4 space-y-3">
                <input
                    type="text"
                    placeholder="Title"
                    className="border p-2 rounded w-full"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                />

                <select
                    className="border p-2 rounded w-full"
                    value={section}
                    onChange={(e) => setSection(e.target.value)}
                >
                    <option>Reading</option>
                    <option>Listening</option>
                    <option>Writing</option>
                    <option>Speaking</option>
                </select>

                <textarea
                    placeholder="Description"
                    className="border p-2 rounded w-full"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                />

                <div className="flex items-center gap-3">
                    <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                    {progress > 0 && busy && (
                        <div className="text-sm text-gray-600">{progress}%</div>
                    )}
                    <button
                        type="submit"
                        disabled={busy}
                        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-60"
                    >
                        {busy ? "Uploading..." : "Upload"}
                    </button>
                </div>
            </form>

            {/* List */}
            <div className="bg-white rounded border">
                <div className="p-3 border-b">
                    <h3 className="text-lg font-medium">Uploaded Documents</h3>
                </div>
                {docs.length === 0 ? (
                    <div className="p-3 text-sm text-gray-600">No documents uploaded yet.</div>
                ) : (
                    <ul className="divide-y">
                        {docs.map((d) => (
                            <li key={d._id} className="p-3 flex items-center justify-between">
                                <div>
                                    <div className="font-semibold">{d.title}</div>
                                    <div className="text-sm text-gray-500">{d.section}</div>
                                    <a
                                        href={`${import.meta.env.VITE_API_URL.replace('/api', '')}${d.fileUrl}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-blue-600 underline text-sm"
                                    >
                                        View File
                                    </a>
                                </div>
                                <button
                                    onClick={() => handleDelete(d._id)}
                                    className="text-red-600 hover:text-red-700 text-sm"
                                >
                                    Delete
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}

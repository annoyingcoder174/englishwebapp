import { useState } from "react";
import api from "../utils/api";

/**
 * MediaPicker
 * - lets admin paste a direct URL OR upload a local file
 * - on success, returns a public URL via onChange(url)
 *
 * Props:
 *   label: string (e.g. "Audio (MP3)" or "Hình ảnh (Part 1)")
 *   accept: string (e.g. "audio/*" or "image/*")
 *   value: current URL string
 *   onChange: (url) => void
 */
export default function MediaPicker({ label, accept = "audio/*", value = "", onChange }) {
    const [busy, setBusy] = useState(false);

    async function handleFile(e) {
        const file = e.target.files?.[0];
        if (!file) return;
        const form = new FormData();
        form.append("file", file);
        setBusy(true);
        try {
            const { data } = await api.post("/documents/upload", form, {
                headers: { "Content-Type": "multipart/form-data" },
            });
            // Expect server returns { url: "/uploads/..." } or similar
            if (data?.url) onChange(data.url);
            else alert("Upload thành công nhưng không nhận được URL.");
        } catch (err) {
            console.error("Upload error:", err);
            alert("Tải tệp thất bại. Vui lòng thử lại.");
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="space-y-2">
            <label className="block text-sm font-medium">{label}</label>
            <div className="flex gap-2">
                <input
                    type="url"
                    placeholder="https://... (hoặc để trống nếu dùng tệp tải lên)"
                    className="flex-1 border rounded p-2 text-sm"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                />
                <label className="inline-flex items-center gap-2 border rounded px-3 py-2 text-sm cursor-pointer bg-gray-50 hover:bg-gray-100">
                    Tải tệp
                    <input type="file" accept={accept} className="hidden" onChange={handleFile} disabled={busy} />
                </label>
            </div>
            {busy && <div className="text-xs text-gray-500">Đang tải lên...</div>}
            {value && (
                <div className="text-xs text-gray-600 break-all">
                    URL: <a className="text-blue-600 underline" href={value} target="_blank" rel="noreferrer">{value}</a>
                </div>
            )}
        </div>
    );
}

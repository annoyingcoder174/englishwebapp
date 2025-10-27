// client/src/utils/assets.js

// Build an absolute URL for uploaded assets (images, PDFs, audio, etc).
// Handles:
//   - already-absolute URLs (https://...)
//   - relative URLs from DB (/uploads/abc123.png)
//
// On Render, you MUST have VITE_API_URL set to "https://your-service.onrender.com/api"
// Locally, create client/.env.local with VITE_API_URL="http://localhost:5001/api"
export function toAssetUrl(raw) {
    if (!raw) return "";

    // If it's already absolute, just return it.
    if (/^https?:\/\//i.test(raw)) {
        return raw;
    }

    // Otherwise assume it's relative like "/uploads/xyz..."
    const base =
        import.meta.env.VITE_API_URL ||
        `${window.location.protocol}//${window.location.host}/api`;

    // make sure we don't double-slash
    const needsSlash = raw.startsWith("/") ? "" : "/";
    return `${base}${needsSlash}${raw}`;
}

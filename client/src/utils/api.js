// client/src/utils/api.js
import axios from "axios";

const base =
    import.meta.env.VITE_API_URL ||
    "http://localhost:5001/api";

console.log("✅ API Base URL:", base);

const api = axios.create({
    baseURL: base,
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem("token");
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export default api;

// client/src/pages/Login.jsx
import { useState } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import api from "../utils/api";

export default function Login() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const navigate = useNavigate();
    const { login } = useAuth();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        try {
            const res = await api.post("/auth/login", {

                email,
                password,
            });

            // Save via context (ensures token is stored as a string)
            login({
                token: res.data.token,
                role: res.data.role,
                name: res.data.name,
            });

            if (res.data.role === "admin") {
                navigate("/admin/documents");
            } else {
                navigate("/study");
            }
        } catch (err) {
            setError(err.response?.data?.error || "Đăng nhập thất bại");
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-blue-50">
            <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-md">
                <h2 className="text-3xl font-bold text-center text-blue-700 mb-6">
                    Chỗ Lanh Login học Toeic
                </h2>

                {error && (
                    <div className="mb-4 text-red-500 text-sm text-center">{error}</div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">
                            Email
                        </label>
                        <input
                            type="email"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring focus:ring-blue-200"
                            placeholder="lanhsuy@badtrip.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">
                            Mật khẩu
                        </label>
                        <input
                            type="password"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring focus:ring-blue-200"
                            placeholder="********"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg transition"
                    >
                        Vô
                    </button>
                </form>

                <p className="text-center text-sm text-gray-500 mt-4">
                    Chưa tạo acc thì vô đây tạo đi Lanh?{" "}
                    <Link to="/register" className="text-blue-600 hover:underline font-medium">
                        Tạo Acc
                    </Link>
                </p>
            </div>
        </div>
    );
}

import { useState } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";
import api from "../utils/api";

export default function Register() {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setSuccess("");

        try {
            const res = await api.post("/auth/register", {
                name,
                email,
                password,
            });

            setSuccess("Registration successful! Redirecting to login...");
            setTimeout(() => navigate("/"), 1500);
        } catch (err) {
            setError(err.response?.data?.error || "Registration failed");
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-blue-50">
            <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-md">
                <h2 className="text-3xl font-bold text-center text-blue-700 mb-6">
                    Tạo acc đi Lanh
                </h2>

                {error && <p className="text-red-500 text-sm mb-2 text-center">{error}</p>}
                {success && <p className="text-green-500 text-sm mb-2 text-center">{success}</p>}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Tên gì d?</label>
                        <input
                            type="text"
                            placeholder="Lanhsuy"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring focus:ring-blue-200"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Mail</label>
                        <input
                            type="email"
                            placeholder="lanhsuy@badtrip.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring focus:ring-blue-200"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Sít rịt khẩu</label>
                        <input
                            type="password"
                            placeholder="yourhoneyname"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring focus:ring-blue-200"
                        />
                    </div>

                    <button
                        type="submit"
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg transition"
                    >
                        Register
                    </button>
                </form>

                <p className="text-center text-sm text-gray-500 mt-4">
                    Ủa, có acc rồi hả?{" "}
                    <Link to="/" className="text-blue-600 hover:underline font-medium">
                        Vậy log acc đi
                    </Link>
                </p>
            </div>
        </div>
    );
}

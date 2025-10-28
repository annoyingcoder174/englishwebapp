import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../utils/api";
import Footer from "../components/Footer.jsx";

export default function Register() {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [busy, setBusy] = useState(false);

    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setSuccess("");
        setBusy(true);

        try {
            const res = await api.post("/auth/register", {
                name,
                email,
                password,
            });

            setSuccess("Registration successful! Redirecting to login...");

            // tiny delay then go back to login
            setTimeout(() => navigate("/"), 1500);
        } catch (err) {
            setError(err.response?.data?.error || "Registration failed");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col bg-blue-50">
            {/* main card */}
            <main className="flex-1 flex items-center justify-center p-4">
                <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-md animate-fade-in">
                    <h2 className="text-3xl font-bold text-center text-blue-700 mb-6">
                        Tạo acc đi ae!
                    </h2>

                    {error && (
                        <p className="text-red-500 text-sm mb-2 text-center">
                            {error}
                        </p>
                    )}
                    {success && (
                        <p className="text-green-500 text-sm mb-2 text-center">
                            {success}
                        </p>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-600 mb-1">
                                Tên gì d?
                            </label>
                            <input
                                type="text"
                                placeholder="Ten ae la gi"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring focus:ring-blue-200"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-600 mb-1">
                                Mail
                            </label>
                            <input
                                type="email"
                                placeholder="suy@badtrip.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring focus:ring-blue-200"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-600 mb-1">
                                Sít rịt khẩu
                            </label>
                            <input
                                type="password"
                                placeholder="gicungduoc"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring focus:ring-blue-200"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={busy}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg transition disabled:opacity-50"
                        >
                            {busy ? "Đang tạo..." : "Register"}
                        </button>
                    </form>

                    <p className="text-center text-sm text-gray-500 mt-4">
                        Ủa, có acc rồi hả?{" "}
                        <Link
                            to="/"
                            className="text-blue-600 hover:underline font-medium"
                        >
                            Vậy log acc đi
                        </Link>
                    </p>
                </div>
            </main>

            {/* global footer */}
            <Footer />
        </div>
    );
}

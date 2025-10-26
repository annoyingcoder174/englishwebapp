import { useAuth } from "../context/AuthContext.jsx";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate("/");
    };

    return (
        <div className="min-h-screen bg-blue-50 flex flex-col items-center justify-center">
            <div className="bg-white p-8 rounded-2xl shadow-lg text-center">
                <h1 className="text-3xl font-bold text-blue-700 mb-4">
                    Welcome, {user?.name} 👋
                </h1>
                <p className="text-gray-600 mb-6">
                    You are logged in as: <b>{user?.role}</b>
                </p>
                <button
                    onClick={handleLogout}
                    className="bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded-lg"
                >
                    Logout
                </button>
            </div>
        </div>
    );
}

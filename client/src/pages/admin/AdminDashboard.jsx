import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";

const linkClass = ({ isActive }) =>
    `block px-3 py-2 rounded ${isActive ? "bg-blue-100 text-blue-700" : "hover:bg-gray-100"}`;

export default function AdminDashboard() {
    const { logout } = useAuth();
    const navigate = useNavigate();

    return (
        <div className="min-h-screen flex bg-gray-100">
            {/* Sidebar */}
            <aside className="w-64 bg-white border-r">
                <div className="p-4 font-bold text-lg">Admin Panel</div>
                <nav className="p-3 space-y-2">
                    <NavLink to="/admin/documents" className={linkClass}>📄 Documents</NavLink>
                    <NavLink to="/admin/users" className={linkClass}>👥 Users</NavLink>
                    <NavLink to="/admin/mock-builder" className={linkClass}>🧱 Trình tạo Đề (Test Builder)</NavLink>
                    <NavLink to="/admin/mock-quick" className={linkClass}>⚡ Tạo nhanh (Paste ➜ Test)</NavLink>

                </nav>
                <div className="p-3 mt-auto">
                    <button
                        onClick={() => { logout(); navigate("/"); }}
                        className="w-full bg-red-600 text-white rounded px-3 py-2"
                    >
                        🔓 Logout
                    </button>
                </div>
            </aside>

            {/* Content */}
            <main className="flex-1 p-6">
                <Outlet />
            </main>
        </div>
    );
}

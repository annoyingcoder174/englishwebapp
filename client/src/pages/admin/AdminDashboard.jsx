import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";

const linkClass = ({ isActive }) =>
    `block px-3 py-2 rounded transition ${isActive
        ? "bg-blue-100 text-blue-700 font-semibold"
        : "text-gray-700 hover:bg-gray-100 hover:text-blue-700"
    }`;

export default function AdminDashboard() {
    const { logout } = useAuth();
    const navigate = useNavigate();

    return (
        <div className="min-h-screen flex bg-gray-50">
            {/* Sidebar */}
            <aside className="w-64 bg-white border-r shadow-sm flex flex-col">
                <div className="p-4 text-xl font-bold border-b">🛠️ Admin Panel</div>

                <nav className="flex-1 p-3 space-y-2">
                    <NavLink to="/admin/documents" className={linkClass}>
                        📄 Documents
                    </NavLink>
                    <NavLink to="/admin/users" className={linkClass}>
                        👥 Users
                    </NavLink>
                    <NavLink to="/admin/mock/builder" className={linkClass}>
                        🧱 Trình tạo đề (Mock Builder)
                    </NavLink>
                    <NavLink to="/admin/mock/quick" className={linkClass}>
                        ⚡ Tạo nhanh (Quick Create)
                    </NavLink>
                </nav>

                <div className="p-3 border-t">
                    <button
                        onClick={() => {
                            logout();
                            navigate("/");
                        }}
                        className="w-full bg-red-600 hover:bg-red-700 text-white rounded px-3 py-2 font-medium transition"
                    >
                        🔓 Logout
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-6 overflow-y-auto">
                <Outlet />
            </main>
        </div>
    );
}

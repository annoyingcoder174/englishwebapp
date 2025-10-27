// client/src/pages/admin/AdminDashboard.jsx
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";

const linkClass = ({ isActive }) =>
    `block px-3 py-2 rounded text-sm font-medium ${isActive
        ? "bg-blue-100 text-blue-700"
        : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
    }`;

export default function AdminDashboard() {
    const { logout } = useAuth();
    const navigate = useNavigate();

    function handleLogout() {
        logout();
        navigate("/");
    }

    return (
        <div className="min-h-screen flex bg-gray-100">
            {/* Sidebar */}
            <aside className="w-64 bg-white border-r flex flex-col">
                <div className="p-4 font-bold text-lg text-gray-800 border-b">
                    Admin Panel
                </div>

                <nav className="p-3 space-y-1 flex-1 text-sm">
                    <NavLink to="/admin/documents" className={linkClass}>
                        📄 Documents
                    </NavLink>

                    <NavLink to="/admin/tests" className={linkClass}>
                        🧪 Tests
                    </NavLink>

                    <NavLink to="/admin/results" className={linkClass}>
                        📊 Kết quả
                    </NavLink>

                    <NavLink to="/admin/users" className={linkClass}>
                        👥 Users
                    </NavLink>

                    <NavLink to="/admin/mock/builder" className={linkClass}>
                        🧱 Trình tạo Đề
                    </NavLink>

                    <NavLink to="/admin/mock/quick" className={linkClass}>
                        ⚡ Tạo nhanh
                    </NavLink>
                </nav>

                <div className="p-3 border-t">
                    <button
                        onClick={handleLogout}
                        className="w-full bg-red-600 text-white rounded px-3 py-2 text-sm font-medium hover:bg-red-700"
                    >
                        🔓 Logout
                    </button>
                </div>
            </aside>

            {/* Content */}
            <main className="flex-1 p-6 overflow-auto">
                <Outlet />
            </main>
        </div>
    );
}

import { useEffect, useState } from "react";
import api from "../../utils/api";

export default function ManageUsers() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // Fetch all users
    useEffect(() => {
        (async () => {
            try {
                const res = await api.get("/auth/users");
                setUsers(res.data);
            } catch (err) {
                console.error(err);
                setError("Không thể tải danh sách người dùng.");
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    // Promote or demote
    const toggleRole = async (userId, currentRole) => {
        const newRole = currentRole === "admin" ? "student" : "admin";
        if (!window.confirm(`Bạn có chắc muốn đổi ${currentRole} → ${newRole}?`)) return;
        try {
            const res = await api.patch(`/auth/users/${userId}/role`, { role: newRole });
            setUsers((prev) =>
                prev.map((u) => (u._id === userId ? { ...u, role: res.data.role } : u))
            );
        } catch (err) {
            console.error(err);
            alert("Không thể thay đổi quyền người dùng.");
        }
    };

    if (loading)
        return <div className="p-4 text-center text-gray-600 animate-fade-in">Đang tải...</div>;
    if (error)
        return <div className="p-4 text-center text-red-600 animate-fade-in">{error}</div>;

    return (
        <div className="p-6 max-w-5xl mx-auto animate-fade-in">
            <h1 className="text-xl font-bold mb-4 text-gray-800">👥 Quản lý người dùng</h1>

            <div className="overflow-x-auto border rounded-xl shadow bg-white">
                <table className="min-w-full text-sm">
                    <thead className="bg-gray-100 text-gray-700">
                        <tr>
                            <th className="px-4 py-2 text-left">Tên</th>
                            <th className="px-4 py-2 text-left">Email</th>
                            <th className="px-4 py-2 text-center">Vai trò</th>
                            <th className="px-4 py-2 text-center">Hành động</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map((u) => (
                            <tr key={u._id} className="border-t hover:bg-gray-50">
                                <td className="px-4 py-2">{u.name}</td>
                                <td className="px-4 py-2">{u.email}</td>
                                <td className="px-4 py-2 text-center font-semibold">
                                    {u.role === "admin" ? (
                                        <span className="text-indigo-600">Admin</span>
                                    ) : (
                                        <span className="text-gray-600">Student</span>
                                    )}
                                </td>
                                <td className="px-4 py-2 text-center">
                                    <button
                                        onClick={() => toggleRole(u._id, u.role)}
                                        className={`px-3 py-1 rounded text-xs text-white ${u.role === "admin"
                                                ? "bg-red-500 hover:bg-red-600"
                                                : "bg-green-500 hover:bg-green-600"
                                            }`}
                                    >
                                        {u.role === "admin" ? "⬇️ Demote" : "⬆️ Promote"}
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

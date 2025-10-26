import { useEffect, useState } from "react";
import axios from "axios";

export default function ManageUsers() {
    const [users, setUsers] = useState([]);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const res = await axios.get("http://localhost:5001/api/admin/users");
            setUsers(res.data);
        } catch (err) {
            console.error("Error fetching users:", err);
        }
    };

    const toggleRole = async (id, currentRole) => {
        try {
            await axios.put(`http://localhost:5001/api/admin/users/${id}`, {
                role: currentRole === "admin" ? "student" : "admin",
            });
            fetchUsers();
        } catch (err) {
            console.error("Error updating role:", err);
        }
    };

    return (
        <div className="p-6">
            <h2 className="text-2xl font-bold mb-4">👥 Manage Users</h2>
            <table className="w-full border border-gray-200">
                <thead>
                    <tr className="bg-gray-100">
                        <th className="p-2 border">Name</th>
                        <th className="p-2 border">Email</th>
                        <th className="p-2 border">Role</th>
                        <th className="p-2 border">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {users.map((u) => (
                        <tr key={u._id}>
                            <td className="p-2 border">{u.name}</td>
                            <td className="p-2 border">{u.email}</td>
                            <td className="p-2 border capitalize">{u.role}</td>
                            <td className="p-2 border text-center">
                                <button
                                    onClick={() => toggleRole(u._id, u.role)}
                                    className={`px-3 py-1 rounded ${u.role === "admin"
                                            ? "bg-red-500 hover:bg-red-600"
                                            : "bg-green-500 hover:bg-green-600"
                                        } text-white`}
                                >
                                    {u.role === "admin" ? "Demote" : "Promote"}
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

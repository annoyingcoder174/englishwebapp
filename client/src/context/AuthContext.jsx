// client/src/context/AuthContext.jsx
import { createContext, useContext, useEffect, useState } from "react";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);

    useEffect(() => {
        const token = localStorage.getItem("token");
        const role = localStorage.getItem("role");
        const name = localStorage.getItem("name");
        if (token && role) setUser({ token, role, name });
    }, []);

    // Accepts login({token, role, name}) OR login(token, role, name)
    const login = (a, b, c) => {
        const data =
            typeof a === "object" && a !== null
                ? a
                : { token: a, role: b, name: c };

        if (!data?.token || typeof data.token !== "string") {
            console.error("login() must be called with a string token");
            return;
        }

        localStorage.setItem("token", data.token);
        localStorage.setItem("role", data.role || "");
        localStorage.setItem("name", data.name || "");
        setUser({ token: data.token, role: data.role, name: data.name });
    };

    const logout = () => {
        localStorage.clear();
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);

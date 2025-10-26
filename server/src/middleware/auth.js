import jwt from "jsonwebtoken";

/** Normalize decoded JWT into a consistent req.user shape */
function normalizeUser(decoded) {
    // prefer sub, then id, then _id
    const id = decoded?.sub || decoded?.id || decoded?._id;
    return {
        id,
        _id: id, // convenience alias
        role: decoded?.role || "student",
        name: decoded?.name,
        email: decoded?.email,
        // keep the raw payload too (useful later)
        ...decoded,
    };
}

export const verifyToken = (req, res, next) => {
    const authHeader = req.headers?.authorization || "";
    if (!authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "No token provided" });
    }

    const token = authHeader.slice(7);
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = normalizeUser(decoded);
        if (!user.id) {
            return res.status(401).json({ error: "Invalid token (no user id)" });
        }
        req.user = user;
        next();
    } catch (err) {
        console.error("Token verification failed:", err.message);
        return res.status(401).json({ error: "Invalid token" });
    }
};

export const authRequired = verifyToken;

export const requireRole = (role) => (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    if (req.user.role !== role) {
        return res.status(403).json({ error: "Access denied: insufficient role" });
    }
    next();
};

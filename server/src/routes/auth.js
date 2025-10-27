import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { body, validationResult } from "express-validator";
import User from "../models/User.js";
import { authRequired, requireRole } from "../middleware/auth.js";

const router = Router();

/* ---------------- REGISTER ---------------- */
router.post(
    "/register",
    body("email").isEmail(),
    body("password").isLength({ min: 6 }),
    body("name").notEmpty(),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
            return res.status(400).json({ errors: errors.array() });

        const { name, email, password, role } = req.body;

        const exists = await User.findOne({ email });
        if (exists)
            return res
                .status(409)
                .json({ error: "Email already registered" });

        const passwordHash = await bcrypt.hash(password, 10);

        const user = await User.create({
            name,
            email,
            passwordHash,
            role: role === "admin" ? "admin" : "student",
        });

        res.json({ id: user._id });
    }
);

/* ---------------- LOGIN ---------------- */
router.post(
    "/login",
    body("email").isEmail(),
    body("password").notEmpty(),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
            return res.status(400).json({ errors: errors.array() });

        const { email, password } = req.body;
        const user = await User.findOne({ email });

        if (!user)
            return res.status(401).json({ error: "Invalid credentials" });

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok)
            return res.status(401).json({ error: "Invalid credentials" });

        const token = jwt.sign(
            {
                sub: user._id,
                role: user.role,
                name: user.name,
                email: user.email,
            },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        res.json({
            token,
            role: user.role,
            name: user.name,
        });
    }
);

/* ---------------- ADMIN: LIST USERS ----------------
   GET /api/auth/users
   used by ManageTests.jsx to pick allowed accounts
---------------------------------------------------- */
router.get(
    "/users",
    authRequired,
    requireRole("admin"),
    async (_req, res) => {
        const everyone = await User.find({})
            .select("_id name email role")
            .sort({ role: 1, name: 1 })
            .lean();
        res.json(everyone);
    }
);

export default router;

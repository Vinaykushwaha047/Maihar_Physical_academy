
const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../config/db");

const router = express.Router();

// LOGIN: Username ya Email dono se
router.post("/login", async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: "Username and password required"
            });
        }

        const identifier = username.trim();

        const [users] = await db.query(
            "SELECT * FROM users WHERE username = ? OR email = ? LIMIT 1",
            [identifier, identifier.toLowerCase()]
        );

        if (users.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Invalid username or password"
            });
        }

        const user = users[0];

        const validPassword = await bcrypt.compare(
            password,
            user.password_hash
        );

        if (!validPassword) {
            return res.status(401).json({
                success: false,
                message: "Invalid username or password"
            });
        }

        if (!process.env.JWT_SECRET) {
            throw new Error("JWT_SECRET is missing");
        }

        const token = jwt.sign(
            {
                id: user.id,
                role: user.role
            },
            process.env.JWT_SECRET,
            { expiresIn: "1d" }
        );

        res.json({
            success: true,
            message: "Login successful",
            token,
            user: {
                id: user.id,
                name: user.full_name,
                full_name: user.full_name,
                username: user.username,
                email: user.email,
                phone: user.phone,
                role: user.role,
                course: user.course,
                batch: user.batch,
                totalFees: Number(user.total_fees || 0),
                paidFees: Number(user.paid_fees || 0),
                profile_picture: user.profile_picture
            }
        });

    } catch (error) {
        console.error("Login Error:", error);

        res.status(500).json({
            success: false,
            message: "Login failed"
        });
    }
});

// STUDENT REGISTRATION
router.post("/register", async (req, res) => {
    try {
        const {
            full_name,
            username,
            email,
            phone,
            password,
            course,
            batch
        } = req.body;

        if (!full_name || !username || !password) {
            return res.status(400).json({
                success: false,
                message: "Name, username and password are required"
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 8 characters"
            });
        }

        const cleanUsername = username.trim();
        const cleanEmail = email ? email.trim().toLowerCase() : null;

        const [existing] = await db.query(
            "SELECT id FROM users WHERE username = ? OR (email = ? AND email IS NOT NULL)",
            [cleanUsername, cleanEmail]
        );

        if (existing.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Username or email already exists"
            });
        }

        const passwordHash = await bcrypt.hash(password, 12);

        const [result] = await db.query(
            `INSERT INTO users
            (full_name, username, email, phone, password_hash, role, course, batch)
            VALUES (?, ?, ?, ?, ?, 'student', ?, ?)`,
            [
                full_name.trim(),
                cleanUsername,
                cleanEmail,
                phone || null,
                passwordHash,
                course || null,
                batch || null
            ]
        );

        res.status(201).json({
            success: true,
            message: "Student registered successfully",
            userId: result.insertId
        });

    } catch (error) {
        console.error("Registration Error:", error);

        res.status(500).json({
            success: false,
            message: "Registration failed"
        });
    }
});

module.exports = router;

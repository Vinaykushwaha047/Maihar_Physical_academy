
const express = require("express");
const bcrypt = require("bcrypt");
const db = require("../config/db");

const router = express.Router();

// Student Registration
router.post("/register", async (req, res) => {
    try {
        const {
            full_name,
            email,
            phone,
            password,
            course,
            batch
        } = req.body;

        if (!full_name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: "Name, email and password are required"
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 8 characters"
            });
        }

        const [existing] = await db.query(
            "SELECT id FROM users WHERE email = ?",
            [email]
        );

        if (existing.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Email already registered"
            });
        }

        const password_hash = await bcrypt.hash(password, 12);

        const [result] = await db.query(
            `INSERT INTO users
            (full_name, email, phone, password_hash, role, course, batch)
            VALUES (?, ?, ?, ?, 'student', ?, ?)`,
            [
                full_name,
                email,
                phone || null,
                password_hash,
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
        console.error(error);
        res.status(500).json({
            success: false,
            message: "Registration failed"
        });
    }
});

module.exports = router;


const express = require("express");
const bcrypt = require("bcrypt");
const db = require("../config/db");

const router = express.Router();

router.post("/create-trainer", async (req, res) => {
    try {
        const setupSecret = process.env.TRAINER_SETUP_SECRET;

        if (!setupSecret) {
            return res.status(403).json({
                success: false,
                message: "Trainer setup is disabled"
            });
        }

        if (req.headers["x-setup-secret"] !== setupSecret) {
            return res.status(403).json({
                success: false,
                message: "Invalid setup secret"
            });
        }

        const { name, username, password } = req.body;

        if (!name || !username || !password || password.length < 12) {
            return res.status(400).json({
                success: false,
                message: "Name, username and password (minimum 12 characters) required"
            });
        }

        const [existing] = await db.query(
            "SELECT id FROM users WHERE role = 'trainer' LIMIT 1"
        );

        if (existing.length) {
            return res.status(409).json({
                success: false,
                message: "Trainer already exists"
            });
        }

        const passwordHash = await bcrypt.hash(password, 12);

        const [result] = await db.query(
            `INSERT INTO users
             (full_name, username, password_hash, role)
             VALUES (?, ?, ?, 'trainer')`,
            [name.trim(), username.trim(), passwordHash]
        );

        // Disable setup immediately after successful creation
        delete process.env.TRAINER_SETUP_SECRET;

        res.status(201).json({
            success: true,
            message: "Trainer account created successfully",
            trainerId: result.insertId
        });

    } catch (error) {
        console.error("Trainer setup error:", error);

        res.status(500).json({
            success: false,
            message: "Trainer account creation failed"
        });
    }
});

module.exports = router;

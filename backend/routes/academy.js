
const express = require("express");
const bcrypt = require("bcrypt");
const db = require("../config/db");
const { verifyToken, trainerOnly } = require("../middleware/auth");

const router = express.Router();

// All routes require login
router.use(verifyToken);

// GET LOGGED-IN USER PROFILE
router.get("/me", async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT id, full_name, username, email, phone, role,
                    course, batch, total_fees, paid_fees, profile_picture
             FROM users WHERE id = ?`,
            [req.user.id]
        );

        if (!rows.length) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        res.json({ success: true, user: rows[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Could not load profile" });
    }
});

// GET ALL STUDENTS (TRAINER ONLY)
router.get("/students", trainerOnly, async (req, res) => {
    try {
        const [students] = await db.query(
            `SELECT id, full_name, username, phone, course, batch,
                    total_fees, paid_fees
             FROM users WHERE role = 'student' ORDER BY id DESC`
        );

        res.json({ success: true, students });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Could not load students" });
    }
});

// ADD STUDENT (TRAINER ONLY)
router.post("/students", trainerOnly, async (req, res) => {
    try {
        const {
            name, full_name, username, password, phone,
            totalFees, paidFees, course, batch
        } = req.body;

        const studentName = (full_name || name || "").trim();
        const studentUsername = (username || "").trim();

        if (!studentName || !studentUsername || !password) {
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

        const total = Number(totalFees || 0);
        const paid = Number(paidFees || 0);

        if (!Number.isFinite(total) || !Number.isFinite(paid) ||
            total < 0 || paid < 0 || paid > total) {
            return res.status(400).json({
                success: false,
                message: "Please enter valid fee amounts"
            });
        }

        const [existing] = await db.query(
            "SELECT id FROM users WHERE username = ?",
            [studentUsername]
        );

        if (existing.length) {
            return res.status(409).json({
                success: false,
                message: "Username already exists"
            });
        }

        const passwordHash = await bcrypt.hash(password, 12);

        const [result] = await db.query(
            `INSERT INTO users
             (full_name, username, phone, password_hash, role,
              course, batch, total_fees, paid_fees)
             VALUES (?, ?, ?, ?, 'student', ?, ?, ?, ?)`,
            [
                studentName, studentUsername, phone || null,
                passwordHash, course || null, batch || null, total, paid
            ]
        );

        res.status(201).json({
            success: true,
            message: "Student added successfully",
            studentId: result.insertId
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Could not add student" });
    }
});

// UPDATE STUDENT DETAILS (TRAINER ONLY)
router.put("/students/:id", trainerOnly, async (req, res) => {
    try {
        const { name, full_name, phone, totalFees, paidFees, course, batch } = req.body;
        const studentId = Number(req.params.id);

        const [students] = await db.query(
            "SELECT id, total_fees, paid_fees FROM users WHERE id = ? AND role = 'student'",
            [studentId]
        );

        if (!students.length) {
            return res.status(404).json({ success: false, message: "Student not found" });
        }

        const total = totalFees === undefined ? Number(students[0].total_fees) : Number(totalFees);
        const paid = paidFees === undefined ? Number(students[0].paid_fees) : Number(paidFees);

        if (!Number.isFinite(total) || !Number.isFinite(paid) ||
            total < 0 || paid < 0 || paid > total) {
            return res.status(400).json({
                success: false,
                message: "Please enter valid fee amounts"
            });
        }

        await db.query(
            `UPDATE users SET
             full_name = COALESCE(?, full_name),
             phone = COALESCE(?, phone),
             total_fees = ?,
             paid_fees = ?,
             course = COALESCE(?, course),
             batch = COALESCE(?, batch)
             WHERE id = ? AND role = 'student'`,
            [
                (full_name || name || "").trim() || null,
                phone === undefined ? null : phone,
                total, paid, course || null, batch || null, studentId
            ]
        );

        res.json({ success: true, message: "Student updated successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Could not update student" });
    }
});

// DELETE STUDENT (TRAINER ONLY)
router.delete("/students/:id", trainerOnly, async (req, res) => {
    const connection = await db.getConnection();

    try {
        const studentId = Number(req.params.id);
        await connection.beginTransaction();

        const [students] = await connection.query(
            "SELECT id FROM users WHERE id = ? AND role = 'student'",
            [studentId]
        );

        if (!students.length) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: "Student not found" });
        }

        await connection.query(
            "DELETE FROM attendance WHERE student_id = ?",
            [studentId]
        );

        await connection.query(
            "DELETE FROM users WHERE id = ? AND role = 'student'",
            [studentId]
        );

        await connection.commit();
        res.json({ success: true, message: "Student deleted successfully" });
    } catch (error) {
        await connection.rollback();
        console.error(error);
        res.status(500).json({ success: false, message: "Could not delete student" });
    } finally {
        connection.release();
    }
});

// GET ATTENDANCE
router.get("/attendance", async (req, res) => {
    try {
        const { date } = req.query;

        if (req.user.role === "trainer") {
            let sql = `
                SELECT a.id, a.student_id, u.full_name, u.username,
                       a.attendance_date, a.status, a.remarks
                FROM attendance a
                JOIN users u ON u.id = a.student_id
                WHERE u.role = 'student'
            `;
            const params = [];

            if (date) {
                sql += " AND a.attendance_date = ?";
                params.push(date);
            }

            sql += " ORDER BY a.attendance_date DESC, u.full_name ASC";

            const [rows] = await db.query(sql, params);
            return res.json({ success: true, attendance: rows });
        }

        let sql = `
            SELECT id, student_id, attendance_date, status, remarks
            FROM attendance WHERE student_id = ?
        `;
        const params = [req.user.id];

        if (date) {
            sql += " AND attendance_date = ?";
            params.push(date);
        }

        sql += " ORDER BY attendance_date DESC";

        const [rows] = await db.query(sql, params);
        res.json({ success: true, attendance: rows });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Could not load attendance" });
    }
});

// MARK / UPDATE ATTENDANCE (TRAINER ONLY)
router.post("/attendance", trainerOnly, async (req, res) => {
    try {
        const { student_id, attendance_date, status, remarks } = req.body;
        const normalizedStatus = String(status || "").toLowerCase();

        if (!student_id || !attendance_date ||
            !["present", "absent"].includes(normalizedStatus)) {
            return res.status(400).json({
                success: false,
                message: "Student, date and valid attendance status are required"
            });
        }

        const [students] = await db.query(
            "SELECT id FROM users WHERE id = ? AND role = 'student'",
            [student_id]
        );

        if (!students.length) {
            return res.status(404).json({ success: false, message: "Student not found" });
        }

        await db.query(
            `INSERT INTO attendance
             (student_id, trainer_id, attendance_date, status, remarks)
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
             trainer_id = VALUES(trainer_id),
             status = VALUES(status),
             remarks = VALUES(remarks)`,
            [student_id, req.user.id, attendance_date, normalizedStatus, remarks || null]
        );

        res.json({ success: true, message: "Attendance saved successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Could not save attendance" });
    }
});

// UPDATE FEES (TRAINER ONLY)
router.put("/fees/:id", trainerOnly, async (req, res) => {
    try {
        const studentId = Number(req.params.id);
        const total = Number(req.body.totalFees);
        const paid = Number(req.body.paidFees);

        if (!Number.isFinite(total) || !Number.isFinite(paid) ||
            total < 0 || paid < 0 || paid > total) {
            return res.status(400).json({
                success: false,
                message: "Please enter valid fee amounts"
            });
        }

        const [result] = await db.query(
            `UPDATE users SET total_fees = ?, paid_fees = ?
             WHERE id = ? AND role = 'student'`,
            [total, paid, studentId]
        );

        if (!result.affectedRows) {
            return res.status(404).json({ success: false, message: "Student not found" });
        }

        res.json({ success: true, message: "Fees updated successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Could not update fees" });
    }
});

// GET NOTICES (TRAINER AND STUDENT)
router.get("/notices", async (req, res) => {
    try {
        const [notices] = await db.query(
            `SELECT n.id, n.title, n.body, n.created_at,
                    u.full_name AS trainer_name
             FROM notices n
             LEFT JOIN users u ON u.id = n.trainer_id
             ORDER BY n.created_at DESC`
        );

        res.json({ success: true, notices });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Could not load notices" });
    }
});

// ADD NOTICE (TRAINER ONLY)
router.post("/notices", trainerOnly, async (req, res) => {
    try {
        const { title, body } = req.body;

        if (!title || !body) {
            return res.status(400).json({
                success: false,
                message: "Notice title and message are required"
            });
        }

        const [result] = await db.query(
            "INSERT INTO notices (title, body, trainer_id) VALUES (?, ?, ?)",
            [title.trim(), body.trim(), req.user.id]
        );

        res.status(201).json({
            success: true,
            message: "Notice published successfully",
            noticeId: result.insertId
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Could not publish notice" });
    }
});

// DELETE NOTICE (TRAINER ONLY)
router.delete("/notices/:id", trainerOnly, async (req, res) => {
    try {
        const [result] = await db.query(
            "DELETE FROM notices WHERE id = ?",
            [req.params.id]
        );

        if (!result.affectedRows) {
            return res.status(404).json({ success: false, message: "Notice not found" });
        }

        res.json({ success: true, message: "Notice deleted successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Could not delete notice" });
    }
});

module.exports = router;


require("dotenv").config();

const bcrypt = require("bcrypt");
const db = require("./config/db");

async function createTrainer() {
    try {
        const name = "Academy Trainer";
        const username = "trainer";
        const password = "ChangeThis@123";

        const [existing] = await db.query(
            "SELECT id FROM users WHERE username = ?",
            [username]
        );

        if (existing.length > 0) {
            console.log("Trainer account already exists.");
            return;
        }

        const passwordHash = await bcrypt.hash(password, 12);

        await db.query(
            `INSERT INTO users
            (full_name, username, password_hash, role)
            VALUES (?, ?, ?, 'trainer')`,
            [name, username, passwordHash]
        );

        console.log("Trainer account created successfully!");
        console.log("Username:", username);
        console.log("Password:", password);

    } catch (error) {
        console.error("Trainer creation failed:", error);
    } finally {
        await db.end();
    }
}

createTrainer();

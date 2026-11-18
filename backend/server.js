
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const db = require("./config/db");
const initDatabase = require("./config/init-db");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.send("Maihar Physical Academy Backend Running!");
});

app.get("/api/db-check", async (req, res) => {
    try {
        const [rows] = await db.query("SELECT 1 AS connected");

        res.json({
            success: true,
            message: "MySQL Connected Successfully!",
            database: rows
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "Database Connection Failed"
        });
    }
});

const PORT = process.env.PORT || 3000;

async function startServer() {
    try {
        await initDatabase();

        app.listen(PORT, "0.0.0.0", () => {
            console.log("Academy Backend Running on " + PORT);
        });
    } catch (error) {
        console.error("Database initialization failed:", error);
        process.exit(1);
    }
}

startServer();


const express = require("express");
const cors = require("cors");
require("dotenv").config();

const db = require("./config/db");
const initDatabase = require("./config/init-db");

const authRoutes = require("./routes/auth");
const academyRoutes = require("./routes/academy");

const app = express();

// Middleware
app.use(cors({
    origin: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api", academyRoutes);

// Home Route
app.get("/", (req, res) => {
    res.send("Maihar Physical Academy Backend Running!");
});

// Database Check
app.get("/api/db-check", async (req, res) => {
    try {
        const [rows] = await db.query("SELECT 1 AS connected");

        res.status(200).json({
            success: true,
            message: "MySQL Connected Successfully!",
            database: rows
        });

    } catch (error) {
        console.error("Database Error:", error);

        res.status(500).json({
            success: false,
            message: "Database Connection Failed"
        });
    }
});

// Server Start
const PORT = process.env.PORT || 3000;

async function startServer() {
    try {
        await initDatabase();

        app.listen(PORT, "0.0.0.0", () => {
            console.log("--------------------------------");
            console.log("Maihar Physical Academy Backend");
            console.log("Server Port:", PORT);
            console.log("MySQL Database Connected");
            console.log("--------------------------------");
        });

    } catch (error) {
        console.error("Server Startup Failed:", error);
        process.exit(1);
    }
}

startServer();


const db = require("./db");

async function initDatabase() {
    // Users table
    await db.query(`
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            full_name VARCHAR(100) NOT NULL,
            email VARCHAR(150) NOT NULL UNIQUE,
            phone VARCHAR(15),
            password_hash VARCHAR(255) NOT NULL,
            role ENUM('student', 'trainer') NOT NULL,
            course VARCHAR(100),
            batch VARCHAR(100),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Attendance table
    await db.query(`
        CREATE TABLE IF NOT EXISTS attendance (
            id INT AUTO_INCREMENT PRIMARY KEY,
            student_id INT NOT NULL,
            trainer_id INT NOT NULL,
            attendance_date DATE NOT NULL,
            status ENUM('present', 'absent') NOT NULL,
            remarks VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

            UNIQUE KEY unique_student_date
            (student_id, attendance_date),

            FOREIGN KEY (student_id)
            REFERENCES users(id),

            FOREIGN KEY (trainer_id)
            REFERENCES users(id)
        )
    `);

    console.log("All database tables created successfully!");
}

module.exports = initDatabase;

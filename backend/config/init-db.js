
const db = require("./db");

// Add a column only if it does not already exist
async function addColumnIfMissing(table, column, definition) {
    const [rows] = await db.query(
        `SELECT COLUMN_NAME
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = ?
         AND COLUMN_NAME = ?`,
        [table, column]
    );

    if (rows.length === 0) {
        await db.query(
            `ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`
        );
        console.log(`Added column: ${table}.${column}`);
    }
}

// Add an index only if it does not already exist
async function addIndexIfMissing(table, indexName, definition) {
    const [rows] = await db.query(
        `SELECT INDEX_NAME
         FROM INFORMATION_SCHEMA.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = ?
         AND INDEX_NAME = ?`,
        [table, indexName]
    );

    if (rows.length === 0) {
        await db.query(
            `ALTER TABLE \`${table}\` ADD ${definition}`
        );
        console.log(`Added index: ${indexName}`);
    }
}

async function initDatabase() {

    // USERS TABLE
    await db.query(`
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            full_name VARCHAR(100) NOT NULL,
            email VARCHAR(150) UNIQUE,
            username VARCHAR(100) UNIQUE,
            phone VARCHAR(15),
            password_hash VARCHAR(255) NOT NULL,
            role ENUM('student', 'trainer') NOT NULL,
            course VARCHAR(100),
            batch VARCHAR(100),
            total_fees DECIMAL(10,2) NOT NULL DEFAULT 0,
            paid_fees DECIMAL(10,2) NOT NULL DEFAULT 0,
            profile_picture MEDIUMTEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Update existing users table safely
    await addColumnIfMissing(
        "users", "username", "VARCHAR(100) NULL"
    );

    await addColumnIfMissing(
        "users", "total_fees", "DECIMAL(10,2) NOT NULL DEFAULT 0"
    );

    await addColumnIfMissing(
        "users", "paid_fees", "DECIMAL(10,2) NOT NULL DEFAULT 0"
    );

    await addColumnIfMissing(
        "users", "profile_picture", "MEDIUMTEXT NULL"
    );

    // Allow accounts without email; username will be used for login
    await db.query(`
        ALTER TABLE users
        MODIFY COLUMN email VARCHAR(150) NULL
    `);

    await addIndexIfMissing(
        "users",
        "unique_username",
        "UNIQUE INDEX unique_username (username)"
    );

    // ATTENDANCE TABLE
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

    // NOTIFICATIONS TABLE
    await db.query(`
        CREATE TABLE IF NOT EXISTS notices (
            id INT AUTO_INCREMENT PRIMARY KEY,
            title VARCHAR(200) NOT NULL,
            body TEXT NOT NULL,
            trainer_id INT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

            FOREIGN KEY (trainer_id)
            REFERENCES users(id)
            ON DELETE SET NULL
        )
    `);

    console.log("All database tables created successfully!");
}

module.exports = initDatabase;

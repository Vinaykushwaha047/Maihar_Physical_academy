
const jwt = require("jsonwebtoken");

// Check login token
function verifyToken(req, res, next) {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "Login required. Token missing."
            });
        }

        const token = authHeader.split(" ")[1];

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        req.user = decoded;
        next();

    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "Invalid or expired login session"
        });
    }
}

// Allow only trainer
function trainerOnly(req, res, next) {
    if (req.user.role !== "trainer") {
        return res.status(403).json({
            success: false,
            message: "Trainer access only"
        });
    }

    next();
}

module.exports = {
    verifyToken,
    trainerOnly
};

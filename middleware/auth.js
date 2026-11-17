const User = require("../models/userModel");
const { verifyToken } = require("../utils/auth");

const getRequestToken = (req) => {
	const authorization = req.get("authorization");
	if (authorization && authorization.startsWith("Bearer ")) {
		return authorization.slice(7).trim();
	}
	return req.cookies?.jwt || req.cookies?.token || null;
};

const protect = async (req, res, next) => {
	try {
		const token = getRequestToken(req);
		if (!token) {
			return res.status(401).json({ status: "fail", message: "Authentication required" });
		}

		const payload = verifyToken(token);
		const user = await User.findById(payload.id).select("-password");
		if (!user || user.status !== "active") {
			return res.status(401).json({ status: "fail", message: "Account is not active" });
		}

		req.user = user;
		next();
	} catch (error) {
		return res.status(401).json({ status: "fail", message: "Invalid or expired token" });
	}
};

const requireRole = (...roles) => (req, res, next) => {
	if (!req.user || !roles.includes(req.user.role)) {
		return res.status(403).json({ status: "fail", message: "Insufficient permissions" });
	}
	next();
};

const requireEditor = [protect, requireRole("administrator", "editor", "publisher")];
const requirePublisher = [protect, requireRole("administrator", "publisher")];
const requireAdministrator = [protect, requireRole("administrator")];

module.exports = { protect, requireRole, requireEditor, requirePublisher, requireAdministrator };

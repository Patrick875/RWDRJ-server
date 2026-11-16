const jwt = require("jsonwebtoken");

const getJwtSecret = () => {
	if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
		throw new Error("JWT_SECRET must be configured with at least 32 characters");
	}
	return process.env.JWT_SECRET;
};

const getTokenExpiry = () => process.env.JWT_EXPIRES_IN || "12h";

const signToken = (user) =>
	jwt.sign(
		{ id: String(user._id), role: user.role, email: user.email },
		getJwtSecret(),
		{ expiresIn: getTokenExpiry() }
	);

const verifyToken = (token) => jwt.verify(token, getJwtSecret());

const sanitizeUser = (user) => {
	const value = user.toObject ? user.toObject() : { ...user };
	delete value.password;
	delete value.resetPasswordToken;
	delete value.resetPasswordExpiresAt;
	return value;
};

module.exports = { getJwtSecret, signToken, verifyToken, sanitizeUser };

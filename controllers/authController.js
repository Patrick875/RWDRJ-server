const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const User = require("../models/userModel");
const UserInvite = require("../models/userInvite");
const asyncHandler = require("../utils/asyncHandler");
const { signToken, sanitizeUser } = require("../utils/auth");
const { recordAudit } = require("../middleware/audit");

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

const setAuthCookie = (res, token) => {
	res.cookie("jwt", token, {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
		maxAge: 12 * 60 * 60 * 1000,
	});
};

const sendAuthResponse = (res, user, statusCode = 200) => {
	const token = signToken(user);
	setAuthCookie(res, token);
	return res.status(statusCode).json({ status: "success", token, user: sanitizeUser(user) });
};

exports.login = asyncHandler(async (req, res) => {
	const email = normalizeEmail(req.body.email);
	const password = String(req.body.password || "");
	if (!email || !password) return res.status(400).json({ status: "fail", message: "Email and password are required" });

	const user = await User.findOne({ email }).select("+password");
	if (!user || user.status !== "active" || !(await bcrypt.compare(password, user.password))) {
		return res.status(401).json({ status: "fail", message: "Incorrect email or password" });
	}
	user.lastLoginAt = new Date();
	await user.save({ validateBeforeSave: false });
	return sendAuthResponse(res, user);
});

exports.me = asyncHandler(async (req, res) => {
	res.status(200).json({ status: "success", data: sanitizeUser(req.user) });
});

exports.logout = asyncHandler(async (req, res) => {
	res.clearCookie("jwt", { httpOnly: true, sameSite: process.env.NODE_ENV === "production" ? "none" : "lax", secure: process.env.NODE_ENV === "production" });
	res.status(200).json({ status: "success", message: "Logged out" });
});

exports.signup = asyncHandler(async (req, res) => {
	if (process.env.ALLOW_PUBLIC_SIGNUP !== "true") {
		return res.status(403).json({ status: "fail", message: "Public signup is disabled. Request an invitation." });
	}
	const email = normalizeEmail(req.body.email);
	const fullname = String(req.body.fullname || "").trim();
	const password = String(req.body.password || "");
	if (!email || !fullname || password.length < 8) return res.status(400).json({ status: "fail", message: "fullname, email and a password of at least 8 characters are required" });
	const user = await User.create({ fullname, email, password: await bcrypt.hash(password, 12), role: "editor", emailVerified: false });
	return sendAuthResponse(res, user, 201);
});

exports.forgotPassword = asyncHandler(async (req, res) => {
	const email = normalizeEmail(req.body.email);
	const user = await User.findOne({ email });
	if (user) {
		const token = crypto.randomBytes(32).toString("hex");
		user.resetPasswordToken = hashToken(token);
		user.resetPasswordExpiresAt = new Date(Date.now() + 60 * 60 * 1000);
		await user.save({ validateBeforeSave: false });
		console.log(JSON.stringify({ event: "password_reset_requested", email, hasMailConfig: Boolean(process.env.RESET_PASSWORD_EMAIL) }));
		if (process.env.NODE_ENV !== "production") console.log(`Password reset token for development: ${token}`);
	}
	res.status(200).json({ status: "success", message: "If the account exists, reset instructions will be sent" });
});

exports.resetPassword = asyncHandler(async (req, res) => {
	const token = String(req.body.token || "");
	const password = String(req.body.password || "");
	if (!token || password.length < 8) return res.status(400).json({ status: "fail", message: "A valid token and password of at least 8 characters are required" });
	const user = await User.findOne({ resetPasswordToken: hashToken(token), resetPasswordExpiresAt: { $gt: new Date() } }).select("+password");
	if (!user) return res.status(400).json({ status: "fail", message: "Token is invalid or expired" });
	user.password = await bcrypt.hash(password, 12);
	user.resetPasswordToken = undefined;
	user.resetPasswordExpiresAt = undefined;
	await user.save();
	await recordAudit({ req, action: "reset_password", resource: "user", resourceId: user._id });
	res.status(200).json({ status: "success", message: "Password reset successfully" });
});

exports.acceptInvite = asyncHandler(async (req, res) => {
	const token = String(req.body.token || "");
	const password = String(req.body.password || "");
	if (!token || password.length < 8) return res.status(400).json({ status: "fail", message: "A valid invite token and password of at least 8 characters are required" });
	const invite = await UserInvite.findOne({ tokenHash: hashToken(token), expiresAt: { $gt: new Date() }, acceptedAt: null });
	if (!invite) return res.status(400).json({ status: "fail", message: "Invite is invalid or expired" });
	const user = await User.findOneAndUpdate(
		{ email: invite.email },
		{ fullname: invite.fullname, password: await bcrypt.hash(password, 12), role: invite.role, status: "active", emailVerified: true },
		{ new: true }
	);
	if (!user) return res.status(404).json({ status: "fail", message: "Invited user was not found" });
	invite.acceptedAt = new Date();
	await invite.save();
	return sendAuthResponse(res, user);
});

const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const User = require("../models/userModel");
const UserInvite = require("../models/userInvite");
const asyncHandler = require("../utils/asyncHandler");
const { sanitizeUser } = require("../utils/auth");
const { recordAudit } = require("../middleware/audit");
const { sendAdminInvite } = require("../utils/sendAdminInvite");

const roles = ["administrator", "publisher", "editor", "viewer"];
const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

exports.listUsers = asyncHandler(async (req, res) => {
	const users = await User.find().select("-password -resetPasswordToken -resetPasswordExpiresAt").sort({ createdAt: -1 }).lean();
	res.status(200).json({ status: "success", data: users, count: users.length });
});

exports.inviteUser = asyncHandler(async (req, res) => {
	const email = String(req.body.email || "").trim().toLowerCase();
	const fullname = String(req.body.fullname || "").trim();
	const role = String(req.body.role || "editor").trim();
	if (!email || !fullname || !roles.includes(role)) return res.status(400).json({ status: "fail", message: "fullname, email and a valid role are required" });
	if (await User.findOne({ email, status: { $ne: "suspended" } })) return res.status(409).json({ status: "fail", message: "An account with this email already exists" });

	const token = crypto.randomBytes(32).toString("hex");
	const invite = await UserInvite.create({ email, fullname, role, tokenHash: hashToken(token), invitedBy: req.user._id, expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000) });
	const placeholderPassword = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 12);
	await User.findOneAndUpdate({ email }, { fullname, email, role, status: "invited", password: placeholderPassword, invitedBy: req.user._id }, { upsert: true, new: true, setDefaultsOnInsert: true });
	await recordAudit({ req, action: "invite", resource: "user", resourceId: invite._id, metadata: { email, role } });

	const inviteUrl = `${process.env.FRONTEND_URL || process.env.frontendURL || "http://localhost:5173"}/admin/accept-invite?token=${token}`;
	await sendAdminInvite({ email, fullname, role, inviteUrl });
	if (process.env.NODE_ENV !== "production") console.log(`Admin invite URL for development: ${inviteUrl}`);
	res.status(201).json({ status: "success", message: "Invitation created", data: { email, role, expiresAt: invite.expiresAt, ...(process.env.NODE_ENV !== "production" ? { inviteUrl } : {}) } });
});

exports.updateUser = asyncHandler(async (req, res) => {
	const user = await User.findById(req.params.id);
	if (!user) return res.status(404).json({ status: "fail", message: "User not found" });
	if (String(user._id) === String(req.user._id) && req.body.status === "suspended") return res.status(400).json({ status: "fail", message: "You cannot suspend your own account" });
	if (req.body.role !== undefined && !roles.includes(req.body.role)) return res.status(400).json({ status: "fail", message: "Invalid role" });
	if (req.body.status !== undefined && !["active", "invited", "suspended"].includes(req.body.status)) return res.status(400).json({ status: "fail", message: "Invalid status" });
	if (req.body.fullname !== undefined) user.fullname = String(req.body.fullname).trim();
	if (req.body.role !== undefined) user.role = req.body.role;
	if (req.body.status !== undefined) user.status = req.body.status;
	await user.save();
	await recordAudit({ req, action: "update", resource: "user", resourceId: user._id, metadata: { role: user.role, status: user.status } });
	res.status(200).json({ status: "success", data: sanitizeUser(user) });
});

exports.resendInvite = asyncHandler(async (req, res) => {
	const user = await User.findById(req.params.id);
	if (!user || user.status !== "invited") return res.status(404).json({ status: "fail", message: "Pending invitation not found" });
	const token = crypto.randomBytes(32).toString("hex");
	await UserInvite.updateMany({ email: user.email, acceptedAt: null }, { acceptedAt: new Date() });
	const invite = await UserInvite.create({ email: user.email, fullname: user.fullname, role: user.role, tokenHash: hashToken(token), invitedBy: req.user._id, expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000) });
	await recordAudit({ req, action: "resend_invite", resource: "user", resourceId: user._id });
	const inviteUrl = `${process.env.FRONTEND_URL || process.env.frontendURL || "http://localhost:5173"}/admin/accept-invite?token=${token}`;
	await sendAdminInvite({ email: user.email, fullname: user.fullname, role: user.role, inviteUrl });
	res.status(200).json({ status: "success", data: { expiresAt: invite.expiresAt, ...(process.env.NODE_ENV !== "production" ? { inviteUrl } : {}) } });
});

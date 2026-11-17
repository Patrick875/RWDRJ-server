const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const User = require("../models/userModel");
const UserInvite = require("../models/userInvite");
const asyncHandler = require("../utils/asyncHandler");
const { sanitizeUser } = require("../utils/auth");
const { recordAudit } = require("../middleware/audit");
const { sendAdminInvite } = require("../utils/sendAdminInvite");

const { ROLES: roles, normalizeModules } = require("../utils/modules");
const { isFirebaseConfigured } = require("../firebase/admin");
const { syncUserClaims } = require("../services/firebaseClaims");

// Keep Firebase claims in step with Mongo. Firebase being down must not block user admin,
// so failures are logged and reported back; the next login/token request re-syncs.
const syncClaimsSafely = async (user, options) => {
	if (!isFirebaseConfigured()) return { synced: false, reason: "firebase_not_configured" };
	try {
		await syncUserClaims(user, options);
		return { synced: true };
	} catch (error) {
		console.error("firebase_claims_sync_failed", { userId: String(user._id), message: error.message });
		return { synced: false, reason: "firebase_sync_failed" };
	}
};

const PASSWORD_MIN = 10;
const validPassword = (value) => typeof value === "string" && value.length >= PASSWORD_MIN && /[A-Za-z]/.test(value) && /\d/.test(value);
const generatePassword = () => `${crypto.randomBytes(9).toString("base64url")}9a`;
const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

exports.listUsers = asyncHandler(async (req, res) => {
	const users = await User.find().select("-password -resetPasswordToken -resetPasswordExpiresAt").sort({ createdAt: -1 }).lean();
	res.status(200).json({ status: "success", data: users, count: users.length });
});

exports.inviteUser = asyncHandler(async (req, res) => {
	const email = String(req.body.email || "").trim().toLowerCase();
	const fullname = String(req.body.fullname || "").trim();
	const role = String(req.body.role || "editor").trim();
	const modules = normalizeModules(req.body.modules);
	if (!email || !fullname || !roles.includes(role)) return res.status(400).json({ status: "fail", message: "fullname, email and a valid role are required" });
	if (await User.findOne({ email, status: { $ne: "suspended" } })) return res.status(409).json({ status: "fail", message: "An account with this email already exists" });

	const token = crypto.randomBytes(32).toString("hex");
	const invite = await UserInvite.create({ email, fullname, role, tokenHash: hashToken(token), invitedBy: req.user._id, expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000) });
	const placeholderPassword = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 12);
	await User.findOneAndUpdate({ email }, { fullname, email, role, modules, status: "invited", password: placeholderPassword, invitedBy: req.user._id }, { upsert: true, new: true, setDefaultsOnInsert: true });
	await recordAudit({ req, action: "invite", resource: "user", resourceId: invite._id, metadata: { email, role } });

	const inviteUrl = `${process.env.FRONTEND_URL || process.env.frontendURL || "http://localhost:5173"}/admin/accept-invite?token=${token}`;
	await sendAdminInvite({ email, fullname, role, inviteUrl });
	if (process.env.NODE_ENV !== "production") console.log(`Admin invite URL for development: ${inviteUrl}`);
	res.status(201).json({ status: "success", message: "Invitation created", data: { email, role, expiresAt: invite.expiresAt, ...(process.env.NODE_ENV !== "production" ? { inviteUrl } : {}) } });
});

exports.updateUser = asyncHandler(async (req, res) => {
	const user = await User.findById(req.params.id);
	if (!user) return res.status(404).json({ status: "fail", message: "User not found" });
	const isSelf = String(user._id) === String(req.user._id);
	if (isSelf && req.body.status === "suspended") return res.status(400).json({ status: "fail", message: "You cannot suspend your own account" });
	if (isSelf && req.body.role !== undefined && req.body.role !== "administrator") return res.status(400).json({ status: "fail", message: "You cannot remove your own administrator role" });
	if (req.body.role !== undefined && !roles.includes(req.body.role)) return res.status(400).json({ status: "fail", message: "Invalid role" });
	if (req.body.status !== undefined && !["active", "invited", "suspended"].includes(req.body.status)) return res.status(400).json({ status: "fail", message: "Invalid status" });
	if (req.body.modules !== undefined && !Array.isArray(req.body.modules)) return res.status(400).json({ status: "fail", message: "modules must be an array" });

	const before = { role: user.role, status: user.status, modules: [...(user.modules || [])] };
	if (req.body.fullname !== undefined) user.fullname = String(req.body.fullname).trim();
	if (req.body.role !== undefined) user.role = req.body.role;
	if (req.body.status !== undefined) user.status = req.body.status;
	if (req.body.modules !== undefined) user.modules = normalizeModules(req.body.modules);

	const accessChanged = before.role !== user.role || before.status !== user.status || before.modules.join() !== (user.modules || []).join();
	// Shrinking access (role change, suspension, removed module) revokes open Firebase sessions.
	const accessShrunk = before.role !== user.role || user.status !== "active" || before.modules.some((m) => !(user.modules || []).includes(m));
	if (accessChanged) user.claimsVersion = Number(user.claimsVersion || 0) + 1;
	await user.save();
	const firebase = accessChanged ? await syncClaimsSafely(user, { revoke: accessShrunk }) : { synced: true };
	await recordAudit({ req, action: "update", resource: "user", resourceId: user._id, metadata: { role: user.role, status: user.status, modules: user.modules } });
	res.status(200).json({ status: "success", data: sanitizeUser(user), firebase });
});

/** Admin creates an active account directly (alternative to the invite flow). */
exports.createUser = asyncHandler(async (req, res) => {
	const email = String(req.body.email || "").trim().toLowerCase();
	const fullname = String(req.body.fullname || "").trim();
	const role = String(req.body.role || "editor");
	if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !fullname || !roles.includes(role)) return res.status(400).json({ status: "fail", message: "fullname, a valid email and a valid role are required" });
	if (req.body.password !== undefined && !validPassword(req.body.password)) return res.status(400).json({ status: "fail", message: `Password must be at least ${PASSWORD_MIN} characters with letters and numbers` });
	if (await User.findOne({ email })) return res.status(409).json({ status: "fail", message: "An account with this email already exists" });
	const temporaryPassword = req.body.password ? null : generatePassword();
	const user = await User.create({
		fullname,
		email,
		role,
		status: "active",
		modules: normalizeModules(req.body.modules),
		password: await bcrypt.hash(req.body.password || temporaryPassword, 12),
		invitedBy: req.user._id,
	});
	const firebase = await syncClaimsSafely(user);
	await recordAudit({ req, action: "create", resource: "user", resourceId: user._id, metadata: { email, role, modules: user.modules } });
	res.status(201).json({ status: "success", data: sanitizeUser(user), temporaryPassword, firebase });
});

/** Admin resets a password. Returns a generated one once if none is supplied. Revokes Firebase sessions. */
exports.resetUserPassword = asyncHandler(async (req, res) => {
	const user = await User.findById(req.params.id);
	if (!user) return res.status(404).json({ status: "fail", message: "User not found" });
	if (req.body.password !== undefined && !validPassword(req.body.password)) return res.status(400).json({ status: "fail", message: `Password must be at least ${PASSWORD_MIN} characters with letters and numbers` });
	const temporaryPassword = req.body.password ? null : generatePassword();
	user.password = await bcrypt.hash(req.body.password || temporaryPassword, 12);
	user.resetPasswordToken = undefined;
	user.resetPasswordExpiresAt = undefined;
	user.claimsVersion = Number(user.claimsVersion || 0) + 1;
	await user.save();
	const firebase = await syncClaimsSafely(user, { revoke: true });
	await recordAudit({ req, action: "reset_password", resource: "user", resourceId: user._id });
	res.status(200).json({ status: "success", temporaryPassword, firebase });
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

//jshint esversion:9
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
	{
		fullname: {
			type: String,
			trim: true,
			required: [true, "a user must have a name"],
		},
		email: {
			type: String,
			trim: true,
			lowercase: true,
			unique: [true, "account already exists"],
			required: [true, "user must provide an email"],
		},
		password: {
			type: String,
			required: [true, "user must provide a password"],
			select: false,
			minLength: 8,
		},
		role: {
			type: String,
			enum: ["administrator", "publisher", "editor", "viewer"],
			default: "editor",
			index: true,
		},
		status: {
			type: String,
			enum: ["active", "invited", "suspended"],
			default: "active",
			index: true,
		},
		// CMS modules this user may manage (administrators implicitly get all). See utils/modules.js.
		modules: { type: [String], default: [] },
		// Bumped whenever role/modules/status change so clients know to refresh Firebase claims.
		claimsVersion: { type: Number, default: 0 },
		emailVerified: { type: Boolean, default: false },
		lastLoginAt: Date,
		invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
		resetPasswordToken: String,
		resetPasswordExpiresAt: Date,
	},
	{ timestamps: true }
);

const User = new mongoose.model("User", userSchema);

module.exports = User;

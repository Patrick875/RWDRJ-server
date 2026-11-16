const mongoose = require("mongoose");

const userInviteSchema = new mongoose.Schema(
	{
		email: { type: String, required: true, trim: true, lowercase: true, index: true },
		fullname: { type: String, required: true, trim: true },
		role: {
			type: String,
			enum: ["administrator", "publisher", "editor", "viewer"],
			default: "editor",
		},
		tokenHash: { type: String, required: true, unique: true },
		invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
		expiresAt: { type: Date, required: true, index: true },
		acceptedAt: Date,
	},
	{ timestamps: true }
);

module.exports = mongoose.model("UserInvite", userInviteSchema);

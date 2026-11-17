const mongoose = require("mongoose");

const redirectSchema = new mongoose.Schema(
	{
		from: { type: String, required: true, trim: true, unique: true },
		to: { type: String, required: true, trim: true },
		statusCode: { type: Number, enum: [301, 302], default: 301 },
		active: { type: Boolean, default: true },
		createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
		updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
	},
	{ timestamps: true },
);

module.exports = mongoose.model("Redirect", redirectSchema);

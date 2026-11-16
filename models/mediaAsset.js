const mongoose = require("mongoose");

const mediaAssetSchema = new mongoose.Schema(
	{
		url: { type: String, required: true, trim: true },
		publicId: { type: String, trim: true },
		resourceType: { type: String, enum: ["image", "video", "raw"], default: "image" },
		alt: { type: String, trim: true },
		caption: { type: String, trim: true },
		folder: { type: String, trim: true },
		mimeType: { type: String, trim: true },
		bytes: { type: Number, min: 0 },
		width: { type: Number, min: 0 },
		height: { type: Number, min: 0 },
		uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
	},
	{ timestamps: true }
);

module.exports = mongoose.model("MediaAsset", mediaAssetSchema);

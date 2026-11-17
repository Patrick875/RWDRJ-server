const mongoose = require("mongoose");

const locationSchema = new mongoose.Schema(
	{
		label: { type: String, required: true, trim: true },
		address: { type: String, required: true, trim: true },
		latitude: { type: Number, min: -90, max: 90 },
		longitude: { type: Number, min: -180, max: 180 },
		embedUrl: { type: String, trim: true },
		placeId: { type: String, trim: true },
		zoom: { type: Number, min: 1, max: 22, default: 14 },
		mapHeight: { type: Number, min: 160, max: 1200, default: 360 },
		markerTitle: { type: String, trim: true },
		phoneNumbers: [{ type: String, trim: true }],
		emails: [{ type: String, trim: true, lowercase: true }],
		openingHours: [{ day: { type: String, trim: true }, hours: { type: String, trim: true } }],
		directionsUrl: { type: String, trim: true },
		visible: { type: Boolean, default: true },
		createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
		updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
	},
	{ timestamps: true },
);

locationSchema.index({ visible: 1, updatedAt: -1 });

module.exports = mongoose.model("Location", locationSchema);

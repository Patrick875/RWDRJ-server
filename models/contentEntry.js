const mongoose = require("mongoose");

const contentEntrySchema = new mongoose.Schema(
	{
		type: {
			type: String,
			enum: ["news", "publication", "event", "impact_story", "report", "resource"],
			required: true,
			index: true,
		},
		title: { type: String, required: true, trim: true },
		slug: {
			type: String,
			required: true,
			trim: true,
			lowercase: true,
			unique: true,
		},
		excerpt: { type: String, trim: true, maxlength: 500 },
		content: { type: String, trim: true },
		coverImage: { type: String, trim: true },
		gallery: [
			{
				url: { type: String, trim: true },
				alt: { type: String, trim: true },
				caption: { type: String, trim: true },
			},
		],
		file: {
			url: { type: String, trim: true },
			name: { type: String, trim: true },
			mimeType: { type: String, trim: true },
		},
		author: { type: String, trim: true },
		category: { type: String, trim: true },
		year: { type: Number, min: 1900, max: 2200 },
		date: Date,
		startDate: Date,
		endDate: Date,
		location: { type: String, trim: true },
		status: {
			type: String,
			enum: ["draft", "published", "archived"],
			default: "draft",
			index: true,
		},
		revision: { type: Number, default: 0, min: 0 },
		seo: {
			title: { type: String, trim: true, maxlength: 70 },
			description: { type: String, trim: true, maxlength: 160 },
		},
		createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
		updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
		publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
		publishedAt: Date,
	},
	{ timestamps: true }
);

contentEntrySchema.index({ type: 1, status: 1, date: -1 });

module.exports = mongoose.model("ContentEntry", contentEntrySchema);

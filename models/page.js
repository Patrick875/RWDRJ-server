const mongoose = require("mongoose");

const pageSectionSchema = new mongoose.Schema(
	{
		id: { type: String, required: true, trim: true },
		type: { type: String, required: true, trim: true },
		label: { type: String, trim: true },
		version: { type: Number, default: 1, min: 1 },
		order: { type: Number, required: true, default: 0 },
		visible: { type: Boolean, default: true },
		data: { type: mongoose.Schema.Types.Mixed, default: {} },
		style: { type: mongoose.Schema.Types.Mixed, default: {} },
		responsive: { type: mongoose.Schema.Types.Mixed, default: {} },
	},
	{ _id: false }
);

const pageSchema = new mongoose.Schema(
	{
		title: { type: String, required: true, trim: true },
		template: { type: String, trim: true, default: "standard" },
		slug: {
			type: String,
			required: true,
			trim: true,
			lowercase: true,
			unique: true,
			match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
		},
		excerpt: { type: String, trim: true, maxlength: 500 },
		coverImage: { type: String, trim: true },
		status: {
			type: String,
			enum: ["draft", "published", "archived"],
			default: "draft",
			index: true,
		},
		seo: {
			title: { type: String, trim: true, maxlength: 70 },
			description: { type: String, trim: true, maxlength: 160 },
			image: { type: String, trim: true },
			canonicalUrl: { type: String, trim: true },
			noIndex: { type: Boolean, default: false },
		},
		sections: { type: [pageSectionSchema], default: [] },
		routeAliases: { type: [String], default: [] },
		themeOverrides: { type: mongoose.Schema.Types.Mixed, default: {} },
		revision: { type: Number, default: 0, min: 0 },
		publishedRevision: { type: Number, default: 0, min: 0 },
		publishedAt: Date,
		createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
		updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
		publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
	},
	{ timestamps: true }
);

pageSchema.index({ status: 1, updatedAt: -1 });

module.exports = mongoose.model("Page", pageSchema);

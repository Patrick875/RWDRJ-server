const mongoose = require("mongoose");

const siteSettingsSchema = new mongoose.Schema(
	{
		key: { type: String, default: "default", unique: true, immutable: true },
		organizationName: { type: String, trim: true },
		logo: { type: String, trim: true },
		tagline: { type: String, trim: true },
		description: { type: String, trim: true },
		contacts: {
			emails: [{ type: String, trim: true, lowercase: true }],
			phoneNumbers: [{ type: String, trim: true }],
			address: { type: String, trim: true },
			mapUrl: { type: String, trim: true },
			latitude: Number,
			longitude: Number,
		},
		socialLinks: [
			{
				platform: { type: String, trim: true },
				url: { type: String, trim: true },
			},
		],
		navigation: [
			{
				label: { type: String, trim: true },
				path: { type: String, trim: true },
				order: Number,
				visible: { type: Boolean, default: true },
			},
		],
		updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
	},
	{ timestamps: true }
);

module.exports = mongoose.model("SiteSettings", siteSettingsSchema);

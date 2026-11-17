const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
	{
		actor: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
		actorEmail: { type: String, trim: true, lowercase: true },
		action: { type: String, required: true, trim: true },
		resource: { type: String, required: true, trim: true },
		resourceId: { type: String, trim: true },
		metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
		ipAddress: { type: String, trim: true },
		userAgent: { type: String, trim: true },
		location: { city: String, region: String, country: String, countryCode: String },
		method: { type: String, trim: true },
		path: { type: String, trim: true },
		requestId: { type: String, trim: true },
	},
	{ timestamps: true }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

module.exports = mongoose.model("AuditLog", auditLogSchema);

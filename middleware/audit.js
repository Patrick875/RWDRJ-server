const AuditLog = require("../models/auditLog");

const recordAudit = async ({ req, action, resource, resourceId, metadata = {} }) => {
	try {
		await AuditLog.create({
			actor: req.user?._id,
			actorEmail: req.user?.email,
			action,
			resource,
			resourceId: resourceId ? String(resourceId) : undefined,
			metadata,
			ipAddress: req.ip,
			userAgent: req.get("user-agent"),
		});
	} catch (error) {
		console.error("audit_log_write_failed", { message: error.message, action, resource });
	}
};

module.exports = { recordAudit };

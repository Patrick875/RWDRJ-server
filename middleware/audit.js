const AuditLog = require("../models/auditLog");
const { clientIp, clientLocation } = require("../utils/clientInfo");

// `actor` overrides req.user (e.g. at login, before req.user exists).
const recordAudit = async ({ req, action, resource, resourceId, metadata = {}, actor }) => {
	const who = actor || req.user;
	try {
		await AuditLog.create({
			actor: who?._id,
			actorEmail: who?.email,
			action,
			resource,
			resourceId: resourceId ? String(resourceId) : undefined,
			metadata,
			ipAddress: clientIp(req),
			location: clientLocation(req),
			userAgent: req.get("user-agent"),
			method: req.method,
			path: req.originalUrl?.split("?")[0],
			requestId: req.requestId,
		});
	} catch (error) {
		console.error("audit_log_write_failed", { message: error.message, action, resource });
	}
};

module.exports = { recordAudit };

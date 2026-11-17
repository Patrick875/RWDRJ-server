/*
 * Request origin details for rate limiting and audit logs.
 * Netlify Functions give Express no socket address (req.ip is undefined there), so prefer Netlify's
 * client-IP header, then the first proxy hop, then req.ip.
 */
const clientIp = (req) =>
	req.get("x-nf-client-connection-ip") || String(req.get("x-forwarded-for") || "").split(",")[0].trim() || req.ip || undefined;

// Netlify adds `x-nf-geo` (base64 JSON) to function requests. Best effort; absent locally.
const clientLocation = (req) => {
	const raw = req.get("x-nf-geo");
	if (!raw) return undefined;
	try {
		const geo = JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
		const location = {
			city: geo.city || undefined,
			region: geo.subdivision?.name || undefined,
			country: geo.country?.name || undefined,
			countryCode: geo.country?.code || undefined,
		};
		return Object.values(location).some(Boolean) ? location : undefined;
	} catch {
		return undefined;
	}
};

module.exports = { clientIp, clientLocation };

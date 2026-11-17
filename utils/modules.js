// Single source of truth for CMS module permissions (mirrored in client/src/cms/modules.ts).
const MODULES = ["siteSettings", "pageText", "team", "partners", "publications", "gallery", "statistics", "impact", "jobs"];
const ROLES = ["administrator", "publisher", "editor", "viewer"];
const STAFF_ROLES = ROLES;

const normalizeModules = (value) => {
	const list = Array.isArray(value) ? value : [];
	return [...new Set(list.map(String).filter((m) => MODULES.includes(m)))];
};

// Administrators implicitly have every module.
const effectiveModules = (user) => (user.role === "administrator" ? [...MODULES] : normalizeModules(user.modules));

const buildClaims = (user) => {
	const modules = effectiveModules(user);
	return {
		staff: true,
		role: user.role,
		modules,
		m: `|${modules.join("|")}|`,
		cv: Number(user.claimsVersion || 0),
	};
};

module.exports = { MODULES, ROLES, STAFF_ROLES, normalizeModules, effectiveModules, buildClaims };

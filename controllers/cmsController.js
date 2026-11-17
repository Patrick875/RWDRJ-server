const crypto = require("crypto");
const Page = require("../models/page");
const ContentEntry = require("../models/contentEntry");
const SiteSettings = require("../models/siteSettings");
const asyncHandler = require("../utils/asyncHandler");
const { recordAudit } = require("../middleware/audit");

const entryTypes = ["news", "publication", "event", "impact_story", "report", "resource"];
const publisherRoles = new Set(["administrator", "publisher"]);

const slugify = (value) =>
	String(value || "")
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");

const pick = (body, fields) =>
	fields.reduce((result, field) => {
		if (body[field] !== undefined) result[field] = body[field];
		return result;
	}, {});

const normalizeSections = (sections = []) =>
	Array.isArray(sections)
		? sections.map((section, index) => ({
				id: section.id || crypto.randomUUID(),
				type: String(section.type || "rich_text").trim(),
				version: Math.max(Number(section.version) || 1, 1),
				label: section.label ? String(section.label).trim() : undefined,
				order: Number.isFinite(Number(section.order)) ? Number(section.order) : index,
				visible: section.visible !== false,
				data: section.data && typeof section.data === "object" ? section.data : {},
				style: section.style && typeof section.style === "object" ? section.style : {},
				responsive: section.responsive && typeof section.responsive === "object" ? section.responsive : {},
			}))
		: [];

exports.getPublicPage = asyncHandler(async (req, res) => {
	const page = await Page.findOne({ $or: [{ slug: req.params.slug }, { routeAliases: req.params.slug }], status: "published" }).lean();
	if (!page) return res.status(404).json({ status: "fail", message: "Page not found" });
	res.status(200).json({ status: "success", data: page });
});

exports.listPages = asyncHandler(async (req, res) => {
	const filter = req.user ? {} : { status: "published" };
	if (req.query.status) filter.status = req.query.status;
	const pages = await Page.find(filter).sort({ updatedAt: -1 }).lean();
	res.status(200).json({ status: "success", data: pages, count: pages.length });
});

exports.getPage = asyncHandler(async (req, res) => {
	const page = await Page.findById(req.params.id);
	if (!page) return res.status(404).json({ status: "fail", message: "Page not found" });
	res.status(200).json({ status: "success", data: page });
});

exports.createPage = asyncHandler(async (req, res) => {
	const title = String(req.body.title || "").trim();
	const slug = slugify(req.body.slug || title);
	if (!title || !slug) return res.status(400).json({ status: "fail", message: "title and slug are required" });

	if (req.body.status === "published" && !publisherRoles.has(req.user.role)) return res.status(403).json({ status: "fail", message: "Publishing permission required" });
	const page = await Page.create({
		...pick(req.body, ["title", "template", "excerpt", "coverImage", "seo", "status", "routeAliases", "themeOverrides"]),
		title,
		slug,
		sections: normalizeSections(req.body.sections),
		createdBy: req.user._id,
		updatedBy: req.user._id,
	});
	await recordAudit({ req, action: "create", resource: "page", resourceId: page._id });
	res.status(201).json({ status: "success", data: page });
});

exports.updatePage = asyncHandler(async (req, res) => {
	const page = await Page.findById(req.params.id);
	if (!page) return res.status(404).json({ status: "fail", message: "Page not found" });
	if (req.body.baseRevision !== undefined && Number(req.body.baseRevision) !== page.revision) {
		return res.status(409).json({ status: "fail", message: "Page was changed by another user", revision: page.revision });
	}
	if (req.body.status === "published" && !publisherRoles.has(req.user.role)) return res.status(403).json({ status: "fail", message: "Publishing permission required" });

	const updates = pick(req.body, ["title", "template", "excerpt", "coverImage", "seo", "status", "routeAliases", "themeOverrides"]);
	if (req.body.slug !== undefined) updates.slug = slugify(req.body.slug);
	if (req.body.sections !== undefined) updates.sections = normalizeSections(req.body.sections);
	Object.assign(page, updates);
	page.revision += 1;
	page.updatedBy = req.user._id;
	await page.save();
	await recordAudit({ req, action: "update", resource: "page", resourceId: page._id, metadata: { revision: page.revision } });
	res.status(200).json({ status: "success", data: page });
});

exports.publishPage = asyncHandler(async (req, res) => {
	const page = await Page.findById(req.params.id);
	if (!page) return res.status(404).json({ status: "fail", message: "Page not found" });
	page.status = "published";
	page.publishedRevision = page.revision;
	page.publishedAt = new Date();
	page.publishedBy = req.user._id;
	await page.save();
	await recordAudit({ req, action: "publish", resource: "page", resourceId: page._id });
	res.status(200).json({ status: "success", data: page });
});

exports.deletePage = asyncHandler(async (req, res) => {
	const page = await Page.findByIdAndDelete(req.params.id);
	if (!page) return res.status(404).json({ status: "fail", message: "Page not found" });
	await recordAudit({ req, action: "delete", resource: "page", resourceId: page._id, metadata: { slug: page.slug } });
	res.status(200).json({ status: "success", message: "Page removed" });
});

exports.listEntries = asyncHandler(async (req, res) => {
	const filter = { status: "published" };
	if (req.user) {
		delete filter.status;
		if (req.query.status) filter.status = req.query.status;
	}
	if (req.query.type) {
		if (!entryTypes.includes(req.query.type)) return res.status(400).json({ status: "fail", message: "Invalid content type" });
		filter.type = req.query.type;
	}
	const entries = await ContentEntry.find(filter).sort({ date: -1, createdAt: -1 }).lean();
	res.status(200).json({ status: "success", data: entries, count: entries.length });
});

exports.getAdminEntry = asyncHandler(async (req, res) => {
	const entry = await ContentEntry.findById(req.params.id).lean();
	if (!entry) return res.status(404).json({ status: "fail", message: "Content entry not found" });
	res.status(200).json({ status: "success", data: entry });
});

exports.getEntry = asyncHandler(async (req, res) => {
	const filter = { slug: req.params.slug };
	if (!req.user) filter.status = "published";
	const entry = await ContentEntry.findOne(filter).lean();
	if (!entry) return res.status(404).json({ status: "fail", message: "Content entry not found" });
	res.status(200).json({ status: "success", data: entry });
});

exports.createEntry = asyncHandler(async (req, res) => {
	const title = String(req.body.title || "").trim();
	const type = String(req.body.type || "").trim();
	const slug = slugify(req.body.slug || title);
	if (!title || !slug || !entryTypes.includes(type)) {
		return res.status(400).json({ status: "fail", message: "title, slug and a valid type are required" });
	}
	if (req.body.status === "published" && !publisherRoles.has(req.user.role)) return res.status(403).json({ status: "fail", message: "Publishing permission required" });
	const entry = await ContentEntry.create({
		...pick(req.body, ["excerpt", "content", "coverImage", "gallery", "file", "author", "category", "year", "date", "startDate", "endDate", "location", "seo", "status"]),
		title,
		type,
		slug,
		createdBy: req.user._id,
		updatedBy: req.user._id,
	});
	await recordAudit({ req, action: "create", resource: "content_entry", resourceId: entry._id, metadata: { type } });
	res.status(201).json({ status: "success", data: entry });
});

exports.updateEntry = asyncHandler(async (req, res) => {
	const entry = await ContentEntry.findById(req.params.id);
	if (!entry) return res.status(404).json({ status: "fail", message: "Content entry not found" });
	if (req.body.baseRevision !== undefined && Number(req.body.baseRevision) !== entry.revision) {
		return res.status(409).json({ status: "fail", message: "Content was changed by another user", revision: entry.revision });
	}
	if (req.body.status === "published" && !publisherRoles.has(req.user.role)) return res.status(403).json({ status: "fail", message: "Publishing permission required" });
	Object.assign(entry, pick(req.body, ["title", "type", "excerpt", "content", "coverImage", "gallery", "file", "author", "category", "year", "date", "startDate", "endDate", "location", "seo", "status"]));
	if (req.body.slug !== undefined) entry.slug = slugify(req.body.slug);
	entry.revision += 1;
	entry.updatedBy = req.user._id;
	await entry.save();
	await recordAudit({ req, action: "update", resource: "content_entry", resourceId: entry._id, metadata: { revision: entry.revision } });
	res.status(200).json({ status: "success", data: entry });
});

exports.publishEntry = asyncHandler(async (req, res) => {
	const entry = await ContentEntry.findById(req.params.id);
	if (!entry) return res.status(404).json({ status: "fail", message: "Content entry not found" });
	entry.status = "published";
	entry.publishedAt = new Date();
	entry.publishedBy = req.user._id;
	await entry.save();
	await recordAudit({ req, action: "publish", resource: "content_entry", resourceId: entry._id, metadata: { type: entry.type } });
	res.status(200).json({ status: "success", data: entry });
});

exports.getSettings = asyncHandler(async (req, res) => {
	const settings = await SiteSettings.findOne({ key: "default" }).populate("locations").lean();
	res.status(200).json({ status: "success", data: settings });
});

exports.updateSettings = asyncHandler(async (req, res) => {
	const updates = pick(req.body, ["organizationName", "logo", "tagline", "description", "contacts", "socialLinks", "navigation", "announcementBar", "header", "footer", "designTokens", "locations"]);
	const settings = await SiteSettings.findOneAndUpdate(
		{ key: "default" },
		{ $set: { ...updates, updatedBy: req.user._id } },
		{ upsert: true, new: true, runValidators: true }
	);
	await recordAudit({ req, action: "update", resource: "site_settings", resourceId: settings._id });
	res.status(200).json({ status: "success", data: settings });
});

exports.getAuditLogs = asyncHandler(async (req, res) => {
	const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
	const filter = {};
	if (req.query.action) filter.action = String(req.query.action);
	if (req.query.actor) filter.actorEmail = { $regex: String(req.query.actor).slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
	const before = req.query.before ? new Date(String(req.query.before)) : null;
	if (before && !Number.isNaN(before.getTime())) filter.createdAt = { $lt: before };
	const logs = await require("../models/auditLog").find(filter).sort({ createdAt: -1 }).limit(limit + 1).lean();
	const hasMore = logs.length > limit;
	const page = hasMore ? logs.slice(0, limit) : logs;
	res.status(200).json({ status: "success", data: page, count: page.length, nextCursor: hasMore ? page[page.length - 1].createdAt : null });
});

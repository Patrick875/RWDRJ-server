const MediaAsset = require("../models/mediaAsset");
const asyncHandler = require("../utils/asyncHandler");
const { recordAudit } = require("../middleware/audit");
const cloudinary = require("cloudinary").v2;

exports.list = asyncHandler(async (req, res) => {
	const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
	const assets = await MediaAsset.find().sort({ createdAt: -1 }).limit(limit).lean();
	res.status(200).json({ status: "success", data: assets, count: assets.length });
});

exports.create = asyncHandler(async (req, res) => {
	if (!req.body.url) return res.status(400).json({ status: "fail", message: "url is required" });
	const asset = await MediaAsset.create({
		url: req.body.url,
		publicId: req.body.publicId,
		resourceType: req.body.resourceType,
		alt: req.body.alt,
		caption: req.body.caption,
		folder: req.body.folder,
		mimeType: req.body.mimeType,
		bytes: req.body.bytes,
		width: req.body.width,
		height: req.body.height,
		uploadedBy: req.user._id,
	});
	await recordAudit({ req, action: "create", resource: "media_asset", resourceId: asset._id });
	res.status(201).json({ status: "success", data: asset });
});

exports.upload = asyncHandler(async (req, res) => {
	const source = String(req.body.source || "");
	if (!/^data:(image|video|application\/pdf)\/[a-z0-9.+-]+;base64,/i.test(source)) return res.status(400).json({ status: "fail", message: "source must be a supported base64 data URL" });
	if (source.length > 8 * 1024 * 1024) return res.status(413).json({ status: "fail", message: "Media file is too large" });
	const result = await cloudinary.uploader.upload(source, { folder: "rwdrj-cms", resource_type: "auto" });
	const asset = await MediaAsset.create({ url: result.secure_url, publicId: result.public_id, resourceType: result.resource_type === "raw" ? "raw" : result.resource_type, mimeType: req.body.mimeType, bytes: req.body.bytes, width: result.width, height: result.height, alt: req.body.alt, caption: req.body.caption, uploadedBy: req.user._id });
	await recordAudit({ req, action: "upload", resource: "media_asset", resourceId: asset._id });
	res.status(201).json({ status: "success", data: asset });
});

exports.remove = asyncHandler(async (req, res) => {
	const asset = await MediaAsset.findByIdAndDelete(req.params.id);
	if (!asset) return res.status(404).json({ status: "fail", message: "Media asset not found" });
	await recordAudit({ req, action: "delete", resource: "media_asset", resourceId: asset._id, metadata: { url: asset.url } });
	res.status(200).json({ status: "success", message: "Media asset removed" });
});

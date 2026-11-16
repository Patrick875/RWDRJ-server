const MediaAsset = require("../models/mediaAsset");
const asyncHandler = require("../utils/asyncHandler");
const { recordAudit } = require("../middleware/audit");

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

exports.remove = asyncHandler(async (req, res) => {
	const asset = await MediaAsset.findByIdAndDelete(req.params.id);
	if (!asset) return res.status(404).json({ status: "fail", message: "Media asset not found" });
	await recordAudit({ req, action: "delete", resource: "media_asset", resourceId: asset._id, metadata: { url: asset.url } });
	res.status(200).json({ status: "success", message: "Media asset removed" });
});

const Location = require("../models/location");
const asyncHandler = require("../utils/asyncHandler");
const { recordAudit } = require("../middleware/audit");

const allowedMapHosts = new Set(["www.google.com", "maps.google.com", "google.com"]);
const isAllowedMapUrl = (value) => {
	if (!value) return true;
	try {
		const url = new URL(value);
		return url.protocol === "https:" && allowedMapHosts.has(url.hostname);
	} catch {
		return false;
	}
};

const validateLocation = (body) => {
	if (body.embedUrl && !isAllowedMapUrl(body.embedUrl)) return "embedUrl must be a secure Google Maps URL";
	if (body.directionsUrl && !isAllowedMapUrl(body.directionsUrl)) return "directionsUrl must be a secure Google Maps URL";
	if (body.latitude !== undefined && (Number(body.latitude) < -90 || Number(body.latitude) > 90)) return "latitude is invalid";
	if (body.longitude !== undefined && (Number(body.longitude) < -180 || Number(body.longitude) > 180)) return "longitude is invalid";
	return null;
};

exports.listPublic = asyncHandler(async (req, res) => {
	const locations = await Location.find({ visible: true }).sort({ createdAt: 1 }).lean();
	res.status(200).json({ status: "success", data: locations, count: locations.length });
});

exports.list = asyncHandler(async (req, res) => {
	const locations = await Location.find().sort({ createdAt: 1 }).lean();
	res.status(200).json({ status: "success", data: locations, count: locations.length });
});

exports.create = asyncHandler(async (req, res) => {
	const error = validateLocation(req.body);
	if (error || !req.body.label || !req.body.address) return res.status(400).json({ status: "fail", message: error || "label and address are required" });
	const location = await Location.create({ ...req.body, createdBy: req.user._id, updatedBy: req.user._id });
	await recordAudit({ req, action: "create", resource: "location", resourceId: location._id });
	res.status(201).json({ status: "success", data: location });
});

exports.update = asyncHandler(async (req, res) => {
	const error = validateLocation(req.body);
	if (error) return res.status(400).json({ status: "fail", message: error });
	const location = await Location.findByIdAndUpdate(req.params.id, { ...req.body, updatedBy: req.user._id }, { new: true, runValidators: true });
	if (!location) return res.status(404).json({ status: "fail", message: "Location not found" });
	await recordAudit({ req, action: "update", resource: "location", resourceId: location._id });
	res.status(200).json({ status: "success", data: location });
});

exports.remove = asyncHandler(async (req, res) => {
	const location = await Location.findByIdAndDelete(req.params.id);
	if (!location) return res.status(404).json({ status: "fail", message: "Location not found" });
	await recordAudit({ req, action: "delete", resource: "location", resourceId: location._id });
	res.status(200).json({ status: "success", message: "Location removed" });
});

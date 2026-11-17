/*
 * Multipart uploads for the CMS. Files go to Cloudinary (existing storage for this site)
 * or, with UPLOAD_DRIVER=local (dev/tests), to server/uploads served at /uploads.
 * Only the resulting URL (+ name/size/mime) is returned; the client stores it in RTDB.
 */
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const asyncHandler = require("../utils/asyncHandler");
const { POLICIES, validateUpload } = require("../utils/uploadPolicy");
const { recordAudit } = require("../middleware/audit");

const LOCAL_DIR = path.join(__dirname, "..", "uploads");
const maxBytes = Math.max(...Object.values(POLICIES).map((p) => p.maxBytes));

const receive = multer({ storage: multer.memoryStorage(), limits: { fileSize: maxBytes, files: 1 } }).single("file");

const driver = () => {
	if (process.env.UPLOAD_DRIVER) return process.env.UPLOAD_DRIVER;
	return process.env.CLOUDINARY_API_KEY ? "cloudinary" : "local";
};

const storeLocal = async (buffer, ext, req) => {
	await fs.mkdir(LOCAL_DIR, { recursive: true });
	const name = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${ext}`;
	await fs.writeFile(path.join(LOCAL_DIR, name), buffer);
	const base = process.env.PUBLIC_SERVER_URL || `${req.protocol}://${req.get("host")}`;
	return `${base.replace(/\/$/, "")}/uploads/${name}`;
};

const storeCloudinary = (buffer, kind) =>
	new Promise((resolve, reject) => {
		const stream = cloudinary.uploader.upload_stream(
			{ folder: `rwdrj-cms/${kind}`, resource_type: kind === "image" ? "image" : kind === "video" ? "video" : "raw" },
			(error, result) => (error ? reject(error) : resolve(result.secure_url)),
		);
		stream.end(buffer);
	});

exports.receive = (req, res, next) =>
	receive(req, res, (error) => {
		if (!error) return next();
		const tooBig = error.code === "LIMIT_FILE_SIZE";
		return res.status(tooBig ? 413 : 400).json({ status: "fail", message: tooBig ? "File is too large" : "Invalid upload" });
	});

exports.upload = asyncHandler(async (req, res) => {
	const kind = String(req.body.kind || "image");
	if (!req.file) return res.status(400).json({ status: "fail", message: "file is required" });
	const verdict = validateUpload({ kind, ...req.file });
	if (!verdict.ok) return res.status(verdict.status).json({ status: "fail", message: verdict.message });

	const url = driver() === "local" ? await storeLocal(req.file.buffer, verdict.ext, req) : await storeCloudinary(req.file.buffer, kind);
	const data = { url, name: path.basename(req.file.originalname).slice(0, 200), size: req.file.size, mime: req.file.mimetype, kind };
	await recordAudit({ req, action: "upload", resource: "cms_file", metadata: { kind, size: data.size, mime: data.mime } });
	res.status(201).json({ status: "success", data });
});

exports.LOCAL_DIR = LOCAL_DIR;

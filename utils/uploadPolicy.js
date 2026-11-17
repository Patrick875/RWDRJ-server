/*
 * What each upload kind may contain. Checked against declared MIME, file extension
 * AND the file's leading bytes, so a renamed .html can't pass as an image.
 */
const MB = 1024 * 1024;

const POLICIES = {
	image: { maxBytes: 5 * MB, types: { "image/jpeg": ["jpg", "jpeg"], "image/png": ["png"], "image/webp": ["webp"], "image/gif": ["gif"], "image/x-icon": ["ico"], "image/vnd.microsoft.icon": ["ico"] } },
	document: { maxBytes: 20 * MB, types: { "application/pdf": ["pdf"], "application/msword": ["doc"], "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ["docx"] } },
	data: { maxBytes: 10 * MB, types: { "text/csv": ["csv"], "application/vnd.ms-excel": ["xls", "csv"], "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ["xlsx"] } },
	video: { maxBytes: 50 * MB, types: { "video/mp4": ["mp4"], "video/webm": ["webm"] } },
};

const startsWith = (buf, bytes, offset = 0) => bytes.every((b, i) => buf[offset + i] === b);

const sniff = (buf) => {
	if (!buf || buf.length < 4) return null;
	if (startsWith(buf, [0xff, 0xd8, 0xff])) return "jpg";
	if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47])) return "png";
	if (startsWith(buf, [0x47, 0x49, 0x46, 0x38])) return "gif";
	if (startsWith(buf, [0x52, 0x49, 0x46, 0x46]) && startsWith(buf, [0x57, 0x45, 0x42, 0x50], 8)) return "webp";
	if (startsWith(buf, [0x00, 0x00, 0x01, 0x00])) return "ico";
	if (startsWith(buf, [0x25, 0x50, 0x44, 0x46])) return "pdf";
	if (startsWith(buf, [0xd0, 0xcf, 0x11, 0xe0])) return "ole"; // doc/xls
	if (startsWith(buf, [0x50, 0x4b, 0x03, 0x04])) return "zip"; // docx/xlsx
	if (startsWith(buf, [0x1a, 0x45, 0xdf, 0xa3])) return "webm";
	if (buf.length > 8 && startsWith(buf, [0x66, 0x74, 0x79, 0x70], 4)) return "mp4";
	return null;
};

const SIGNATURE_FOR_EXT = { jpg: "jpg", jpeg: "jpg", png: "png", gif: "gif", webp: "webp", ico: "ico", pdf: "pdf", doc: "ole", xls: "ole", docx: "zip", xlsx: "zip", mp4: "mp4", webm: "webm" };

const looksLikeCsv = (buf) => {
	const head = buf.subarray(0, 4096).toString("utf8");
	return !head.includes("\u0000") && !/<\s*(script|html|svg|iframe)/i.test(head);
};

/** Returns { ok: true, ext } or { ok: false, status, message }. */
const validateUpload = ({ kind, originalname, mimetype, size, buffer }) => {
	const policy = POLICIES[kind];
	if (!policy) return { ok: false, status: 400, message: "Unknown upload kind" };
	if (!buffer || !size) return { ok: false, status: 400, message: "File is empty" };
	if (size > policy.maxBytes) return { ok: false, status: 413, message: `File is too large (max ${Math.round(policy.maxBytes / MB)} MB)` };
	const ext = String(originalname || "").toLowerCase().split(".").pop();
	const allowedExts = policy.types[mimetype];
	if (!allowedExts || !allowedExts.includes(ext)) return { ok: false, status: 415, message: "File type is not allowed" };
	if (ext === "csv") return looksLikeCsv(buffer) ? { ok: true, ext } : { ok: false, status: 415, message: "File content does not match its type" };
	if (sniff(buffer) !== SIGNATURE_FOR_EXT[ext]) return { ok: false, status: 415, message: "File content does not match its type" };
	return { ok: true, ext };
};

module.exports = { POLICIES, validateUpload, sniff };

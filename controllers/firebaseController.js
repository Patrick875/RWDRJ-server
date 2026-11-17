const asyncHandler = require("../utils/asyncHandler");
const { isFirebaseConfigured } = require("../firebase/admin");
const { mintCustomToken } = require("../services/firebaseClaims");

/** POST /api/admin/firebase-token: exchange the Express session for a Firebase custom token. */
exports.issueToken = asyncHandler(async (req, res) => {
	if (!isFirebaseConfigured()) return res.status(503).json({ status: "fail", message: "Firebase is not configured on the server" });
	const { token, uid, claims } = await mintCustomToken(req.user);
	res.set("Cache-Control", "no-store");
	res.status(200).json({ status: "success", data: { token, uid, claims } });
});

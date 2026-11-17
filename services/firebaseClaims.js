/*
 * Mongo is the source of truth for users/roles/modules. Firebase Auth only mirrors
 * them as custom claims so RTDB rules can enforce per-module writes.
 */
const { getAuth } = require("../firebase/admin");
const { buildClaims } = require("../utils/modules");

const uidFor = (user) => `cms_${String(user._id)}`;

const ensureFirebaseUser = async (user) => {
	const auth = getAuth();
	const uid = uidFor(user);
	try {
		return await auth.getUser(uid);
	} catch (error) {
		if (error.code !== "auth/user-not-found") throw error;
		return auth.createUser({ uid, displayName: user.fullname, disabled: user.status !== "active" });
	}
};

/** Write claims + disabled flag. Set revoke=true when access shrinks so open sessions lose it fast. */
const syncUserClaims = async (user, { revoke = false } = {}) => {
	const auth = getAuth();
	const uid = uidFor(user);
	await ensureFirebaseUser(user);
	const claims = buildClaims(user);
	await auth.setCustomUserClaims(uid, claims);
	await auth.updateUser(uid, { disabled: user.status !== "active", displayName: user.fullname });
	if (revoke || user.status !== "active") await auth.revokeRefreshTokens(uid);
	return claims;
};

/** Claims live on the user record (set above), so the custom token itself carries none. */
const mintCustomToken = async (user) => {
	if (user.status !== "active") {
		const error = new Error("account_not_active");
		error.statusCode = 403;
		throw error;
	}
	const claims = await syncUserClaims(user);
	const token = await getAuth().createCustomToken(uidFor(user));
	return { token, uid: uidFor(user), claims };
};

module.exports = { uidFor, syncUserClaims, mintCustomToken };

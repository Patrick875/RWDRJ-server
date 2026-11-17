/*
 * firebase-admin bootstrap. Pattern adapted from ir-frontend `lib/firebase/admin.ts`
 * (lazy singleton app), but credentials come from env vars only:
 *   FIREBASE_SERVICE_ACCOUNT_JSON  service-account JSON (raw or base64)
 *   or FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY
 *   FIREBASE_DATABASE_URL           RTDB URL
 * With FIREBASE_AUTH_EMULATOR_HOST / FIREBASE_DATABASE_EMULATOR_HOST set, no credentials are needed.
 */
const admin = require("firebase-admin");

let app = null;

const usingEmulator = () => Boolean(process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.FIREBASE_DATABASE_EMULATOR_HOST);

const parseServiceAccount = () => {
	const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
	if (raw) {
		const text = raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
		return JSON.parse(text);
	}
	if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
		return {
			project_id: process.env.FIREBASE_PROJECT_ID,
			client_email: process.env.FIREBASE_CLIENT_EMAIL,
			private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
		};
	}
	return null;
};

const projectId = () => process.env.FIREBASE_PROJECT_ID || (usingEmulator() ? "demo-rwdrj" : undefined);

const databaseURL = () =>
	process.env.FIREBASE_DATABASE_URL ||
	(usingEmulator() ? `http://${process.env.FIREBASE_DATABASE_EMULATOR_HOST || "127.0.0.1:9000"}?ns=${projectId()}` : undefined);

const isFirebaseConfigured = () => usingEmulator() || Boolean(parseServiceAccount());

const getFirebaseApp = () => {
	if (app) return app;
	if (!isFirebaseConfigured()) {
		const error = new Error("firebase_not_configured");
		error.statusCode = 503;
		throw error;
	}
	const serviceAccount = parseServiceAccount();
	const options = { projectId: serviceAccount?.project_id || projectId(), databaseURL: databaseURL() };
	if (serviceAccount) options.credential = admin.credential.cert(serviceAccount);
	app = admin.apps.find((existing) => existing?.name === "rwdrj-cms") || admin.initializeApp(options, "rwdrj-cms");
	return app;
};

const getAuth = () => getFirebaseApp().auth();
const getDatabase = () => getFirebaseApp().database();

// Test helper.
const resetFirebaseApp = async () => {
	if (app) await app.delete();
	app = null;
};

module.exports = { getFirebaseApp, getAuth, getDatabase, isFirebaseConfigured, resetFirebaseApp };

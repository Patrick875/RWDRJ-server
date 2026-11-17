/*
 * Express auth -> Firebase custom token -> claims. Needs local MongoDB and the auth emulator
 * (run via `npm run test:all`). Uses a throwaway database.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");
const os = require("os");

process.env.JWT_SECRET = "test-secret-test-secret-test-secret-123";
process.env.NODE_ENV = "test";
process.env.UPLOAD_DRIVER = "local";
process.env.LOGIN_RATE_LIMIT = "1000";
process.env.LOCAL_DATABASE_URL = process.env.TEST_DATABASE_URL || "mongodb://127.0.0.1:27017/rwdrj_cms_test";
delete process.env.ONLINE_DATABASE_URL;

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { initializeApp, deleteApp } = require("firebase/app");
const { getAuth, connectAuthEmulator, signInWithCustomToken, signOut } = require("firebase/auth");
const app = require("../../app");
const { connectDatabase } = require("../../config/database");
const User = require("../../models/userModel");
const { resetFirebaseApp } = require("../../firebase/admin");

let server, base, clientApp, clientAuth;

const call = async (method, url, { token, body } = {}) => {
	const res = await fetch(`${base}${url}`, {
		method,
		headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
		body: body ? JSON.stringify(body) : undefined,
	});
	return { status: res.status, body: await res.json().catch(() => null) };
};
const login = (email, password) => call("POST", "/api/admin/login", { body: { email, password } });
const claimsOf = async (customToken) => {
	const cred = await signInWithCustomToken(clientAuth, customToken);
	const result = await cred.user.getIdTokenResult(true);
	await signOut(clientAuth);
	return result.claims;
};

test.before(async () => {
	if (!process.env.FIREBASE_AUTH_EMULATOR_HOST) throw new Error("run with the auth emulator: npm run test:all");
	await connectDatabase();
	await mongoose.connection.db.dropDatabase();
	await User.create([
		{ fullname: "Admin", email: "admin@test.rw", role: "administrator", status: "active", password: await bcrypt.hash("Admin12345", 4) },
		{ fullname: "Ed", email: "ed@test.rw", role: "editor", status: "active", modules: ["team"], password: await bcrypt.hash("Editor12345", 4) },
	]);
	server = app.listen(0);
	base = `http://127.0.0.1:${server.address().port}`;
	clientApp = initializeApp({ apiKey: "demo-key", projectId: "demo-rwdrj" }, "test-client");
	clientAuth = getAuth(clientApp);
	connectAuthEmulator(clientAuth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, { disableWarnings: true });
});

test.after(async () => {
	server?.close();
	await deleteApp(clientApp);
	await resetFirebaseApp();
	await mongoose.connection.db.dropDatabase();
	await mongoose.disconnect();
});

test("login returns a Firebase custom token whose claims mirror the Mongo user", async () => {
	const res = await login("ed@test.rw", "Editor12345");
	assert.equal(res.status, 200);
	assert.ok(res.body.firebaseToken);
	assert.deepEqual(res.body.user.modules, ["team"]);
	const claims = await claimsOf(res.body.firebaseToken);
	assert.equal(claims.role, "editor");
	assert.equal(claims.staff, true);
	assert.deepEqual(claims.modules, ["team"]);
	assert.equal(claims.m, "|team|");
});

test("admins get all modules in claims", async () => {
	const res = await login("admin@test.rw", "Admin12345");
	const claims = await claimsOf(res.body.firebaseToken);
	assert.equal(claims.role, "administrator");
	assert.equal(claims.modules.length, 9);
});

test("firebase-token endpoint requires an Express session", async () => {
	assert.equal((await call("POST", "/api/admin/firebase-token")).status, 401);
	const { body } = await login("ed@test.rw", "Editor12345");
	const res = await call("POST", "/api/admin/firebase-token", { token: body.token });
	assert.equal(res.status, 200);
	assert.ok(res.body.data.token);
});

test("changing a user's role/modules updates claims and bumps claimsVersion", async () => {
	const admin = (await login("admin@test.rw", "Admin12345")).body;
	const ed = await User.findOne({ email: "ed@test.rw" });
	const res = await call("PATCH", `/api/admin/users/${ed._id}`, { token: admin.token, body: { role: "publisher", modules: ["publications", "gallery", "nope"] } });
	assert.equal(res.status, 200);
	assert.deepEqual(res.body.data.modules, ["publications", "gallery"]);
	assert.equal(res.body.data.claimsVersion, 1);
	assert.equal(res.body.firebase.synced, true);
	const edLogin = (await login("ed@test.rw", "Editor12345")).body;
	const claims = await claimsOf(edLogin.firebaseToken);
	assert.equal(claims.role, "publisher");
	assert.equal(claims.m, "|publications|gallery|");
	assert.equal(claims.cv, 1);
});

test("non-admins cannot manage users", async () => {
	const ed = (await login("ed@test.rw", "Editor12345")).body;
	assert.equal((await call("GET", "/api/admin/users", { token: ed.token })).status, 403);
	assert.equal((await call("POST", "/api/admin/users", { token: ed.token, body: { fullname: "x", email: "x@y.rw", role: "administrator" } })).status, 403);
});

test("admin can create a user, reset a password, and disable a user", async () => {
	const admin = (await login("admin@test.rw", "Admin12345")).body;
	const created = await call("POST", "/api/admin/users", { token: admin.token, body: { fullname: "New", email: "new@test.rw", role: "editor", modules: ["partners"] } });
	assert.equal(created.status, 201);
	assert.ok(created.body.temporaryPassword);
	assert.equal((await login("new@test.rw", created.body.temporaryPassword)).status, 200);

	const reset = await call("POST", `/api/admin/users/${created.body.data._id}/reset-password`, { token: admin.token, body: { password: "Brandnew12345" } });
	assert.equal(reset.status, 200);
	assert.equal((await login("new@test.rw", created.body.temporaryPassword)).status, 401);
	const newLogin = (await login("new@test.rw", "Brandnew12345")).body;

	const disabled = await call("PATCH", `/api/admin/users/${created.body.data._id}`, { token: admin.token, body: { status: "suspended" } });
	assert.equal(disabled.status, 200);
	assert.equal((await login("new@test.rw", "Brandnew12345")).status, 401);
	assert.equal((await call("POST", "/api/admin/firebase-token", { token: newLogin.token })).status, 401);
	// The Firebase account is disabled too, so an old custom token can no longer sign in.
	await assert.rejects(signInWithCustomToken(clientAuth, newLogin.firebaseToken), /user-disabled/);
});

test("admins cannot demote or suspend themselves", async () => {
	const admin = (await login("admin@test.rw", "Admin12345")).body;
	const id = admin.user._id;
	assert.equal((await call("PATCH", `/api/admin/users/${id}`, { token: admin.token, body: { status: "suspended" } })).status, 400);
	assert.equal((await call("PATCH", `/api/admin/users/${id}`, { token: admin.token, body: { role: "editor" } })).status, 400);
});

test("uploads validate type and size and return a URL", async () => {
	const ed = (await login("ed@test.rw", "Editor12345")).body;
	const send = async (name, type, bytes, kind = "image") => {
		const form = new FormData();
		form.append("kind", kind);
		form.append("file", new Blob([bytes], { type }), name);
		const res = await fetch(`${base}/api/admin/uploads`, { method: "POST", headers: { Authorization: `Bearer ${ed.token}` }, body: form });
		return { status: res.status, body: await res.json() };
	};
	const png = fs.readFileSync(path.join(__dirname, "..", "fixtures", "pixel.png"));
	const ok = await send("logo.png", "image/png", png);
	assert.equal(ok.status, 201);
	assert.match(ok.body.data.url, /\/uploads\/.+\.png$/);
	const fetched = await fetch(ok.body.data.url);
	assert.equal(fetched.status, 200);
	assert.equal(fetched.headers.get("x-content-type-options"), "nosniff");
	assert.equal((await send("evil.png", "image/png", Buffer.from("<script>alert(1)</script>"))).status, 415);
	assert.equal((await send("evil.svg", "image/svg+xml", Buffer.from("<svg onload=alert(1)>"))).status, 415);
	assert.equal((await send("huge.png", "image/png", Buffer.concat([png, Buffer.alloc(6 * 1024 * 1024)]))).status, 413);
	assert.equal((await fetch(`${base}/api/admin/uploads`, { method: "POST" })).status, 401);
	fs.rmSync(path.join(__dirname, "..", "..", "uploads", path.basename(ok.body.data.url)), { force: true });
	void os;
});

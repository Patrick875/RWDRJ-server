/* Runs inside `npm run test:rules` (Firebase emulator). */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { initializeTestEnvironment, assertFails, assertSucceeds } = require("@firebase/rules-unit-testing");
const { ref, get, set, update, remove } = require("firebase/database");
const { buildClaims } = require("../../utils/modules");

let env;
const claims = (role, modules = []) => buildClaims({ role, modules });
const db = (ctx) => ctx.database();

const newsItem = (id, extra = {}) => ({ id, type: "news", title: "T", slug: `t-${id}`, status: "published", visible: true, ...extra });

test.before(async () => {
	const [host, port] = (process.env.FIREBASE_DATABASE_EMULATOR_HOST || "127.0.0.1:9000").split(":");
	env = await initializeTestEnvironment({
		projectId: "demo-rwdrj",
		database: { host, port: Number(port), rules: fs.readFileSync(path.join(__dirname, "..", "..", "..", "database.rules.json"), "utf8") },
	});
});
test.after(async () => env && env.cleanup());
test.beforeEach(async () => {
	await env.clearDatabase();
	await env.withSecurityRulesDisabled(async (ctx) => {
		await set(ref(db(ctx), "drafts/collections/publications/items/d1"), { ...newsItem("d1"), status: "draft" });
		await set(ref(db(ctx), "collections/publications/items/p1"), newsItem("p1"));
		await set(ref(db(ctx), "content/en/home/hero/title"), "Hello");
	});
});

test("anonymous can read published paths only", async () => {
	const anon = db(env.unauthenticatedContext());
	await assertSucceeds(get(ref(anon, "collections/publications")));
	await assertSucceeds(get(ref(anon, "content/en")));
	await assertSucceeds(get(ref(anon, "site/settings")));
	await assertFails(get(ref(anon, "drafts/collections/publications")));
	await assertFails(get(ref(anon, "drafts")));
	await assertFails(get(ref(anon, "meta")));
	await assertFails(get(ref(anon, "/")));
});

test("anonymous and non-staff users cannot write anything", async () => {
	const anon = db(env.unauthenticatedContext());
	await assertFails(set(ref(anon, "content/en/home/hero/title"), "pwned"));
	await assertFails(set(ref(anon, "collections/publications/items/x"), newsItem("x")));
	const stranger = db(env.authenticatedContext("u-plain", {}));
	await assertFails(set(ref(stranger, "content/en/home/hero/title"), "pwned"));
	await assertFails(get(ref(stranger, "drafts")));
});

test("staff can read drafts; viewer cannot write", async () => {
	const viewer = db(env.authenticatedContext("u-viewer", claims("viewer")));
	await assertSucceeds(get(ref(viewer, "drafts/collections/publications")));
	await assertFails(set(ref(viewer, "drafts/collections/publications/items/x"), { ...newsItem("x"), status: "draft" }));
});

test("editor without a module cannot write it; with the module can", async () => {
	const teamEditor = db(env.authenticatedContext("u-team", claims("editor", ["team"])));
	await assertFails(set(ref(teamEditor, "drafts/collections/publications/items/x"), { ...newsItem("x"), status: "draft" }));
	await assertFails(set(ref(teamEditor, "content/en/home/hero/title"), "nope"));
	await assertFails(set(ref(teamEditor, "site/settings/siteName"), "nope"));
	await assertSucceeds(set(ref(teamEditor, "drafts/collections/team/items/m1"), { id: "m1", fullName: "A", order: 1, visible: true }));

	const pubEditor = db(env.authenticatedContext("u-pub", claims("editor", ["publications"])));
	await assertSucceeds(set(ref(pubEditor, "drafts/collections/publications/items/x"), { ...newsItem("x"), status: "draft" }));
	await assertSucceeds(set(ref(pubEditor, "collections/publications/items/x"), newsItem("x")));
});

test("editors cannot remove published items; publishers and admins can", async () => {
	const editor = db(env.authenticatedContext("u-ed", claims("editor", ["publications"])));
	await assertFails(remove(ref(editor, "collections/publications/items/p1")));
	const publisher = db(env.authenticatedContext("u-pb", claims("publisher", ["publications"])));
	await assertSucceeds(remove(ref(publisher, "collections/publications/items/p1")));
	const otherPublisher = db(env.authenticatedContext("u-pb2", claims("publisher", ["gallery"])));
	await assertFails(remove(ref(otherPublisher, "drafts/collections/publications/items/d1")));
	const admin = db(env.authenticatedContext("u-ad", claims("administrator")));
	await assertSucceeds(remove(ref(admin, "drafts/collections/publications/items/d1")));
});

test("drafts can never be written to public paths", async () => {
	const admin = db(env.authenticatedContext("u-ad", claims("administrator")));
	await assertFails(set(ref(admin, "collections/publications/items/z"), { ...newsItem("z"), status: "draft" }));
	await assertFails(set(ref(admin, "collections/gallery/items/g"), { id: "g", kind: "image", title: "x", order: 1, public: false }));
	await assertSucceeds(set(ref(admin, "collections/gallery/items/g"), { id: "g", kind: "image", title: "x", order: 1, public: true }));
});

test("validation rejects malformed items", async () => {
	const admin = db(env.authenticatedContext("u-ad", claims("administrator")));
	await assertFails(set(ref(admin, "collections/publications/items/bad"), newsItem("bad", { type: "podcast" })));
	await assertFails(set(ref(admin, "collections/publications/items/bad"), newsItem("bad", { slug: "Bad Slug!" })));
	await assertFails(set(ref(admin, "drafts/collections/statistics/items/s"), { id: "s", value: "12", label: "x", order: 1, visible: true }));
});

test("publish is an atomic multi-path update for editors with the module", async () => {
	const editor = db(env.authenticatedContext("u-ed", claims("editor", ["publications"])));
	await assertSucceeds(
		update(ref(editor), {
			"drafts/collections/publications/items/d1/status": "published",
			"collections/publications/items/d1": newsItem("d1"),
			"collections/publications/updatedAt": Date.now(),
		}),
	);
	const teamOnly = db(env.authenticatedContext("u-t", claims("editor", ["team"])));
	await assertFails(update(ref(teamOnly), { "collections/team/updatedAt": 1, "collections/publications/updatedAt": 1 }));
});

test("only admins can write meta", async () => {
	const publisher = db(env.authenticatedContext("u-pb", claims("publisher", ["publications"])));
	await assertFails(set(ref(publisher, "meta/seed"), { version: 1 }));
	const admin = db(env.authenticatedContext("u-ad", claims("administrator")));
	await assertSucceeds(set(ref(admin, "meta/seed"), { version: 1 }));
});

test("jobs: module-gated, drafts private, expired-safe validation", async () => {
	const job = (id, extra = {}) => ({ id, title: "Intern", slug: `intern-${id}`, status: "published", deadline: "2030-01-31", visible: true, order: 1, ...extra });
	const pubEditor = db(env.authenticatedContext("u-pub", claims("editor", ["publications"])));
	await assertFails(set(ref(pubEditor, "drafts/collections/jobs/items/j1"), job("j1", { status: "draft" })));
	const jobsEditor = db(env.authenticatedContext("u-jobs", claims("editor", ["jobs"])));
	await assertSucceeds(set(ref(jobsEditor, "drafts/collections/jobs/items/j1"), job("j1", { status: "draft" })));
	await assertSucceeds(set(ref(jobsEditor, "collections/jobs/items/j1"), job("j1")));
	await assertFails(set(ref(jobsEditor, "collections/jobs/items/j2"), job("j2", { status: "draft" })));
	await assertFails(set(ref(jobsEditor, "collections/jobs/items/j3"), job("j3", { deadline: "soon" })));
	await assertFails(remove(ref(jobsEditor, "collections/jobs/items/j1")));
	const anon = db(env.unauthenticatedContext());
	await assertSucceeds(get(ref(anon, "collections/jobs")));
	await assertFails(get(ref(anon, "drafts/collections/jobs")));
	const admin = db(env.authenticatedContext("u-ad", claims("administrator")));
	await assertFails(set(ref(admin, "collections/publications/items/c"), newsItem("c", { type: "career" })));
});

#!/usr/bin/env node
/*
 * Seeds Firebase RTDB from client/src/content/fallback-content.json (the same JSON the site
 * falls back to). Idempotent:
 *   - text, site settings, impact page: missing keys are added, existing values are kept;
 *   - collections: seeded only if the collection has never been written;
 *   - published and drafts/ copies are both filled.
 * Flags: --dry-run (print what would change), --force (overwrite everything with the JSON).
 * Uses the same env vars as the server (FIREBASE_* or the emulator hosts).
 */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env"), quiet: true });
const fs = require("fs");
const { getDatabase, resetFirebaseApp } = require("../firebase/admin");
const { sanitizeHtml } = require("../utils/sanitize");

const FALLBACK = path.join(__dirname, "..", "..", "client", "src", "content", "fallback-content.json");
const args = new Set(process.argv.slice(2));
const DRY = args.has("--dry-run");
const FORCE = args.has("--force");

const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);

/** Adds keys from `base` that `current` lacks; never overwrites. */
const fillMissing = (base, current) => {
	if (current === undefined || current === null) return base;
	if (!isObj(base) || !isObj(current)) return current;
	const out = { ...current };
	for (const [k, v] of Object.entries(base)) out[k] = fillMissing(v, current[k]);
	return out;
};

const sanitizeDeep = (value, key = "") => {
	if (typeof value === "string") return /Html$|^body$/.test(key) ? sanitizeHtml(value) : value;
	if (Array.isArray(value)) return value.map((v) => sanitizeDeep(v));
	if (isObj(value)) return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, sanitizeDeep(v, k)]));
	return value;
};

async function main() {
	const data = sanitizeDeep(JSON.parse(fs.readFileSync(FALLBACK, "utf8")));
	const db = getDatabase();
	const updates = {};
	const report = [];
	const now = Date.now();

	const doc = async (target, value) => {
		for (const prefix of ["", "drafts/"]) {
			const p = `${prefix}${target}`;
			const current = (await db.ref(p).once("value")).val();
			const next = FORCE ? value : fillMissing(value, current);
			if (JSON.stringify(next) !== JSON.stringify(current)) {
				updates[p] = next;
				report.push(`${current ? "fill " : "seed "} ${p}`);
			}
		}
	};

	// Migration: careers used to be publications with type "career"; they now live in collections/jobs.
	const jobsExist = (await db.ref("collections/jobs").once("value")).exists() || (await db.ref("drafts/collections/jobs").once("value")).exists();
	if (!jobsExist) {
		for (const prefix of ["", "drafts/"]) {
			const items = (await db.ref(`${prefix}collections/publications/items`).once("value")).val() || {};
			const careers = Object.values(items).filter((item) => item && item.type === "career");
			if (careers.length === 0) continue;
			const jobs = {};
			for (const c of careers) {
				jobs[c.id] = { id: c.id, title: c.title, slug: c.slug, summary: c.summary || "", body: c.body || "", location: c.career?.location || "", employmentType: c.career?.employmentType || "", deadline: c.career?.deadline || "", department: "", file: c.file || null, status: c.status, visible: c.visible !== false, publishDate: c.publishDate || "", order: c.order || 1 };
				updates[`${prefix}collections/publications/items/${c.id}`] = null;
			}
			updates[`${prefix}collections/jobs`] = { items: prefix === "" ? Object.fromEntries(Object.entries(jobs).filter(([, j]) => j.status === "published")) : jobs, updatedAt: now };
			report.push(`move  ${careers.length} career publication(s) -> ${prefix}collections/jobs`);
		}
	}

	for (const [lang, tree] of Object.entries(data.content)) await doc(`content/${lang}`, tree);
	await doc("site/settings", data.site.settings);
	await doc("pages/impact", data.pages.impact);

	for (const [name, items] of Object.entries(data.collections)) {
		for (const prefix of ["", "drafts/"]) {
			const p = `${prefix}collections/${name}`;
			const exists = (await db.ref(p).once("value")).exists() || updates[p] !== undefined;
			if (exists && !FORCE) continue;
			const published = prefix === "" ? Object.fromEntries(Object.entries(items).filter(([, it]) => (name === "publications" || name === "jobs" ? it.status === "published" : name === "gallery" ? it.public : true))) : items;
			updates[p] = { items: published, updatedAt: now };
			report.push(`seed  ${p} (${Object.keys(published).length} items)`);
		}
	}

	if (report.length === 0) {
		console.log("Nothing to do: RTDB already has every fallback key and collection.");
	} else {
		console.log(report.join("\n"));
		if (!DRY) {
			updates["meta/seed"] = { version: data.version, seededAt: now, force: FORCE };
			await db.ref().update(updates);
			console.log(`Seeded ${report.length} path(s).`);
		} else console.log("(dry run: nothing written)");
	}
	await resetFirebaseApp();
}

main().catch(async (error) => {
	console.error("seed_failed:", error.message);
	await resetFirebaseApp().catch(() => undefined);
	process.exit(1);
});

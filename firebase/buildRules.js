/*
 * Generates ../../database.rules.json.
 * RTDB rules have no functions, so the repeated claim checks are composed here.
 * Run: npm run rules:build   (from server/)
 */
const fs = require("fs");
const path = require("path");
const { MODULES } = require("../utils/modules");

const STAFF = "auth != null && auth.token.staff === true";
const isAdmin = `(${STAFF} && auth.token.role === 'administrator')`;
const hasModule = (m) => `auth.token.m.contains('|${m}|')`;
const canEdit = (m) => `(${isAdmin} || (${STAFF} && (auth.token.role === 'editor' || auth.token.role === 'publisher') && ${hasModule(m)}))`;
const canRemove = (m) => `(${isAdmin} || (${STAFF} && auth.token.role === 'publisher' && ${hasModule(m)}))`;
// Editors may create/update published items but not remove them.
const canWriteItem = (m) => `(newData.exists() ? ${canEdit(m)} : ${canRemove(m)})`;

const str = (max) => `newData.isString() && newData.val().length <= ${max}`;
const optStr = (max) => `!newData.exists() || (${str(max)})`;

const itemValidate = {
	team: { ".validate": "newData.hasChildren(['id','fullName','order','visible'])", fullName: { ".validate": str(120) }, role: { ".validate": optStr(160) }, bio: { ".validate": optStr(4000) } },
	partners: { ".validate": "newData.hasChildren(['id','name','order','visible'])", name: { ".validate": str(160) } },
	statistics: { ".validate": "newData.hasChildren(['id','value','label','order','visible'])", value: { ".validate": "newData.isNumber()" }, label: { ".validate": str(120) } },
	gallery: { ".validate": "newData.hasChildren(['id','kind','title','order','public'])", kind: { ".validate": "newData.val() === 'image' || newData.val() === 'video'" } },
	publications: {
		".validate": "newData.hasChildren(['id','type','title','slug','status'])",
		type: { ".validate": "newData.val() === 'video' || newData.val() === 'document' || newData.val() === 'data' || newData.val() === 'news'" },
		status: { ".validate": "newData.val() === 'draft' || newData.val() === 'published'" },
		slug: { ".validate": "newData.isString() && newData.val().matches(/^[a-z0-9]+(-[a-z0-9]+)*$/)" },
		body: { ".validate": optStr(200000) },
	},
	jobs: {
		".validate": "newData.hasChildren(['id','title','slug','status','deadline'])",
		title: { ".validate": str(200) },
		status: { ".validate": "newData.val() === 'draft' || newData.val() === 'published'" },
		slug: { ".validate": "newData.isString() && newData.val().matches(/^[a-z0-9]+(-[a-z0-9]+)*$/)" },
		deadline: { ".validate": "newData.isString() && newData.val().matches(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/)" },
		body: { ".validate": optStr(200000) },
	},
};

const collectionNode = (m, { published }) => ({
	updatedAt: { ".write": canEdit(m), ".validate": "newData.isNumber()" },
	items: {
		$id: {
			".write": canWriteItem(m),
			...itemValidate[m],
			// Only published publications / public gallery items may sit on public paths.
			...(published && (m === "publications" || m === "jobs") ? { status: { ".validate": "newData.val() === 'published'" } } : {}),
			...(published && m === "gallery" ? { public: { ".validate": "newData.val() === true" } } : {}),
		},
	},
});

const collectionModules = ["team", "partners", "statistics", "gallery", "publications", "jobs"];
const collections = (published) =>
	Object.fromEntries(collectionModules.map((m) => [m, collectionNode(m, { published })]));

const rules = {
	rules: {
		".read": false,
		".write": false,
		content: { ".read": true, ".write": canEdit("pageText") },
		site: { ".read": true, settings: { ".write": canEdit("siteSettings") } },
		pages: { ".read": true, impact: { ".write": canEdit("impact") } },
		collections: { ".read": true, ...collections(true) },
		drafts: {
			".read": STAFF,
			content: { ".write": canEdit("pageText") },
			site: { settings: { ".write": canEdit("siteSettings") } },
			pages: { impact: { ".write": canEdit("impact") } },
			collections: collections(false),
		},
		meta: { ".read": STAFF, ".write": isAdmin },
	},
};

if (MODULES.length < 9) throw new Error("module list unexpectedly short");
const out = path.join(__dirname, "..", "..", "database.rules.json");
fs.writeFileSync(out, JSON.stringify(rules, null, "\t") + "\n");
console.log(`wrote ${out}`);

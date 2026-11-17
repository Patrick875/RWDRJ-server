const test = require("node:test");
const assert = require("node:assert/strict");
const { sanitizeHtml, safeUrl, parseYouTubeId, isGoogleMapsEmbedUrl } = require("../../utils/sanitize");
const { isJobOpen, isPubliclyListed, deadlineEndsAt } = require("../../utils/careers");
const { validateUpload } = require("../../utils/uploadPolicy");
const { buildClaims, effectiveModules, normalizeModules } = require("../../utils/modules");

test("sanitizeHtml strips scripts, handlers and javascript: URLs", () => {
	const dirty = `<p onclick="x()">Hi<script>alert(1)</script><img src=x onerror=alert(1)><a href="javascript:alert(1)">bad</a><a href=" java\tscript:alert(1)">bad2</a><iframe src="https://evil"></iframe><a href="https://ok.org">ok</a><style>*{}</style></p>`;
	const clean = sanitizeHtml(dirty);
	assert.doesNotMatch(clean, /script|onerror|onclick|iframe|javascript|style/i);
	assert.match(clean, /<a href="https:\/\/ok.org" target="_blank" rel="noopener noreferrer">ok<\/a>/);
	assert.match(clean, /<a>bad<\/a>/);
});

test("safeUrl allows http(s)/mailto/tel/relative only", () => {
	assert.equal(safeUrl("https://a.org"), "https://a.org");
	assert.equal(safeUrl("mailto:x@y.z"), "mailto:x@y.z");
	assert.equal(safeUrl("/gallery"), "/gallery");
	assert.equal(safeUrl("javascript:alert(1)"), "");
	assert.equal(safeUrl("JaVaScRiPt:alert(1)"), "");
	assert.equal(safeUrl("data:text/html;base64,xx"), "");
	assert.equal(safeUrl("//evil.com/x"), "");
});

test("parseYouTubeId handles common URL shapes and rejects others", () => {
	assert.equal(parseYouTubeId("https://youtu.be/ZFMCR_MVrfg"), "ZFMCR_MVrfg");
	assert.equal(parseYouTubeId("https://www.youtube.com/watch?v=79VyUWkdh88&t=3"), "79VyUWkdh88");
	assert.equal(parseYouTubeId("https://www.youtube.com/embed/79VyUWkdh88"), "79VyUWkdh88");
	assert.equal(parseYouTubeId("https://youtube.com/shorts/79VyUWkdh88"), "79VyUWkdh88");
	assert.equal(parseYouTubeId("https://evil.com/watch?v=79VyUWkdh88"), "");
	assert.equal(parseYouTubeId("javascript:alert(1)"), "");
});

test("Google Maps embed validation accepts Google domains only", () => {
	assert.ok(isGoogleMapsEmbedUrl("https://www.google.com/maps/embed?pb=!1m18"));
	assert.ok(isGoogleMapsEmbedUrl("https://maps.google.com/maps?q=-1.9,30.1&z=13&output=embed"));
	assert.ok(!isGoogleMapsEmbedUrl("http://www.google.com/maps/embed?pb=1"));
	assert.ok(!isGoogleMapsEmbedUrl("https://www.google.com.evil.io/maps/embed?pb=1"));
	assert.ok(!isGoogleMapsEmbedUrl("https://evil.com/maps/embed"));
});

test("job deadlines close at the end of the day in Kigali", () => {
	const job = { status: "published", visible: true, deadline: "2024-08-24" };
	const end = deadlineEndsAt("2024-08-24");
	assert.equal(new Date(end).toISOString(), "2024-08-24T21:59:59.999Z");
	assert.ok(isJobOpen(job, end));
	assert.ok(!isJobOpen(job, end + 1));
	assert.ok(!isPubliclyListed(job, Date.parse("2026-01-01")));
	assert.ok(isPubliclyListed({ ...job, deadline: "2099-01-01" }));
	assert.ok(!isPubliclyListed({ ...job, status: "draft", deadline: "2099-01-01" }));
	assert.ok(!isPubliclyListed({ ...job, visible: false, deadline: "2099-01-01" }));
});

test("upload policy checks type, extension, size and magic bytes", () => {
	const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
	assert.equal(validateUpload({ kind: "image", originalname: "logo.png", mimetype: "image/png", size: png.length, buffer: png }).ok, true);
	const html = Buffer.from("<html><script>alert(1)</script></html>");
	assert.equal(validateUpload({ kind: "image", originalname: "logo.png", mimetype: "image/png", size: html.length, buffer: html }).status, 415);
	assert.equal(validateUpload({ kind: "image", originalname: "x.svg", mimetype: "image/svg+xml", size: 10, buffer: html }).status, 415);
	assert.equal(validateUpload({ kind: "image", originalname: "big.png", mimetype: "image/png", size: 6 * 1024 * 1024, buffer: png }).status, 413);
	const pdf = Buffer.from("%PDF-1.7 ...");
	assert.equal(validateUpload({ kind: "document", originalname: "r.pdf", mimetype: "application/pdf", size: pdf.length, buffer: pdf }).ok, true);
	const csv = Buffer.from("a,b\n1,2\n");
	assert.equal(validateUpload({ kind: "data", originalname: "d.csv", mimetype: "text/csv", size: csv.length, buffer: csv }).ok, true);
	assert.equal(validateUpload({ kind: "data", originalname: "d.csv", mimetype: "text/csv", size: html.length, buffer: html }).ok, false);
});

test("claims: admins get every module, others only valid assigned ones", () => {
	assert.deepEqual(normalizeModules(["team", "bogus", "team"]), ["team"]);
	assert.equal(effectiveModules({ role: "administrator", modules: [] }).length, 9);
	const claims = buildClaims({ role: "editor", modules: ["team", "partners"], claimsVersion: 3 });
	assert.deepEqual(claims, { staff: true, role: "editor", modules: ["team", "partners"], m: "|team|partners|", cv: 3 });
});

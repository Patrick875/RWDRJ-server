const test = require("node:test");
const assert = require("node:assert/strict");

test("mailer: links use APP_URL without a trailing slash", () => {
	process.env.APP_URL = "https://womenrepro.org/";
	const { links } = require("../../services/mailer");
	assert.equal(links.reset("abc"), "https://womenrepro.org/admin/resetpassword/abc");
	assert.equal(links.invite("abc"), "https://womenrepro.org/admin/accept-invite?token=abc");
});

test("mailer: layout escapes user-supplied text", () => {
	const { layout, escapeHtml } = require("../../services/mailer");
	const html = layout({ preheader: "<b>x</b>", title: "Hi <script>", paragraphs: [escapeHtml("<img src=x onerror=alert(1)>")], button: { label: "Go", url: 'https://x.org/"><script>' } });
	assert.ok(!html.includes("<script>"));
	assert.ok(!html.includes("<img src=x"));
});

test("mailer: refuses to send when no transport is configured", async () => {
	for (const k of ["SMTP_HOST", "RESET_PASSWORD_EMAIL", "RESET_PASSWORD_PASSWORD"]) delete process.env[k];
	const { sendInviteEmail, isMailConfigured } = require("../../services/mailer");
	assert.equal(isMailConfigured(), false);
	await assert.rejects(sendInviteEmail({ email: "a@example.org", fullname: "A", role: "editor", token: "t" }), { code: "MAIL_NOT_CONFIGURED" });
});

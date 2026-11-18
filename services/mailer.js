/*
 * Account emails: password reset link, password changed notice, invitation.
 *
 * Transport (first match wins):
 *   SMTP_HOST [+ SMTP_PORT (587), SMTP_SECURE ("true" for 465), SMTP_USER, SMTP_PASS]  any SMTP provider
 *   RESET_PASSWORD_EMAIL + RESET_PASSWORD_PASSWORD                                     Gmail (app password)
 * MAIL_FROM sets the sender ("RWDRJ <no-reply@womenrepro.org>"); defaults to the SMTP/Gmail user.
 * APP_URL (or FRONTEND_URL / frontendURL) is the public site URL used in links.
 *
 * Every send is awaited: on Netlify Functions the process can freeze right after the response.
 */
const nodemailer = require("nodemailer");

let transporter = null;
let transporterKey = "";

const smtpUser = () => process.env.SMTP_USER || process.env.RESET_PASSWORD_EMAIL || "";

const isMailConfigured = () =>
	Boolean(process.env.SMTP_HOST) || Boolean(process.env.RESET_PASSWORD_EMAIL && process.env.RESET_PASSWORD_PASSWORD);

function getTransporter() {
	const key = [process.env.SMTP_HOST, process.env.SMTP_PORT, process.env.SMTP_USER, process.env.RESET_PASSWORD_EMAIL].join("|");
	if (transporter && key === transporterKey) return transporter;
	transporterKey = key;
	// Fail fast instead of hanging a request (and a serverless function) on a bad SMTP setup.
	const timeouts = { connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000 };
	transporter = process.env.SMTP_HOST
		? nodemailer.createTransport({
				host: process.env.SMTP_HOST,
				port: Number(process.env.SMTP_PORT || 587),
				secure: process.env.SMTP_SECURE === "true",
				auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
				...timeouts,
			})
		: nodemailer.createTransport({
				service: "gmail",
				auth: { user: process.env.RESET_PASSWORD_EMAIL, pass: process.env.RESET_PASSWORD_PASSWORD },
				...timeouts,
			});
	return transporter;
}

const appUrl = () => String(process.env.APP_URL || process.env.FRONTEND_URL || process.env.frontendURL || "http://localhost:5173").replace(/\/+$/, "");

const links = {
	signIn: () => `${appUrl()}/admin`,
	reset: (token) => `${appUrl()}/admin/resetpassword/${token}`,
	invite: (token) => `${appUrl()}/admin/accept-invite?token=${token}`,
	forgot: () => `${appUrl()}/admin/forgotpassword`,
};

const escapeHtml = (value) =>
	String(value ?? "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");

const ROLE_NAMES = { administrator: "Admin", publisher: "Publisher", editor: "Editor", viewer: "Viewer" };

/** Table-based layout with inline styles: renders in Gmail, Outlook and phone mail apps. */
function layout({ preheader, title, paragraphs, button, footnote }) {
	const p = (html) => `<p style="margin:0 0 16px;font-size:15px;line-height:24px;color:#334155;">${html}</p>`;
	return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:#f8f7f3;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</span>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8f7f3;padding:32px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;">
<tr><td style="background:#0c2d48;border-radius:16px 16px 0 0;padding:24px 32px;">
<p style="margin:0;font-size:12px;letter-spacing:3px;font-weight:700;color:#c29f1d;">RWDRJ / CMS</p>
<p style="margin:6px 0 0;font-size:14px;color:#cbd5e1;">Rwanda Women Doctors for Reproductive Justice</p>
</td></tr>
<tr><td style="background:#ffffff;border-radius:0 0 16px 16px;padding:32px;">
<h1 style="margin:0 0 20px;font-family:Georgia,'Times New Roman',serif;font-size:26px;line-height:32px;color:#0c2d48;font-weight:700;">${escapeHtml(title)}</h1>
${paragraphs.map(p).join("\n")}
${
	button
		? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:8px 0 24px;"><tr><td style="border-radius:12px;background:#c29f1d;">
<a href="${escapeHtml(button.url)}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:#0c2d48;text-decoration:none;border-radius:12px;">${escapeHtml(button.label)}</a>
</td></tr></table>
<p style="margin:0 0 16px;font-size:13px;line-height:20px;color:#64748b;">If the button doesn't work, copy this link into your browser:<br /><a href="${escapeHtml(button.url)}" style="color:#075985;word-break:break-all;">${escapeHtml(button.url)}</a></p>`
		: ""
}
${footnote ? `<p style="margin:24px 0 0;padding-top:16px;border-top:1px solid #e2e8f0;font-size:13px;line-height:20px;color:#64748b;">${footnote}</p>` : ""}
</td></tr>
<tr><td style="padding:20px 8px;text-align:center;font-size:12px;color:#94a3b8;">You received this because of an account on the RWDRJ website dashboard.</td></tr>
</table></td></tr></table></body></html>`;
}

async function send({ to, subject, text, html }) {
	if (!isMailConfigured()) {
		const error = new Error("mail_not_configured");
		error.code = "MAIL_NOT_CONFIGURED";
		throw error;
	}
	const from = process.env.MAIL_FROM || (smtpUser() ? `RWDRJ <${smtpUser()}>` : undefined);
	const info = await getTransporter().sendMail({ from, to, subject, text, html });
	console.log(JSON.stringify({ event: "mail_sent", subject, messageId: info.messageId }));
	return info;
}

const duration = (minutes) => (minutes >= 120 && minutes % 60 === 0 ? `${minutes / 60} hours` : `${minutes} minutes`);

const firstName = (fullname) => String(fullname || "").trim().split(/\s+/)[0] || "there";

function sendPasswordResetEmail({ email, fullname, token, minutes = 60, requestedByAdmin = false }) {
	const url = links.reset(token);
	const intro = requestedByAdmin
		? "An administrator asked for your RWDRJ dashboard password to be reset."
		: "We received a request to reset the password for your RWDRJ dashboard account.";
	return send({
		to: email,
		subject: "Reset your RWDRJ dashboard password",
		text: `Hi ${firstName(fullname)},\n\n${intro}\nChoose a new password here (valid for ${duration(minutes)}, one use only):\n${url}\n\nIf you didn't ask for this, ignore this email. Your password stays the same.\n\nRWDRJ`,
		html: layout({
			preheader: `Choose a new password. The link expires in ${duration(minutes)}.`,
			title: "Reset your password",
			paragraphs: [`Hi ${escapeHtml(firstName(fullname))},`, escapeHtml(intro), `Use the button below to choose a new password. The link works once and expires in <strong>${duration(minutes)}</strong>.`],
			button: { label: "Choose a new password", url },
			footnote: "Didn't ask for this? You can ignore this email. Your password won't change unless you use the link.",
		}),
	});
}

function sendPasswordChangedEmail({ email, fullname }) {
	const when = new Date().toLocaleString("en-GB", { timeZone: "Africa/Kigali", dateStyle: "medium", timeStyle: "short" });
	return send({
		to: email,
		subject: "Your RWDRJ dashboard password was changed",
		text: `Hi ${firstName(fullname)},\n\nThe password for your RWDRJ dashboard account was changed on ${when} (Kigali time).\nIf this wasn't you, reset it now: ${links.forgot()} and tell an administrator.\n\nRWDRJ`,
		html: layout({
			preheader: "Your password was just changed.",
			title: "Your password was changed",
			paragraphs: [`Hi ${escapeHtml(firstName(fullname))},`, `The password for your RWDRJ dashboard account was changed on <strong>${escapeHtml(when)}</strong> (Kigali time). You can now sign in with your new password.`],
			button: { label: "Sign in", url: links.signIn() },
			footnote: `Wasn't you? <a href="${escapeHtml(links.forgot())}" style="color:#075985;">Reset your password</a> right away and let an administrator know.`,
		}),
	});
}

function sendInviteEmail({ email, fullname, role, token, invitedBy, hours = 72 }) {
	const url = links.invite(token);
	const roleName = ROLE_NAMES[role] || role;
	const by = invitedBy ? `${invitedBy} invited you` : "You've been invited";
	return send({
		to: email,
		subject: "You're invited to manage the RWDRJ website",
		text: `Hi ${firstName(fullname)},\n\n${by} to help manage the RWDRJ website as ${roleName}.\nSet your password and activate your account here (valid for ${hours} hours):\n${url}\n\nRWDRJ`,
		html: layout({
			preheader: `Set your password to start editing the website. Expires in ${hours} hours.`,
			title: "You're invited",
			paragraphs: [
				`Hi ${escapeHtml(firstName(fullname))},`,
				`${escapeHtml(by)} to help manage the <strong>RWDRJ website</strong> as <strong>${escapeHtml(roleName)}</strong>.`,
				`Choose a password to activate your account. The invitation expires in <strong>${hours} hours</strong>.`,
			],
			button: { label: "Accept invitation", url },
			footnote: "Not expecting this? You can ignore the email; no account is activated unless you use the link.",
		}),
	});
}

module.exports = { isMailConfigured, sendPasswordResetEmail, sendPasswordChangedEmail, sendInviteEmail, links, layout, escapeHtml };

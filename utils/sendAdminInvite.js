const nodemailer = require("nodemailer");

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const sendAdminInvite = async ({ email, fullname, role, inviteUrl }) => {
  const user = process.env.RESET_PASSWORD_EMAIL;
  const pass = process.env.RESET_PASSWORD_PASSWORD;
  if (!user || !pass) {
    if (process.env.NODE_ENV === "production")
      throw new Error("admin_invite_email_not_configured");
    return false;
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    host: process.env.SMTP_HOST,
    port: 587,
    secure: false,
    auth: { user, pass },
  });
  await transporter.sendMail({
    from: user,
    to: email,
    subject: "You have been invited to manage the RWDRJ website",
    text: `Hello ${fullname}, you have been invited as a ${role}. Complete your account here: ${inviteUrl}`,
    html: `<p>Hello ${escapeHtml(fullname)},</p><p>You have been invited to manage the RWDRJ website as a <strong>${escapeHtml(role)}</strong>.</p><p><a href="${escapeHtml(inviteUrl)}">Accept your invitation</a></p><p>This invitation expires in 72 hours.</p>`,
  });
  return true;
};

module.exports = { sendAdminInvite };

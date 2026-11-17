#!/usr/bin/env node
/*
 * Bootstrap or repair an administrator account (first deploy, lost access).
 *   ADMIN_EMAIL=... ADMIN_NAME="..." ADMIN_PASSWORD=... node scripts/createAdmin.js
 * Uses the server's database settings from .env. Firebase claims sync on the admin's next login.
 */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env"), quiet: true });
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const { connectDatabase } = require("../config/database");
const User = require("../models/userModel");

(async () => {
	const email = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
	const fullname = String(process.env.ADMIN_NAME || "Administrator").trim();
	const password = String(process.env.ADMIN_PASSWORD || "");
	if (!email || password.length < 10) throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD (10+ characters)");
	await connectDatabase();
	const user = await User.findOneAndUpdate(
		{ email },
		{ email, fullname, role: "administrator", status: "active", password: await bcrypt.hash(password, 12), $inc: { claimsVersion: 1 } },
		{ upsert: true, new: true, setDefaultsOnInsert: true },
	);
	console.log(`Administrator ready: ${user.email}`);
	await mongoose.disconnect();
})().catch(async (error) => {
	console.error(error.message);
	await mongoose.disconnect().catch(() => undefined);
	process.exit(1);
});

const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const { randomUUID } = require("crypto");
const rateLimit = require("express-rate-limit");

const authRouter = require("./routes/authRouter");
const adminRouter = require("./routes/adminRouter");
const blogRouter = require("./routes/blogRouter");
const eventsRouter = require("./routes/eventRouter");
const newsRouter = require("./routes/newsRouter");
const siteInfoRouter = require("./routes/siteInfoRoutes");
const aboutusRouter = require("./routes/aboutUsPageRouter");
const contactusRouter = require("./routes/contactUsPageRouter");
const compaignRouter = require("./routes/compaignPageRouter");
const advocacyRouter = require("./routes/advocacyPageRouter");
const trainingRouter = require("./routes/trainingPageRouter");
const digitalInfoRouter = require("./routes/digitalRouter");
const partnerRouter = require("./routes/partnerRouter");
const teamMemberRouter = require("./routes/teamMemberRouter");
const ourTeamPageRouter = require("./routes/ourTeamPageRouter");
const pagesRouter = require("./routes/pagesRouter");
const cmsRouter = require("./routes/cmsRouter");

const app = express();
const allowedOrigins = (process.env.ALLOWED_ORIGINS || process.env.FRONTEND_URL || process.env.frontendURL || "")
	.split(",")
	.map((origin) => origin.trim())
	.filter(Boolean);

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(helmet());
app.use(cookieParser());
app.use((req, res, next) => {
	req.requestId = req.get("x-request-id") || randomUUID();
	res.setHeader("x-request-id", req.requestId);
	const startedAt = process.hrtime.bigint();
	res.on("finish", () => {
		const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
		console.log(JSON.stringify({
			level: res.statusCode >= 500 ? "error" : "info",
			requestId: req.requestId,
			method: req.method,
			path: req.originalUrl,
			status: res.statusCode,
			durationMs: Number(durationMs.toFixed(2)),
		}));
	});
	next();
});
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));
app.use(cors({
	origin: (origin, callback) => {
		if (!origin || allowedOrigins.includes(origin) || (process.env.NODE_ENV !== "production" && allowedOrigins.length === 0)) {
			return callback(null, true);
		}
		return callback(new Error("cors_origin_not_allowed"));
	},
	credentials: true,
}));

const authLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	limit: 20,
	standardHeaders: "draft-8",
	legacyHeaders: false,
	message: { status: "fail", message: "Too many authentication attempts" },
});

app.get("/health", (req, res) => res.status(200).json({ status: "ok", requestId: req.requestId }));
app.get("/ready", (req, res) => {
	const mongoose = require("mongoose");
	const ready = mongoose.connection.readyState === 1;
	return res.status(ready ? 200 : 503).json({ status: ready ? "ready" : "not_ready" });
});

// Public API routes. Admin mutations are mounted separately below and protected there.
app.use("/api/", siteInfoRouter);
app.use("/api/aboutus", aboutusRouter);
app.use("/api/contactus", contactusRouter);
app.use("/api/compaign", compaignRouter);
app.use("/api/training", trainingRouter);
app.use("/api/advocacy", advocacyRouter);
app.use("/api/ourteam", ourTeamPageRouter);
app.use("/api/partners", partnerRouter);
app.use("/api/teammembers", teamMemberRouter);
app.use("/api/digitalhealth", digitalInfoRouter);
app.use("/api/pages", pagesRouter);
app.use("/api/blogs", blogRouter);
app.use("/api/events", eventsRouter);
app.use("/api/news", newsRouter);
app.use("/api/cms", cmsRouter);

app.use("/api/admin", authLimiter, authRouter);
app.use("/api/admin", adminRouter);

app.use((req, res) => {
	res.status(404).json({ status: "fail", message: "Route not found", requestId: req.requestId });
});

app.use((error, req, res, next) => {
	console.error("unhandled_request_error", {
		requestId: req.requestId,
		message: error.message,
	});
	if (res.headersSent) return next(error);
	const isValidationError = error.name === "ValidationError" || error.name === "CastError";
	const isDuplicateError = error.code === 11000;
	const isDatabaseUnavailable = error.name === "MongooseError" || error.name === "MongoServerSelectionError";
	const statusCode = error.message === "cors_origin_not_allowed"
		? 403
		: isValidationError
			? 400
			: isDuplicateError
				? 409
				: isDatabaseUnavailable
					? 503
					: 500;
	return res.status(statusCode).json({
		status: "error",
		message: process.env.NODE_ENV === "production" ? "Request failed" : error.message,
		requestId: req.requestId,
	});
});

module.exports = app;

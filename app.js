const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const authRouter = require("./routes/authRouter");
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

const app = express();

app.use(morgan("dev"));
app.use(express.json({ limit: "300mb" }));
app.use(express.urlencoded({ limit: "300mb" }));

// Configure CORS properly
const corsOptions = {
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  credentials: true,
};

app.use(cors(corsOptions));

app.use("/api/v1/", siteInfoRouter);
app.use("/api/v1/aboutus", aboutusRouter);
app.use("/api/v1/contactus", contactusRouter);
app.use("/api/v1/compaign", compaignRouter);
app.use("/api/v1/training", trainingRouter);
app.use("/api/v1/advocacy", advocacyRouter);
app.use("/api/v1/ourteam", ourTeamPageRouter);
app.use("/api/v1/partners", partnerRouter);
app.use("/api/v1/teammembers", teamMemberRouter);
app.use("/api/v1/digitalhealth", digitalInfoRouter);

app.use("/api/v1/admin", authRouter);
app.use("/api/v1/pages", pagesRouter);
app.use("/api/v1/blogs", blogRouter);
app.use("/api/v1/events", eventsRouter);
app.use("/api/v1/news", newsRouter);

module.exports = app;

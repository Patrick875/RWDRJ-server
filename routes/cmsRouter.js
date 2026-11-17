const express = require("express");
const cmsController = require("../controllers/cmsController");

const router = express.Router();

router.get("/pages", cmsController.listPages);
router.get("/pages/:slug", cmsController.getPublicPage);
router.get("/content", cmsController.listEntries);
router.get("/content/:slug", cmsController.getEntry);
router.get("/settings", cmsController.getSettings);

module.exports = router;

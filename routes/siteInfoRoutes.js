const express = require("express");
const siteInfoController = require("../controllers/siteInfoContoller");
const { siteInfoImageUploader } = require("../utils/imageUploader");
const { requireEditor } = require("../middleware/auth");

const router = express.Router();
// siteInfoController.create
router.route("/").get(siteInfoController.get);
router.patch("/:id", ...requireEditor, siteInfoImageUploader, siteInfoController.update);

module.exports = router;

const express = require("express");
const aboutusPageController = require("../controllers/aboutusPageController");
const { aboutUsPageImageUploader } = require("../utils/imageUploader");
const { requireEditor } = require("../middleware/auth");

const router = express.Router();
// siteInfoController.create
router
	.route("/")
	.get(aboutusPageController.get)
	.post(...requireEditor, aboutUsPageImageUploader, aboutusPageController.create);
router.patch("/:id", ...requireEditor, aboutUsPageImageUploader, aboutusPageController.update);

module.exports = router;

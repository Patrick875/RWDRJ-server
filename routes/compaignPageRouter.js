const express = require("express");
const compaignPageController = require("./../controllers/compainPageController");
const { contactUsPageImageUploader } = require("../utils/imageUploader");
const router = express.Router();
const { requireEditor } = require("../middleware/auth");

router
	.route("/")
	.get(compaignPageController.get)
	.post(...requireEditor, compaignPageController.create);
router.patch("/:id", ...requireEditor, compaignPageController.update);

module.exports = router;

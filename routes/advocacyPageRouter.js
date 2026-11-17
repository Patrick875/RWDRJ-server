const express = require("express");
const advocacyPageController = require("./../controllers/advocacyPageController");
const { contactUsPageImageUploader } = require("../utils/imageUploader");
const router = express.Router();
const { requireEditor } = require("../middleware/auth");

router
	.route("/")
	.get(advocacyPageController.get)
	.post(...requireEditor, advocacyPageController.create);
router.patch("/:id", ...requireEditor, advocacyPageController.update);

module.exports = router;

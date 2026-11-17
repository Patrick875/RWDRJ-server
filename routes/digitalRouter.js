const express = require("express");
const digitalInfoPageController = require("./../controllers/digitalInfoController");
const { contactUsPageImageUploader } = require("../utils/imageUploader");
const router = express.Router();
const { requireEditor } = require("../middleware/auth");

router
	.route("/")
	.get(digitalInfoPageController.get)
	.post(...requireEditor, digitalInfoPageController.create);
router.patch("/:id", ...requireEditor, digitalInfoPageController.update);

module.exports = router;

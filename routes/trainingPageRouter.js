const express = require("express");
const trainingPageController = require("./../controllers/trainingPageController");
const { contactUsPageImageUploader } = require("../utils/imageUploader");
const router = express.Router();
const { requireEditor } = require("../middleware/auth");

router
	.route("/")
	.get(trainingPageController.get)
	.post(...requireEditor, trainingPageController.create);
router.patch("/:id", ...requireEditor, trainingPageController.update);

module.exports = router;

const express = require("express");
const ourTeamPageController = require("./../controllers/ourTeamPageController");
const { contactUsPageImageUploader } = require("../utils/imageUploader");
const router = express.Router();
const { requireEditor } = require("../middleware/auth");

router
	.route("/")
	.get(ourTeamPageController.get)
	.post(...requireEditor, ourTeamPageController.create);
router.patch("/:id", ...requireEditor, ourTeamPageController.update);

module.exports = router;

const express = require("express");
const contactusController = require("./../controllers/contactusController");
const { contactUsPageImageUploader } = require("../utils/imageUploader");
const router = express.Router();
const { requireEditor } = require("../middleware/auth");

router
	.route("/")
	.get(contactusController.get)
	.post(...requireEditor, contactUsPageImageUploader, contactusController.create);
router.patch("/:id", ...requireEditor, contactusController.update);

module.exports = router;

const express = require("express");
const partnerController = require("./../controllers/partnerController");
const { partnerTeamMemberImageUploader } = require("../utils/imageUploader");
const router = express.Router();
const { requireEditor, requirePublisher } = require("../middleware/auth");

router
	.route("/")
	.get(partnerController.get)
	.post(...requireEditor, partnerTeamMemberImageUploader, partnerController.create);
router
	.route("/:id")
	.get(partnerController.getOne)
	.patch(...requireEditor, partnerTeamMemberImageUploader, partnerController.update)
	.delete(...requirePublisher, partnerController.delete);

module.exports = router;

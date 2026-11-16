const express = require("express");
const teamMemberController = require("./../controllers/teamMemberController");
const {
	contactUsPageImageUploader,
	partnerTeamMemberImageUploader,
} = require("../utils/imageUploader");
const { requireEditor, requirePublisher } = require("../middleware/auth");
const router = express.Router();

router
	.route("/")
	.get(teamMemberController.get)
	.post(...requireEditor, partnerTeamMemberImageUploader, teamMemberController.create);
router
	.route("/:id")
	.get(teamMemberController.getOne)
	.patch(...requireEditor, partnerTeamMemberImageUploader, teamMemberController.update)
	.delete(...requirePublisher, teamMemberController.delete);

module.exports = router;

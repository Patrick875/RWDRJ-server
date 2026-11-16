const express = require("express");
const eventsController = require("./../controllers/eventsController");
const { blogImageUploader } = require("./../utils/imageUploader");
const router = express.Router();
const { requireEditor, requirePublisher } = require("../middleware/auth");

router
	.route("/")
	.get(eventsController.getAll)
	.post(...requireEditor, blogImageUploader, eventsController.create)
	.delete(...requirePublisher, eventsController.deleteAll);
router
	.route("/:refId")
	.get(eventsController.getOne)
	.patch(...requireEditor, blogImageUploader, eventsController.update)
	.delete(...requirePublisher, eventsController.deleteOne);

module.exports = router;

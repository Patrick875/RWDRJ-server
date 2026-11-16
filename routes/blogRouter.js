const express = require("express");
const blogController = require("./../controllers/blogController");
const { blogImageUploader } = require("./../utils/imageUploader");
const router = express.Router();
const { requireEditor, requirePublisher } = require("../middleware/auth");

router
	.route("/")
	.get(blogController.getAll)
	.post(...requireEditor, blogImageUploader, blogController.create)
	.delete(...requirePublisher, blogController.deleteAll);
router
	.route("/:refId")
	.get(blogController.getOne)
	.patch(...requireEditor, blogImageUploader, blogController.update)
	.delete(...requirePublisher, blogController.deleteOne);

module.exports = router;

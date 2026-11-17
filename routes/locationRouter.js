const express = require("express");
const locationController = require("../controllers/locationController");
const { protect, requireRole } = require("../middleware/auth");

const router = express.Router();
router.get("/", locationController.listPublic);
router.get("/admin", protect, requireRole("administrator", "editor", "publisher"), locationController.list);
router.post("/admin", protect, requireRole("administrator", "editor", "publisher"), locationController.create);
router.patch("/admin/:id", protect, requireRole("administrator", "editor", "publisher"), locationController.update);
router.delete("/admin/:id", protect, requireRole("administrator", "publisher"), locationController.remove);

module.exports = router;

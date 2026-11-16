const express = require("express");
const { protect, requireRole } = require("../middleware/auth");
const adminController = require("../controllers/adminController");
const cmsController = require("../controllers/cmsController");
const mediaController = require("../controllers/mediaController");

const router = express.Router();
const administrator = ["administrator"];
const editors = ["administrator", "editor", "publisher"];
const publishers = ["administrator", "publisher"];

router.use(protect);

router.get("/users", requireRole(...administrator), adminController.listUsers);
router.post("/users/invite", requireRole(...administrator), adminController.inviteUser);
router.patch("/users/:id", requireRole(...administrator), adminController.updateUser);
router.post("/users/:id/resend-invite", requireRole(...administrator), adminController.resendInvite);

router.get("/pages", requireRole(...editors), cmsController.listPages);
router.get("/pages/:id", requireRole(...editors), cmsController.getPage);
router.post("/pages", requireRole(...editors), cmsController.createPage);
router.patch("/pages/:id", requireRole(...editors), cmsController.updatePage);
router.post("/pages/:id/publish", requireRole(...publishers), cmsController.publishPage);

router.get("/content", requireRole(...editors), cmsController.listEntries);
router.post("/content", requireRole(...editors), cmsController.createEntry);
router.patch("/content/:id", requireRole(...editors), cmsController.updateEntry);
router.post("/content/:id/publish", requireRole(...publishers), cmsController.publishEntry);

router.get("/settings", requireRole(...editors), cmsController.getSettings);
router.patch("/settings", requireRole(...administrator), cmsController.updateSettings);
router.get("/audit-logs", requireRole(...administrator), cmsController.getAuditLogs);
router.get("/media", requireRole(...editors), mediaController.list);
router.post("/media", requireRole(...editors), mediaController.create);
router.delete("/media/:id", requireRole(...publishers), mediaController.remove);

module.exports = router;

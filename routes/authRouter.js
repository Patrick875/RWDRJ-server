const express = require("express");
const authController = require("./../controllers/authController");
const { protect } = require("../middleware/auth");

const router = express.Router();

router.post("/login", authController.login);
router.post("/signup", authController.signup);
router.post("/forgotpassword", authController.forgotPassword);
router.post("/resetpassword", authController.resetPassword);
router.post("/accept-invite", authController.acceptInvite);
router.get("/me", protect, authController.me);
router.post("/logout", authController.logout);

module.exports = router;

const express = require("express");
const authController = require("./../controllers/authController");

const router = express.Router();

router.post("/login", authController.login);
router.post("/signup", authController.signup);
router.get("/", authController.getUsers);
router.get("/logout", authController.logout);

module.exports = router;

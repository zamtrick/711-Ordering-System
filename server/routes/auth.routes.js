import express from "express";
import { register, login, logout, me } from "../controllers/auth.controllers.js";
import auth from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/login", login);
router.post("/register", register);
router.post("/logout", logout);
router.get("/me", auth, me);

// Returns the raw JWT so native socket clients can pass it
// in the handshake auth object (httpOnly cookies aren't readable by JS).
router.get("/token", auth, (req, res) => {
  return res.status(200).json({
    success: true,
    token: req.cookies.accessToken,
  });
});

export default router;

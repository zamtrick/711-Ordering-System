import express from "express";
import { register, login, logout, me } from "../controllers/auth.controllers.js";
import auth from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/login", login);
router.post("/register", register);
router.post("/logout", logout);
router.get("/me", auth, me);

export default router;

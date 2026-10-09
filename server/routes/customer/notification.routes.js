import express from "express";
import {
  registerToken,
  unregisterToken,
  getStatus,
} from "../../controllers/customer/notification.controller.js";

const router = express.Router();

router.get("/", getStatus);
router.post("/register", registerToken);
router.post("/unregister", unregisterToken);

export default router;

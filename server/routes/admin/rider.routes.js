import express from "express";
import {
  getRiders,
  getRiderById,
  createRider,
  updateRiderById,
  deleteRiderById,
} from "../../controllers/admin/rider.controller.js";

const router = express.Router();

router.get("/", getRiders);
router.get("/:id", getRiderById);
router.post("/", createRider);
router.patch("/:id", updateRiderById);
router.delete("/:id", deleteRiderById);

export default router;

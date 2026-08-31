import express from "express";
import {
  getRiders,
  getRiderById,
  createRider,
  updateRiderById,
  deleteRiderById,
} from "../../controllers/admin/rider.controller";

const router = express.Router();

router.get("/riders", getRiders);
router.get("/riders/:id", getRiderById);
router.post("/riders", createRider);
router.patch("/riders/:id", updateRiderById);
router.delete("/riders/:id", deleteRiderById);

export default router;

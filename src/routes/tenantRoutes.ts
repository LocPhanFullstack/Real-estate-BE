import express from "express";
import {
  createTernant,
  getCurrentResidences,
  getTernant,
  updateTernant,
} from "../controllers/tenantController";

const router = express.Router();

router.get("/:cognitoId", getTernant);
router.put("/:cognitoId", updateTernant);
router.get("/:cognitoId,residences", getCurrentResidences);
router.post("/", createTernant);

export default router;

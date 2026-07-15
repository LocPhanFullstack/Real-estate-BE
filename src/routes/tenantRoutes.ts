import express from "express";
import {
  addFavoriteProperty,
  createTernant,
  getCurrentResidences,
  getTernant,
  removeFavoriteProperty,
  updateTernant,
} from "../controllers/tenantController";

const router = express.Router();

router.get("/:cognitoId", getTernant);
router.put("/:cognitoId", updateTernant);
router.get("/:cognitoId/residences", getCurrentResidences);
router.post("/", createTernant);
router.post("/:cognitoId/favorites/:propertyId", addFavoriteProperty);
router.delete("/:cognitoId/favorites/:propertyId", removeFavoriteProperty);

export default router;

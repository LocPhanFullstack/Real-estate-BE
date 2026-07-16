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

router.get("/me", getTernant);
router.put("/me", updateTernant);
router.get("/me/residences", getCurrentResidences);
router.post("/", createTernant);
router.post("/favorites/:propertyId", addFavoriteProperty);
router.delete("/favorites/:propertyId", removeFavoriteProperty);

export default router;

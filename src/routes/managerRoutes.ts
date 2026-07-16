import express from "express";
import {
  createManager,
  getManager,
  getManagerProperties,
  updateManager,
} from "../controllers/managerController";

const router = express.Router();

router.get("/me", getManager);
router.put("/me", updateManager);
router.get("/properties", getManagerProperties);
router.post("/", createManager);

export default router;

import express from "express";
import { authMiddleware } from "../middleware/authMiddleware";
import {
  createApplication,
  getListApplications,
  updateApplicationStatus,
} from "../controllers/applicationController";

const router = express.Router();

router.post("/", authMiddleware(["tenant"]), createApplication);
router.put("/:id/status", authMiddleware(["manager"]), updateApplicationStatus);
router.get("/", authMiddleware(["manager", "tenant"]), getListApplications);

export default router;

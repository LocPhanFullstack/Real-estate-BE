import express from "express";
import { createTernant, getTernant } from "../controllers/tenantController";

const router = express.Router();

router.get("/:cognitoId", getTernant);
router.post("/", createTernant);

export default router;

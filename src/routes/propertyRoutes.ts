import express from "express";
import {
  createProperty,
  getProperty,
  getProperties,
  getPropertyLease,
} from "../controllers/propertyController";
import { authMiddleware } from "../middleware/authMiddleware";
import multer from "multer";

const storage = multer.memoryStorage();
const upload = multer({ storage });

const router = express.Router();

router.get("/", getProperties);
router.get("/:id", getProperty);
router.post("/", authMiddleware(["manager"]), upload.array("photos"), createProperty);
router.get("/:id/leases", authMiddleware(["manager"]), getPropertyLease);

export default router;

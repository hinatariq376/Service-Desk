import { Router } from "express";
import * as userController from "../controllers/userController.js";
import { authenticate, requireRole } from "../middleware/auth.js";

const router = Router();

router.use(authenticate);

router.get("/", requireRole("ADMIN"), userController.getAllUsers);
router.get("/agents", userController.getSupportAgents);

export default router;

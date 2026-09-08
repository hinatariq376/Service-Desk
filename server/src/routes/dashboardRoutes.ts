import { Router } from "express";
import * as dashboardController from "../controllers/dashboardController.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

router.use(authenticate);

router.get("/summary", dashboardController.getSummary);
router.get("/analytics", dashboardController.getAnalytics);

export default router;

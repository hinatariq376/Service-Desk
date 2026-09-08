import { Router } from "express";
import * as auditController from "../controllers/auditController.js";
import { authenticate, requireRole } from "../middleware/auth.js";

const router = Router();

router.use(authenticate);
router.use(requireRole("ADMIN"));

router.get("/", auditController.getAuditLogs);

export default router;

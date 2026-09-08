import { Router } from "express";
import * as aiController from "../controllers/aiController.js";
import { authenticate } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { aiSummarizeSchema, aiClassifySchema } from "../validators/index.js";

const router = Router();

router.use(authenticate);

router.post("/summarize", validateBody(aiSummarizeSchema), aiController.summarize);
router.post("/classify", validateBody(aiClassifySchema), aiController.classify);

export default router;

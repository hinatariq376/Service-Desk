import { Router } from "express";
import * as authController from "../controllers/authController.js";
import { validateBody } from "../middleware/validate.js";
import { authenticate } from "../middleware/auth.js";
import { registerSchema, loginSchema, refreshTokenSchema } from "../validators/index.js";

const router = Router();

router.post("/register", validateBody(registerSchema), authController.register);
router.post("/login", validateBody(loginSchema), authController.login);
router.post("/refresh", validateBody(refreshTokenSchema), authController.refresh);
router.post("/logout", authController.logout);
router.get("/me", authenticate, authController.getProfile);

export default router;

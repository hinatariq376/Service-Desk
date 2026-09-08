import { Router } from "express";
import authRoutes from "./authRoutes.js";
import ticketRoutes from "./ticketRoutes.js";
import dashboardRoutes from "./dashboardRoutes.js";
import auditRoutes from "./auditRoutes.js";
import aiRoutes from "./aiRoutes.js";
import userRoutes from "./userRoutes.js";

const apiRouter = Router();

apiRouter.use("/auth", authRoutes);
apiRouter.use("/tickets", ticketRoutes);
apiRouter.use("/dashboard", dashboardRoutes);
apiRouter.use("/audit-logs", auditRoutes);
apiRouter.use("/ai", aiRoutes);
apiRouter.use("/users", userRoutes);

export default apiRouter;

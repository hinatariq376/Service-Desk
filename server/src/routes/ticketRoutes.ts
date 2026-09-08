import { Router } from "express";
import * as ticketController from "../controllers/ticketController.js";
import * as commentController from "../controllers/commentController.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { validateBody, validateQuery } from "../middleware/validate.js";
import {
  createTicketSchema,
  updateTicketSchema,
  transitionStatusSchema,
  assignTicketSchema,
  addCommentSchema,
  ticketQuerySchema,
} from "../validators/index.js";

const router = Router();

// All ticket routes require authentication
router.use(authenticate);

router.get("/", validateQuery(ticketQuerySchema), ticketController.getTickets);
router.post("/", validateBody(createTicketSchema), ticketController.createTicket);

router.get("/:id", ticketController.getTicket);
router.patch("/:id", validateBody(updateTicketSchema), ticketController.updateTicket);
router.delete("/:id", requireRole("ADMIN"), ticketController.deleteTicket);

// Status State Machine transition endpoint
router.post("/:id/status", validateBody(transitionStatusSchema), ticketController.updateStatus);

// Agent Assignment endpoint (Admin only)
router.post("/:id/assign", requireRole("ADMIN"), validateBody(assignTicketSchema), ticketController.assignTicket);

// Comments endpoints
router.post("/:id/comments", validateBody(addCommentSchema), commentController.addComment);
router.get("/:id/comments", commentController.getComments);

export default router;

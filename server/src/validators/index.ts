import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["CUSTOMER", "SUPPORT_AGENT", "ADMIN"]).default("CUSTOMER"),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
});

export const createTicketSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters").max(200),
  description: z.string().min(10, "Description must be at least 10 characters"),
  category: z.string().min(1, "Category is required").default("General"),
  priority: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]).default("MEDIUM"),
  tags: z.array(z.string()).optional().default([]),
  attachments: z.array(z.string()).optional().default([]),
});

export const updateTicketSchema = z.object({
  title: z.string().min(5).max(200).optional(),
  description: z.string().min(10).optional(),
  category: z.string().optional(),
  priority: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]).optional(),
  tags: z.array(z.string()).optional(),
  attachments: z.array(z.string()).optional(),
});

export const transitionStatusSchema = z.object({
  status: z.enum([
    "OPEN",
    "TRIAGED",
    "ASSIGNED",
    "IN_PROGRESS",
    "WAITING_FOR_CUSTOMER",
    "RESOLVED",
    "CLOSED",
  ]),
});

export const assignTicketSchema = z.object({
  agentId: z.string().min(1, "Agent ID is required"),
});

export const addCommentSchema = z.object({
  content: z.string().min(1, "Comment content cannot be empty"),
  isInternal: z.boolean().optional().default(false),
});

export const ticketQuerySchema = z.object({
  status: z.string().optional(),
  priority: z.string().optional(),
  category: z.string().optional(),
  search: z.string().optional(),
  assignedAgentId: z.string().optional(),
  customerId: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.enum(["createdAt", "priority", "status", "displayId", "slaDeadline"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const aiSummarizeSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  comments: z.array(z.string()).optional().default([]),
});

export const aiClassifySchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
});

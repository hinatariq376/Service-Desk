import mongoose from "mongoose";
import { Ticket } from "../models/Ticket.js";
import { User } from "../models/User.js";
import type { TokenPayload } from "./authService.js";

export async function getDashboardSummary(user: TokenPayload) {
  const filter: any = { deletedAt: null };

  if (user.role === "CUSTOMER") {
    filter.customerId = new mongoose.Types.ObjectId(user.userId);
  } else if (user.role === "SUPPORT_AGENT") {
    filter.$or = [
      { assignedAgentId: new mongoose.Types.ObjectId(user.userId) },
      { assignedAgentId: null },
    ];
  }

  const [total, open, inProgress, resolved, closed, critical, slaBreaches] = await Promise.all([
    Ticket.countDocuments(filter),
    Ticket.countDocuments({ ...filter, status: "OPEN" }),
    Ticket.countDocuments({ ...filter, status: "IN_PROGRESS" }),
    Ticket.countDocuments({ ...filter, status: "RESOLVED" }),
    Ticket.countDocuments({ ...filter, status: "CLOSED" }),
    Ticket.countDocuments({ ...filter, priority: "CRITICAL" }),
    Ticket.countDocuments({ ...filter, slaBreach: true }),
  ]);

  return {
    total,
    open,
    inProgress,
    resolved,
    closed,
    critical,
    slaBreaches,
    active: open + inProgress,
  };
}

export async function getDashboardAnalytics(user: TokenPayload) {
  const matchFilter: any = { deletedAt: null };

  if (user.role === "CUSTOMER") {
    matchFilter.customerId = new mongoose.Types.ObjectId(user.userId);
  } else if (user.role === "SUPPORT_AGENT") {
    matchFilter.$or = [
      { assignedAgentId: new mongoose.Types.ObjectId(user.userId) },
      { assignedAgentId: null },
    ];
  }

  const [
    priorityStats,
    statusStats,
    categoryStats,
    agentStats,
    summary,
    resolvedTickets,
  ] = await Promise.all([
    // Tickets by priority
    Ticket.aggregate([
      { $match: matchFilter },
      { $group: { _id: "$priority", count: { $sum: 1 } } },
    ]),
    // Tickets by status
    Ticket.aggregate([
      { $match: matchFilter },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    // Tickets by category
    Ticket.aggregate([
      { $match: matchFilter },
      { $group: { _id: "$category", count: { $sum: 1 } } },
    ]),
    // Tickets by assigned agent
    Ticket.aggregate([
      { $match: { ...matchFilter, assignedAgentId: { $ne: null } } },
      {
        $group: {
          _id: "$assignedAgentName",
          count: { $sum: 1 },
          breachedCount: { $sum: { $cond: ["$slaBreach", 1, 0] } },
        },
      },
    ]),
    getDashboardSummary(user),
    // For Average Resolution Time
    Ticket.find({
      ...matchFilter,
      status: { $in: ["RESOLVED", "CLOSED"] },
    })
      .select("createdAt updatedAt")
      .limit(500),
  ]);

  // Compute average resolution time in hours
  let avgResolutionHours = 0;
  if (resolvedTickets.length > 0) {
    const totalMs = resolvedTickets.reduce((acc, t) => {
      const created = new Date(t.createdAt).getTime();
      const resolved = new Date(t.updatedAt).getTime();
      return acc + Math.max(0, resolved - created);
    }, 0);
    avgResolutionHours = Number((totalMs / resolvedTickets.length / (1000 * 60 * 60)).toFixed(1));
  }

  // Format priority counts
  const priorityMap: Record<string, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  priorityStats.forEach((p) => {
    if (p._id) priorityMap[p._id] = p.count;
  });

  const statusMap: Record<string, number> = {};
  statusStats.forEach((s) => {
    if (s._id) statusMap[s._id] = s.count;
  });

  return {
    summary: {
      ...summary,
      avgResolutionHours,
      slaBreachRate: summary.total > 0 ? Number(((summary.slaBreaches / summary.total) * 100).toFixed(1)) : 0,
    },
    byPriority: Object.entries(priorityMap).map(([priority, count]) => ({
      priority,
      name: priority.charAt(0) + priority.slice(1).toLowerCase(),
      count,
    })),
    byStatus: Object.entries(statusMap).map(([status, count]) => ({
      status,
      name: status.replace(/_/g, " "),
      count,
    })),
    byCategory: categoryStats.map((c) => ({
      category: c._id || "General",
      count: c.count,
    })),
    byAgent: agentStats.map((a) => ({
      agentName: a._id || "Unassigned",
      count: a.count,
      breachedCount: a.breachedCount,
    })),
  };
}

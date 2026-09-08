import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { config } from "../src/config/index.js";
import { User, type UserRole } from "../src/models/User.js";
import { Ticket, type TicketPriority, type TicketStatus } from "../src/models/Ticket.js";
import { Comment } from "../src/models/Comment.js";
import { AuditLog } from "../src/models/AuditLog.js";
import { computeSLADeadlines } from "../src/services/slaService.js";

const isPerf = process.argv.includes("--perf");

const DEMO_USERS = [
  { name: "Customer Alice", email: "customer@servicedesk.com", role: "CUSTOMER" as UserRole, password: "DemoPassword123!" },
  { name: "Hina Tariq", email: "hina@servicedesk.com", role: "CUSTOMER" as UserRole, password: "DemoPassword123!" },
  { name: "Support Agent Alex", email: "agent@servicedesk.com", role: "SUPPORT_AGENT" as UserRole, password: "DemoPassword123!" },
  { name: "Support Agent Sarah", email: "sarah@servicedesk.com", role: "SUPPORT_AGENT" as UserRole, password: "DemoPassword123!" },
  { name: "System Admin Omar", email: "admin@servicedesk.com", role: "ADMIN" as UserRole, password: "DemoPassword123!" },
];

const CATEGORIES = ["Infrastructure", "Authentication", "Billing", "UI Bug", "Data Export", "Integrations", "API Error"];
const PRIORITIES: TicketPriority[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
const STATUSES: TicketStatus[] = ["OPEN", "TRIAGED", "ASSIGNED", "IN_PROGRESS", "WAITING_FOR_CUSTOMER", "RESOLVED", "CLOSED"];

async function runSeed() {
  console.log(`Connecting to MongoDB at ${config.mongoUri}…`);
  await mongoose.connect(config.mongoUri);

  console.log("Cleaning existing collections…");
  await Promise.all([
    User.deleteMany({}),
    Ticket.deleteMany({}),
    Comment.deleteMany({}),
    AuditLog.deleteMany({}),
  ]);

  console.log("Seeding Demo Users…");
  const users = await Promise.all(
    DEMO_USERS.map(async (u) => {
      const user = new User(u);
      return user.save();
    })
  );

  const customer = users.find((u) => u.role === "CUSTOMER")!;
  const agent = users.find((u) => u.role === "SUPPORT_AGENT")!;
  const admin = users.find((u) => u.role === "ADMIN")!;

  console.log("Users created successfully:");
  users.forEach((u) => console.log(` - [${u.role}] ${u.email}`));

  const ticketCount = isPerf ? 10000 : 50;
  console.log(`\nGenerating ${ticketCount} tickets (Performance Mode: ${isPerf})…`);

  const ticketsToInsert: any[] = [];
  const auditLogsToInsert: any[] = [];

  const startTime = Date.now();

  for (let i = 1; i <= ticketCount; i++) {
    const priority = PRIORITIES[Math.floor(Math.random() * PRIORITIES.length)];
    const status = STATUSES[Math.floor(Math.random() * STATUSES.length)];
    const category = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
    const displayId = `TCK-${String(i).padStart(6, "0")}`;

    const createdDate = new Date(Date.now() - Math.floor(Math.random() * 30 * 24 * 3600 * 1000));
    const sla = computeSLADeadlines(priority, createdDate);
    const isAssigned = status !== "OPEN" && status !== "TRIAGED";

    const ticketDoc = {
      displayId,
      title: `Service issue #${i}: ${category} failure in module ${i % 12}`,
      description: `Automated telemetry flagged intermittent latency and HTTP errors during processing of batch #${i}. Requires investigation.`,
      category,
      priority,
      status,
      customerId: customer._id,
      customerName: customer.name,
      assignedAgentId: isAssigned ? agent._id : null,
      assignedAgentName: isAssigned ? agent.name : null,
      slaResponseDeadline: sla.slaResponseDeadline,
      slaResolutionDeadline: sla.slaResolutionDeadline,
      slaDeadline: sla.slaDeadline,
      slaBreach: sla.slaDeadline.getTime() < Date.now() && !["RESOLVED", "CLOSED"].includes(status),
      tags: [category.toLowerCase(), priority.toLowerCase()],
      attachments: [],
      deletedAt: null,
      createdAt: createdDate,
      updatedAt: createdDate,
    };

    ticketsToInsert.push(ticketDoc);

    if (i <= 200) {
      auditLogsToInsert.push({
        actorId: customer._id,
        actorName: customer.name,
        actorRole: customer.role,
        action: "TICKET_CREATED",
        entity: "Ticket",
        entityId: displayId,
        newValue: { priority, status },
        timestamp: createdDate,
      });
    }

    if (ticketsToInsert.length === 1000) {
      await Ticket.insertMany(ticketsToInsert);
      ticketsToInsert.length = 0;
      process.stdout.write(`Inserted ${i}/${ticketCount} tickets…\r`);
    }
  }

  if (ticketsToInsert.length > 0) {
    await Ticket.insertMany(ticketsToInsert);
  }

  if (auditLogsToInsert.length > 0) {
    await AuditLog.insertMany(auditLogsToInsert);
  }

  const durationMs = Date.now() - startTime;
  console.log(`\n Successfully seeded ${ticketCount} tickets in ${(durationMs / 1000).toFixed(2)}s.`);

  if (isPerf) {
    console.log("\n=== PERFORMANCE BENCHMARK CHALLENGE (Section 20) ===");

    // Benchmark 1: Indexed compound pagination query
    const t0 = performance.now();
    const paginated = await Ticket.find({ customerId: customer._id, deletedAt: null })
      .sort({ createdAt: -1 })
      .skip(0)
      .limit(20)
      .lean();
    const t1 = performance.now();
    console.log(`1. Indexed Customer Queue Pagination (20 of ${ticketCount} tickets): ${(t1 - t0).toFixed(2)} ms (Returned: ${paginated.length})`);

    // Benchmark 2: Indexed Multi-field Filter Query (Status + Priority)
    const t2 = performance.now();
    const filtered = await Ticket.find({ status: "IN_PROGRESS", priority: "CRITICAL", deletedAt: null })
      .limit(50)
      .lean();
    const t3 = performance.now();
    console.log(`2. Compound Index Filter Query (IN_PROGRESS + CRITICAL): ${(t3 - t2).toFixed(2)} ms (Returned: ${filtered.length})`);

    // Benchmark 3: Analytics Aggregation Pipeline
    const t4 = performance.now();
    const agg = await Ticket.aggregate([
      { $match: { deletedAt: null } },
      { $group: { _id: "$priority", count: { $sum: 1 }, breaches: { $sum: { $cond: ["$slaBreach", 1, 0] } } } },
    ]);
    const t5 = performance.now();
    console.log(`3. Dashboard Analytics Aggregation across ${ticketCount} records: ${(t5 - t4).toFixed(2)} ms`);
    console.log("   Aggregation breakdown:", JSON.stringify(agg));
  }

  await mongoose.disconnect();
  console.log("\nSeeding finished successfully.");
}

runSeed().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});

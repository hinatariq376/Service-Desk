import { config } from "../config/index.js";
import type { TicketPriority } from "../models/Ticket.js";

export interface IAIService {
  summarizeTicket(title: string, description: string, comments?: string[]): Promise<string>;
  classifyTicket(
    title: string,
    description: string
  ): Promise<{ category: string; priority: TicketPriority; suggestedResponse: string }>;
}

class HeuristicAIService implements IAIService {
  async summarizeTicket(title: string, description: string, comments: string[] = []): Promise<string> {
    const mainIssue = description.split(".")[0] || description;
    const commentSummary =
      comments.length > 0
        ? ` Recent updates include ${comments.length} follow-up communication(s).`
        : "";
    return `Issue Summary: Customer is reporting "${title}". Core problem: ${mainIssue.trim()}.${commentSummary}`;
  }

  async classifyTicket(
    title: string,
    description: string
  ): Promise<{ category: string; priority: TicketPriority; suggestedResponse: string }> {
    const text = `${title} ${description}`.toLowerCase();

    let category = "General";
    let priority: TicketPriority = "MEDIUM";
    let suggestedResponse = "Thank you for reaching out. We have logged your request and an engineer will investigate shortly.";

    if (text.includes("down") || text.includes("outage") || text.includes("500") || text.includes("crash") || text.includes("data loss")) {
      category = "Infrastructure";
      priority = "CRITICAL";
      suggestedResponse = "We have escalated this critical system issue to our on-call infrastructure engineering team immediately. We are investigating server telemetry.";
    } else if (text.includes("payment") || text.includes("invoice") || text.includes("billing") || text.includes("stripe") || text.includes("charged")) {
      category = "Billing";
      priority = "HIGH";
      suggestedResponse = "Our billing operations team is reviewing your transaction history and account records to resolve any discrepancy.";
    } else if (text.includes("login") || text.includes("auth") || text.includes("password") || text.includes("sso") || text.includes("2fa")) {
      category = "Authentication";
      priority = "HIGH";
      suggestedResponse = "We are checking authentication logs and identity provider sync to assist with your access issue.";
    } else if (text.includes("ui") || text.includes("button") || text.includes("display") || text.includes("css") || text.includes("layout")) {
      category = "UI Bug";
      priority = "LOW";
      suggestedResponse = "Thank you for highlighting this UI behavior. We have logged this with our frontend team for the upcoming sprint release.";
    }

    return { category, priority, suggestedResponse };
  }
}

export const aiService: IAIService = new HeuristicAIService();

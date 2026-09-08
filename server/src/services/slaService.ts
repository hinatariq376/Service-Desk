import { config } from "../config/index.js";
import type { TicketPriority } from "../models/Ticket.js";

export interface SLADeadlineResult {
  slaResponseDeadline: Date;
  slaResolutionDeadline: Date;
  slaDeadline: Date;
}

export function computeSLADeadlines(priority: TicketPriority, startTime: Date = new Date()): SLADeadlineResult {
  const policy = config.slaPolicies[priority] ?? config.slaPolicies.MEDIUM;

  const responseDeadline = new Date(startTime.getTime() + policy.responseMinutes * 60 * 1000);
  const resolutionDeadline = new Date(startTime.getTime() + policy.resolutionHours * 60 * 60 * 1000);

  return {
    slaResponseDeadline: responseDeadline,
    slaResolutionDeadline: resolutionDeadline,
    slaDeadline: resolutionDeadline,
  };
}

export function isSLABreached(deadline: Date, currentBreachFlag: boolean = false): boolean {
  if (currentBreachFlag) return true;
  return new Date(deadline).getTime() < Date.now();
}

export function calculateRemainingTime(deadline: Date): {
  remainingMs: number;
  formatted: string;
  isBreached: boolean;
} {
  const remainingMs = new Date(deadline).getTime() - Date.now();
  const isBreached = remainingMs <= 0;

  const totalSecs = Math.max(0, Math.floor(Math.abs(remainingMs) / 1000));
  const hours = String(Math.floor(totalSecs / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((totalSecs % 3600) / 60)).padStart(2, "0");
  const seconds = String(totalSecs % 60).padStart(2, "0");

  const formatted = `${hours}:${minutes}:${seconds}`;

  return {
    remainingMs,
    formatted: isBreached ? `-${formatted}` : formatted,
    isBreached,
  };
}

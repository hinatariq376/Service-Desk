import type { Priority } from "../types";

export interface SLAPolicy {
  responseMinutes: number;
  resolutionHours: number;
}

export const SLA_POLICIES: Record<Priority, SLAPolicy> = {
  CRITICAL: { responseMinutes: 15, resolutionHours: 4 },
  HIGH: { responseMinutes: 60, resolutionHours: 8 },
  MEDIUM: { responseMinutes: 240, resolutionHours: 24 },
  LOW: { responseMinutes: 480, resolutionHours: 72 },
};

export function computeSLADeadlines(priority: Priority, createdAt = new Date()) {
  const policy = SLA_POLICIES[priority];
  const responseDeadline = new Date(createdAt.getTime() + policy.responseMinutes * 60 * 1000);
  const resolutionDeadline = new Date(createdAt.getTime() + policy.resolutionHours * 60 * 60 * 1000);
  return {
    slaResponseDeadline: responseDeadline.toISOString(),
    slaResolutionDeadline: resolutionDeadline.toISOString(),
    slaDeadline: resolutionDeadline.toISOString(),
  };
}

export function isSLABreached(deadline: string, breachFlag = false): boolean {
  if (breachFlag) return true;
  return new Date(deadline).getTime() <= Date.now();
}

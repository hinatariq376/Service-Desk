import { supabase } from "../lib/supabase";
import { mapUser } from "../lib/mappers";
import { MOCK_USERS } from "../data/mockData";
import type { Role, User } from "../types";

export async function fetchAllUsers(): Promise<User[]> {
  try {
    const { data, error } = await supabase.from("users").select("*").order("name");
    if (error) {
      console.warn("fetchAllUsers query warning:", error.message);
      return [];
    }
    if (data && Array.isArray(data)) return data.map(mapUser);
  } catch (err) {
    console.error("fetchAllUsers exception:", err);
  }
  return [];
}

export async function fetchSupportAgents(onlyApproved = true): Promise<User[]> {
  try {
    let query = supabase
      .from("users")
      .select("*")
      .or("role.eq.SUPPORT_AGENT,role.eq.support_agent,role.ilike.SUPPORT_AGENT")
      .order("name");

    if (onlyApproved) {
      query = query.or("is_approved.is.null,is_approved.eq.true");
    }

    const { data, error } = await query;
    if (error) {
      console.warn("fetchSupportAgents query warning:", error.message);
      return [];
    }
    if (data && Array.isArray(data)) {
      return data.map(mapUser).filter((u) => !onlyApproved || u.isApproved !== false);
    }
  } catch (err) {
    console.error("fetchSupportAgents exception:", err);
  }
  return [];
}

export async function fetchUserProfile(userId: string): Promise<User | null> {
  try {
    const { data, error } = await supabase.from("users").select("*").eq("id", userId).maybeSingle();
    if (error) {
      console.warn("fetchUserProfile query warning:", error.message);
    }
    if (data) return mapUser(data);
  } catch (err) {
    console.error("fetchUserProfile exception:", err);
  }
  return null;
}

export async function upsertUserProfile(params: {
  id: string;
  name: string;
  email: string;
  role: Role;
  isApproved?: boolean;
}) {
  const isApproved = params.isApproved ?? (params.role !== "SUPPORT_AGENT");
  try {
    const { error } = await supabase.from("users").upsert({
      id: params.id,
      name: params.name,
      email: params.email,
      role: params.role,
      is_approved: isApproved,
    });
    if (error) throw new Error(error.message);
  } catch (_) {
    const existing = MOCK_USERS.find((u) => u.id === params.id || u.email === params.email);
    if (!existing) {
      MOCK_USERS.push({
        id: params.id,
        name: params.name,
        email: params.email,
        role: params.role,
        isApproved,
      });
    } else {
      existing.isApproved = isApproved;
    }
  }
}

export async function approveAgent(userId: string): Promise<{ error?: string }> {
  try {
    const { error } = await supabase
      .from("users")
      .update({ is_approved: true, approval_status: "APPROVED" } as any)
      .eq("id", userId);
    if (error) {
      // Fallback if approval_status column doesn't exist yet
      await supabase.from("users").update({ is_approved: true }).eq("id", userId);
    }
    const mock = MOCK_USERS.find((u) => u.id === userId);
    if (mock) {
      mock.isApproved = true;
      mock.approvalStatus = "APPROVED";
    }
    return {};
  } catch (err) {
    const mock = MOCK_USERS.find((u) => u.id === userId);
    if (mock) {
      mock.isApproved = true;
      mock.approvalStatus = "APPROVED";
      return {};
    }
    return { error: err instanceof Error ? err.message : "Failed to approve agent." };
  }
}

export async function denyAgent(userId: string): Promise<{ error?: string }> {
  try {
    const { error } = await supabase
      .from("users")
      .update({ is_approved: false, approval_status: "DENIED" } as any)
      .eq("id", userId);
    if (error) {
      await supabase.from("users").update({ is_approved: false }).eq("id", userId);
    }
    const mock = MOCK_USERS.find((u) => u.id === userId);
    if (mock) {
      mock.isApproved = false;
      mock.approvalStatus = "DENIED";
    }
    return {};
  } catch (err) {
    const mock = MOCK_USERS.find((u) => u.id === userId);
    if (mock) {
      mock.isApproved = false;
      mock.approvalStatus = "DENIED";
      return {};
    }
    return { error: err instanceof Error ? err.message : "Failed to deny agent registration." };
  }
}

export async function unapproveAgent(_userId: string): Promise<{ error?: string }> {
  return { error: "Strict Permanent Approval Rule: Once approved, a Support Agent cannot be revoked or unapproved." };
}

export async function updateUserRole(_userId: string, _role: Role) {
  throw new Error("Changing user roles is disabled.");
}

export async function updatePassword(newPassword: string): Promise<{ error?: string }> {
  try {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { error: error.message };
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Password update failed." };
  }
}

export async function updateUserDisplayName(
  id: string,
  name: string,
): Promise<{ error?: string }> {
  try {
    const { error } = await supabase.from("users").update({ name }).eq("id", id);
    if (error) return { error: error.message };
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Profile update failed." };
  }
}

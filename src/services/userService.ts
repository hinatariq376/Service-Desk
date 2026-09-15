import { supabase } from "../lib/supabase";
import { mapUser } from "../lib/mappers";
import { MOCK_USERS } from "../data/mockData";
import type { Role, User } from "../types";

export async function fetchAllUsers(): Promise<User[]> {
  try {
    const { data, error } = await supabase.from("users").select("*").order("name");
    if (error) throw new Error(error.message);
    if (data && data.length > 0) return data.map(mapUser);
  } catch (_) {}
  return MOCK_USERS;
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
    if (error) throw new Error(error.message);
    if (data && data.length > 0) return data.map(mapUser).filter((u) => !onlyApproved || u.isApproved !== false);
  } catch (_) {}
  return MOCK_USERS.filter((u) => u.role === "SUPPORT_AGENT" && (!onlyApproved || u.isApproved !== false));
}

export async function fetchUserProfile(userId: string): Promise<User | null> {
  try {
    const { data, error } = await supabase.from("users").select("*").eq("id", userId).maybeSingle();
    if (error) throw new Error(error.message);
    if (data) return mapUser(data);
  } catch (_) {}
  return MOCK_USERS.find((u) => u.id === userId) || null;
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
      .update({ is_approved: true })
      .eq("id", userId);
    if (error) throw new Error(error.message);
    const mock = MOCK_USERS.find((u) => u.id === userId);
    if (mock) mock.isApproved = true;
    return {};
  } catch (err) {
    const mock = MOCK_USERS.find((u) => u.id === userId);
    if (mock) {
      mock.isApproved = true;
      return {};
    }
    return { error: err instanceof Error ? err.message : "Failed to approve agent." };
  }
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

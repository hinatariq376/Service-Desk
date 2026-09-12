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

export async function fetchSupportAgents(): Promise<User[]> {
  try {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("role", "SUPPORT_AGENT")
      .order("name");
    if (error) throw new Error(error.message);
    if (data && data.length > 0) return data.map(mapUser);
  } catch (_) {}
  return MOCK_USERS.filter((u) => u.role === "SUPPORT_AGENT");
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
}) {
  try {
    const { error } = await supabase.from("users").upsert({
      id: params.id,
      name: params.name,
      email: params.email,
      role: params.role,
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
      });
    }
  }
}

export async function updateUserRole(userId: string, role: Role) {
  try {
    const { error } = await supabase.from("users").update({ role }).eq("id", userId);
    if (error) throw new Error(error.message);
  } catch (_) {
    const user = MOCK_USERS.find((u) => u.id === userId);
    if (user) user.role = role;
  }
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

import { supabase } from "../lib/supabase";
import { mapUser } from "../lib/mappers";
import type { Role, User } from "../types";

export async function fetchAllUsers(): Promise<User[]> {
  const { data, error } = await supabase.from("users").select("*").order("name");
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapUser);
}

export async function fetchSupportAgents(): Promise<User[]> {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("role", "SUPPORT_AGENT")
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapUser);
}

export async function fetchUserProfile(userId: string): Promise<User | null> {
  const { data, error } = await supabase.from("users").select("*").eq("id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapUser(data) : null;
}

export async function upsertUserProfile(params: {
  id: string;
  name: string;
  email: string;
  role: Role;
}) {
  const { error } = await supabase.from("users").upsert({
    id: params.id,
    name: params.name,
    email: params.email,
    role: params.role,
  });
  if (error) throw new Error(error.message);
}

export async function updateUserRole(userId: string, role: Role) {
  const { error } = await supabase.from("users").update({ role }).eq("id", userId);
  if (error) throw new Error(error.message);
}

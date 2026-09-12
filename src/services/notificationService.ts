import { supabase } from "../lib/supabase";
import type { Notification } from "../types";

function mapNotification(row: {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  entity_id: string;
  is_read: boolean;
  created_at: string;
}): Notification {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type as Notification["type"],
    title: row.title,
    body: row.body,
    entityId: row.entity_id,
    isRead: row.is_read,
    createdAt: row.created_at,
  };
}

export async function fetchNotifications(userId: string): Promise<Notification[]> {
  try {
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.warn("fetchNotifications error:", error.message);
      return [];
    }
    if (data) return data.map(mapNotification);
  } catch (err) {
    console.warn("fetchNotifications exception:", err);
  }
  return [];
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  try {
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notificationId);
  } catch (_) {}
}

export async function markAllNotificationsRead(): Promise<void> {
  try {
    await supabase.rpc("mark_all_notifications_read");
  } catch (_) {}
}

export async function deleteNotification(notificationId: string): Promise<void> {
  try {
    await supabase.from("notifications").delete().eq("id", notificationId);
  } catch (_) {}
}

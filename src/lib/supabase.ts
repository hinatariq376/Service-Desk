import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

export const SUPABASE_URL = "https://mbykciicmzuwosyalmyx.supabase.co";
export const SUPABASE_KEY = "sb_publishable_IUsAzSwhV_ABPpXBVfZ18A_QVvbg926";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: { eventsPerSecond: 10 },
  },
});

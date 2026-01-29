import { createClient } from "@supabase/supabase-js";
import { env } from "../config";

// Backend deve usar SERVICE ROLE key (NUNCA publishable/anon).
export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
});

export const storageBucket = env.SUPABASE_STORAGE_BUCKET;


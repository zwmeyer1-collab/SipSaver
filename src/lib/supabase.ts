import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

function normalizeSupabaseUrl(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  try {
    const parsed = new URL(value);
    const normalizedPath = parsed.pathname.replace(/\/+$/, "");

    if (
      normalizedPath === "/rest/v1" ||
      normalizedPath === "/auth/v1" ||
      normalizedPath === "/storage/v1"
    ) {
      return parsed.origin;
    }

    return value;
  } catch {
    return value;
  }
}

const supabaseUrl = normalizeSupabaseUrl(import.meta.env.VITE_SUPABASE_URL);
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient<Database>(supabaseUrl as string, supabaseAnonKey as string)
  : null;

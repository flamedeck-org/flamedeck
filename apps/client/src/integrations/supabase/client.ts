import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// Read values from environment variables provided by Vite
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Add checks to ensure the variables are defined
if (!SUPABASE_URL) {
  throw new Error("Missing environment variable: VITE_SUPABASE_URL");
}
if (!SUPABASE_PUBLISHABLE_KEY) {
  throw new Error("Missing environment variable: VITE_SUPABASE_ANON_KEY");
}

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

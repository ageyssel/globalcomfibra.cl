import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getPublicSupabaseEnv } from "@/lib/env";

let client: SupabaseClient | undefined;

export function getSupabaseBrowserClient(): SupabaseClient {
  if (!client) {
    const { url, anonKey } = getPublicSupabaseEnv();
    client = createBrowserClient(url, anonKey);
  }
  return client;
}

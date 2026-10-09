import type { SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const accountsEnabled = !!(url && key);
let sb: Promise<SupabaseClient> | null = null;

function supabase() {
  // Loaded lazily so guests never download the auth SDK.
  sb ??= import("@supabase/supabase-js").then(({ createClient }) => createClient(url!, key!));
  return sb;
}

export async function getAccessToken(): Promise<string | null> {
  if (!accountsEnabled) return null;
  const { data } = await (await supabase()).auth.getSession();
  return data.session?.access_token ?? null;
}

export async function getEmail(): Promise<string | null> {
  if (!accountsEnabled) return null;
  const { data } = await (await supabase()).auth.getSession();
  return data.session?.user.email ?? null;
}

export async function sendMagicLink(email: string): Promise<string | null> {
  const { error } = await (await supabase()).auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin } });
  return error ? error.message : null;
}

export async function signOut() {
  if (accountsEnabled) await (await supabase()).auth.signOut();
}

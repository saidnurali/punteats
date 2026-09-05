import { supabase } from "./supabase";

export interface CurrentUserProfile {
  id: string;
  phone_number: string | null;
  full_name: string | null;
}

/**
 * Replaces every old `AsyncStorage.getItem('puntgo_user_session')` read.
 * Pulls identity from the real Supabase Auth session (auth.uid()) plus
 * the matching profiles row. Returns null if there is no active session
 * or no matching profile.
 */
export async function getCurrentUser(): Promise<CurrentUserProfile | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, phone_number, full_name")
    .eq("id", session.user.id)
    .maybeSingle();

  if (error || !data) return null;
  return data as CurrentUserProfile;
}

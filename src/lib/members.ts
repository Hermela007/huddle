import { supabase } from "./supabase";

export type Member = { userId: string; displayName: string };

type MemberRow = { user_id: string; profiles: { display_name: string } | null };

// A trip's members, always in JOIN ORDER (oldest first)
export async function fetchMembers(tripId: string): Promise<Member[]> {
  const { data, error } = await supabase
    .from("trip_members")
    .select("user_id, profiles(display_name)")
    .eq("trip_id", tripId)
    .order("joined_at");

  if (error) throw error;

  return ((data ?? []) as unknown as MemberRow[]).map((row) => ({
    userId: row.user_id,
    displayName: row.profiles?.display_name ?? "Unknown",
  }));
}
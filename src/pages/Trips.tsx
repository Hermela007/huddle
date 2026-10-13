import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { supabase } from "../lib/supabase";

export function Trips() {
  const { session } = useAuth();
  const [displayName, setDisplayName] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    supabase
      .from("profiles")
      .select("display_name")
      .eq("id", session.user.id)
      .single()
      .then(({ data }) => setDisplayName(data?.display_name ?? null));
  }, [session]);

  return (
    <main>
      <h1>My trips</h1>
      <p>Logged in as {displayName ?? session?.user.email}</p>
      <button onClick={() => supabase.auth.signOut()}>Log out</button>
    </main>
  );
}
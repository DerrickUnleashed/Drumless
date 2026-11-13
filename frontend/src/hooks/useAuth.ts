import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { setAccessToken, supabase } from "../lib/supabase";

export interface AuthState {
  configured: boolean;
  loading: boolean;
  session: Session | null;
  signOut: () => Promise<void>;
}

export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(supabase !== null);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let mounted = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!mounted) {
        return;
      }
      setAccessToken(data.session?.access_token ?? null);
      setSession(data.session);
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        setAccessToken(nextSession?.access_token ?? null);
        setSession(nextSession);
        setLoading(false);
      },
    );

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) {
      return;
    }
    await supabase.auth.signOut();
    setAccessToken(null);
    setSession(null);
  }, []);

  return {
    configured: supabase !== null,
    loading,
    session,
    signOut,
  };
}

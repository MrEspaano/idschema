import { ReactNode, useCallback, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { AuthContext } from "./AuthContext";

interface AuthProviderProps {
  children: ReactNode;
}

const DEFAULT_ADMIN_EMAILS = ["erik.espemyr@falkoping.se"];

const sanitizeEnvValue = (value: unknown): string => {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().replace(/^['"`](.*)['"`]$/, "$1").trim();
};

const getAdminEmailAllowlist = (): Set<string> => {
  const raw = sanitizeEnvValue(import.meta.env.VITE_ADMIN_EMAILS);
  const envEmails = raw
    .split(/[;,\s]+/)
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  return new Set([...DEFAULT_ADMIN_EMAILS.map((email) => email.toLowerCase()), ...envEmails]);
};

const ADMIN_EMAIL_ALLOWLIST = getAdminEmailAllowlist();

const isWhitelistedAdmin = (user: User): boolean => {
  const email = user.email?.toLowerCase();
  return Boolean(email && ADMIN_EMAIL_ALLOWLIST.has(email));
};

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const checkAdmin = useCallback(async (currentUser: User): Promise<boolean> => {
    if (isWhitelistedAdmin(currentUser)) {
      return true;
    }

    const { data: hasRoleData, error: hasRoleError } = await supabase.rpc("has_role", {
      _role: "admin",
      _user_id: currentUser.id,
    });

    if (!hasRoleError && hasRoleData === true) {
      return true;
    }

    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", currentUser.id)
      .eq("role", "admin")
      .maybeSingle();

    if (roleError) {
      console.error("Failed to verify admin role:", roleError.message);
    }

    return Boolean(roleData);
  }, []);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, currentSession) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);

      if (currentSession?.user) {
        const admin = await checkAdmin(currentSession.user);
        setIsAdmin(admin);
      } else {
        setIsAdmin(false);
      }

      setLoading(false);
    });

    const initializeSession = async () => {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();

      setSession(currentSession);
      setUser(currentSession?.user ?? null);

      if (currentSession?.user) {
        const admin = await checkAdmin(currentSession.user);
        setIsAdmin(admin);
      } else {
        setIsAdmin(false);
      }

      setLoading(false);
    };

    initializeSession();

    return () => subscription.unsubscribe();
  }, [checkAdmin]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setIsAdmin(false);
  };

  return (
    <AuthContext.Provider value={{ user, session, isAdmin, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

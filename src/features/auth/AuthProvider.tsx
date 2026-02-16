import { ReactNode, useCallback, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { SUPABASE_CONFIG, supabase } from "@/integrations/supabase/client";
import { AuthContext } from "./AuthContext";

interface AuthProviderProps {
  children: ReactNode;
}

const DEFAULT_ADMIN_EMAILS = ["erik.espemyr@falkoping.se"];
const PRIMARY_SIGN_IN_TIMEOUT_MS = 12_000;
const FALLBACK_SIGN_IN_TIMEOUT_MS = 12_000;
const ADMIN_CHECK_TIMEOUT_MS = 8_000;
const NETWORK_SIGN_IN_ERROR_CODE = "AUTH_SERVICE_UNAVAILABLE";

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

const toError = (error: unknown, fallbackMessage: string): Error => {
  if (error instanceof Error) {
    return error;
  }

  return new Error(fallbackMessage);
};

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutCode: string,
): Promise<T> {
  let timeoutId: number | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(timeoutCode)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
    }
  }
}

const isNetworkLikeError = (error: unknown): boolean => {
  const normalized = toError(error, "").message.toLowerCase();

  return (
    normalized.includes("auth_timeout") ||
    normalized.includes("timeout") ||
    normalized.includes("abort") ||
    normalized.includes("failed to fetch") ||
    normalized.includes("network request failed") ||
    normalized.includes("networkerror")
  );
};

const getAuthPayloadMessage = (payload: unknown): string => {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const data = payload as Record<string, unknown>;
  const candidates = [data.error_description, data.msg, data.message, data.error];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return "";
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

    try {
      const { data: hasRoleData, error: hasRoleError } = await withTimeout(
        supabase.rpc("has_role", {
          _role: "admin",
          _user_id: currentUser.id,
        }),
        ADMIN_CHECK_TIMEOUT_MS,
        "AUTH_TIMEOUT_ADMIN_RPC",
      );

      if (!hasRoleError && hasRoleData === true) {
        return true;
      }
    } catch (error) {
      console.warn("Admin role RPC timed out or failed:", toError(error, "unknown").message);
    }

    try {
      const { data: roleData, error: roleError } = await withTimeout(
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", currentUser.id)
          .eq("role", "admin")
          .maybeSingle(),
        ADMIN_CHECK_TIMEOUT_MS,
        "AUTH_TIMEOUT_ADMIN_QUERY",
      );

      if (roleError) {
        console.error("Failed to verify admin role:", roleError.message);
      }

      return Boolean(roleData);
    } catch (error) {
      console.warn("Admin role lookup timed out or failed:", toError(error, "unknown").message);
      return false;
    }
  }, []);

  const signInWithRestFallback = useCallback(async (email: string, password: string) => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), FALLBACK_SIGN_IN_TIMEOUT_MS);

    try {
      const response = await fetch(`${SUPABASE_CONFIG.url}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_CONFIG.publishableKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
        signal: controller.signal,
      });

      let payload: unknown = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }

      if (!response.ok) {
        const fallbackMessage = getAuthPayloadMessage(payload);
        return new Error(fallbackMessage || `Auth fallback failed (${response.status})`);
      }

      const payloadRecord = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null;
      const accessToken = typeof payloadRecord?.access_token === "string" ? payloadRecord.access_token : "";
      const refreshToken = typeof payloadRecord?.refresh_token === "string" ? payloadRecord.refresh_token : "";

      if (!accessToken || !refreshToken) {
        return new Error("Auth fallback response saknar giltiga tokens.");
      }

      const { error: setSessionError } = await withTimeout(
        supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        }),
        PRIMARY_SIGN_IN_TIMEOUT_MS,
        "AUTH_TIMEOUT_SET_SESSION",
      );

      if (setSessionError) {
        return setSessionError as Error;
      }

      return null;
    } catch (error) {
      if (isNetworkLikeError(error)) {
        return new Error(NETWORK_SIGN_IN_ERROR_CODE);
      }

      return toError(error, "Inloggningen misslyckades.");
    } finally {
      window.clearTimeout(timeout);
    }
  }, []);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, currentSession) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);

      if (currentSession?.user) {
        let admin = false;
        try {
          admin = await checkAdmin(currentSession.user);
        } catch (error) {
          console.error("Failed to resolve admin permissions:", toError(error, "unknown").message);
        }

        setIsAdmin(admin);
      } else {
        setIsAdmin(false);
      }

      setLoading(false);
    });

    const initializeSession = async () => {
      try {
        const {
          data: { session: currentSession },
        } = await withTimeout(supabase.auth.getSession(), ADMIN_CHECK_TIMEOUT_MS, "AUTH_TIMEOUT_GET_SESSION");

        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        if (currentSession?.user) {
          let admin = false;
          try {
            admin = await checkAdmin(currentSession.user);
          } catch (error) {
            console.error("Failed to resolve admin permissions:", toError(error, "unknown").message);
          }

          setIsAdmin(admin);
        } else {
          setIsAdmin(false);
        }
      } catch (error) {
        console.error("Failed to initialize auth session:", toError(error, "unknown").message);
        setSession(null);
        setUser(null);
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    };

    initializeSession();

    return () => subscription.unsubscribe();
  }, [checkAdmin]);

  const signIn = async (email: string, password: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPassword = password;

    try {
      const { error } = await withTimeout(
        supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password: normalizedPassword,
        }),
        PRIMARY_SIGN_IN_TIMEOUT_MS,
        "AUTH_TIMEOUT_PRIMARY",
      );

      if (!error) {
        return { error: null };
      }

      if (!isNetworkLikeError(error)) {
        return { error: error as Error };
      }
    } catch (error) {
      if (!isNetworkLikeError(error)) {
        return { error: toError(error, "Inloggningen misslyckades.") };
      }
    }

    const fallbackError = await signInWithRestFallback(normalizedEmail, normalizedPassword);

    if (!fallbackError) {
      return { error: null };
    }

    return { error: fallbackError };
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

import { ReactNode, useCallback, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { SUPABASE_CONFIG, supabase } from "@/integrations/supabase/client";
import { AuthContext, type AdminAccessRole } from "./AuthContext";

interface AuthProviderProps {
  children: ReactNode;
}

interface SessionTokens {
  accessToken: string;
  refreshToken: string;
}

interface AdminAccess {
  isAdmin: boolean;
  role: AdminAccessRole;
}

const DEFAULT_ADMIN_EMAILS = ["erik.espemyr@falkoping.se"];
const PRIMARY_SIGN_IN_TIMEOUT_MS = 12_000;
const PROXY_SIGN_IN_TIMEOUT_MS = 12_000;
const DIRECT_FALLBACK_TIMEOUT_MS = 12_000;
const ADMIN_CHECK_TIMEOUT_MS = 8_000;
const NETWORK_SIGN_IN_ERROR_CODE = "AUTH_SERVICE_UNAVAILABLE";
const PROXY_UNAVAILABLE_ERROR_CODE = "AUTH_PROXY_UNAVAILABLE";

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

const normalizeAdminRole = (value: unknown): AdminAccessRole => {
  const role = typeof value === "string" ? value.trim().toLowerCase() : "";

  if (role === "owner" || role === "editor" || role === "viewer") {
    return role;
  }

  if (role === "admin") {
    return "admin";
  }

  return "none";
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

const getSessionTokens = (payload: unknown): SessionTokens | null => {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const data = payload as Record<string, unknown>;
  const accessToken = typeof data.access_token === "string" ? data.access_token : "";
  const refreshToken = typeof data.refresh_token === "string" ? data.refresh_token : "";

  if (!accessToken || !refreshToken) {
    return null;
  }

  return { accessToken, refreshToken };
};

const isInfrastructureAuthError = (error: Error): boolean => {
  const normalized = error.message.toLowerCase();

  return (
    normalized.includes("auth_service_unavailable") ||
    normalized.includes("auth_proxy_unavailable") ||
    normalized.includes("auth_proxy_timeout") ||
    normalized.includes("auth_proxy_network_error") ||
    normalized.includes("failed to fetch") ||
    normalized.includes("network") ||
    normalized.includes("timeout")
  );
};

const resolveAdminFromRole = (role: AdminAccessRole): AdminAccess => {
  if (role === "owner" || role === "editor" || role === "admin") {
    return { isAdmin: true, role };
  }

  return { isAdmin: false, role };
};

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminRole, setAdminRole] = useState<AdminAccessRole>("none");
  const [loading, setLoading] = useState(true);

  const applySessionTokens = useCallback(async (tokens: SessionTokens): Promise<Error | null> => {
    const { error: setSessionError } = await withTimeout(
      supabase.auth.setSession({
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
      }),
      PRIMARY_SIGN_IN_TIMEOUT_MS,
      "AUTH_TIMEOUT_SET_SESSION",
    );

    if (setSessionError) {
      return setSessionError as Error;
    }

    return null;
  }, []);

  const checkAdminAccess = useCallback(async (currentUser: User): Promise<AdminAccess> => {
    if (isWhitelistedAdmin(currentUser)) {
      return { isAdmin: true, role: "owner" };
    }

    const currentEmail = currentUser.email?.toLowerCase() ?? "";

    if (currentEmail) {
      try {
        const { data, error } = await withTimeout(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase as any)
            .from("admin_users")
            .select("role,active")
            .eq("email", currentEmail)
            .eq("active", true)
            .maybeSingle(),
          ADMIN_CHECK_TIMEOUT_MS,
          "AUTH_TIMEOUT_ADMIN_USERS",
        );

        if (!error && data) {
          const role = normalizeAdminRole(data.role);
          if (role !== "none") {
            return resolveAdminFromRole(role);
          }
        }
      } catch (error) {
        console.warn("admin_users lookup timed out or failed:", toError(error, "unknown").message);
      }
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
        return { isAdmin: true, role: "admin" };
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

      if (roleData) {
        return { isAdmin: true, role: "admin" };
      }
    } catch (error) {
      console.warn("Admin role lookup timed out or failed:", toError(error, "unknown").message);
    }

    return { isAdmin: false, role: "none" };
  }, []);

  const signInWithProxyFallback = useCallback(
    async (email: string, password: string): Promise<Error | null> => {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), PROXY_SIGN_IN_TIMEOUT_MS);

      try {
        const response = await fetch("/api/auth/password-login", {
          method: "POST",
          headers: {
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

        if (response.status === 404 || response.status === 405) {
          return new Error(PROXY_UNAVAILABLE_ERROR_CODE);
        }

        if (!response.ok) {
          const message = getAuthPayloadMessage(payload);
          return new Error(message || `Auth proxy failed (${response.status})`);
        }

        const tokens = getSessionTokens(payload);
        if (!tokens) {
          return new Error("Auth proxy response saknar giltiga tokens.");
        }

        return await applySessionTokens(tokens);
      } catch (error) {
        if (isNetworkLikeError(error)) {
          return new Error(NETWORK_SIGN_IN_ERROR_CODE);
        }

        return toError(error, "Inloggningen misslyckades.");
      } finally {
        window.clearTimeout(timeout);
      }
    },
    [applySessionTokens],
  );

  const signInWithDirectFallback = useCallback(
    async (email: string, password: string): Promise<Error | null> => {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), DIRECT_FALLBACK_TIMEOUT_MS);

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

        const tokens = getSessionTokens(payload);
        if (!tokens) {
          return new Error("Auth fallback response saknar giltiga tokens.");
        }

        return await applySessionTokens(tokens);
      } catch (error) {
        if (isNetworkLikeError(error)) {
          return new Error(NETWORK_SIGN_IN_ERROR_CODE);
        }

        return toError(error, "Inloggningen misslyckades.");
      } finally {
        window.clearTimeout(timeout);
      }
    },
    [applySessionTokens],
  );

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, currentSession) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);

      if (currentSession?.user) {
        let access: AdminAccess = { isAdmin: false, role: "none" };

        try {
          access = await checkAdminAccess(currentSession.user);
        } catch (error) {
          console.error("Failed to resolve admin permissions:", toError(error, "unknown").message);
        }

        setIsAdmin(access.isAdmin);
        setAdminRole(access.role);
      } else {
        setIsAdmin(false);
        setAdminRole("none");
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
          let access: AdminAccess = { isAdmin: false, role: "none" };
          try {
            access = await checkAdminAccess(currentSession.user);
          } catch (error) {
            console.error("Failed to resolve admin permissions:", toError(error, "unknown").message);
          }

          setIsAdmin(access.isAdmin);
          setAdminRole(access.role);
        } else {
          setIsAdmin(false);
          setAdminRole("none");
        }
      } catch (error) {
        console.error("Failed to initialize auth session:", toError(error, "unknown").message);
        setSession(null);
        setUser(null);
        setIsAdmin(false);
        setAdminRole("none");
      } finally {
        setLoading(false);
      }
    };

    initializeSession();

    return () => subscription.unsubscribe();
  }, [checkAdminAccess]);

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

    const proxyError = await signInWithProxyFallback(normalizedEmail, normalizedPassword);
    if (!proxyError) {
      return { error: null };
    }

    if (!isInfrastructureAuthError(proxyError)) {
      return { error: proxyError };
    }

    const directFallbackError = await signInWithDirectFallback(normalizedEmail, normalizedPassword);
    if (!directFallbackError) {
      return { error: null };
    }

    return { error: directFallbackError };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setIsAdmin(false);
    setAdminRole("none");
  };

  return (
    <AuthContext.Provider value={{ user, session, isAdmin, adminRole, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

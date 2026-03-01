import { ReactNode, useCallback, useEffect, useState } from "react";
import { AuthContext, type AdminAccessRole, type AppSession, type AuthUser } from "./AuthContext";

interface AuthProviderProps {
  children: ReactNode;
}

interface SessionResponse {
  authenticated: boolean;
  user: AuthUser | null;
  role: AdminAccessRole;
  expiresAt?: string;
}

const toError = (error: unknown, fallbackMessage: string): Error => {
  if (error instanceof Error) {
    return error;
  }

  return new Error(fallbackMessage);
};

const roleIsAdmin = (role: AdminAccessRole): boolean => {
  return role === "owner" || role === "editor" || role === "admin";
};

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<AppSession | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminRole, setAdminRole] = useState<AdminAccessRole>("none");
  const [loading, setLoading] = useState(true);

  const loadSession = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/session", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      if (!response.ok) {
        setUser(null);
        setSession(null);
        setIsAdmin(false);
        setAdminRole("none");
        return;
      }

      const payload = (await response.json()) as SessionResponse;

      if (!payload.authenticated || !payload.user) {
        setUser(null);
        setSession(null);
        setIsAdmin(false);
        setAdminRole("none");
        return;
      }

      const resolvedRole = payload.role ?? "none";

      setUser(payload.user);
      setSession(payload.expiresAt ? { expiresAt: payload.expiresAt } : null);
      setAdminRole(resolvedRole);
      setIsAdmin(roleIsAdmin(resolvedRole));
    } catch {
      setUser(null);
      setSession(null);
      setIsAdmin(false);
      setAdminRole("none");
    }
  }, []);

  useEffect(() => {
    const initialize = async () => {
      await loadSession();
      setLoading(false);
    };

    initialize();
  }, [loadSession]);

  const signIn = async (email: string, password: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPassword = password.trim();

    if (!normalizedEmail || !normalizedPassword) {
      return { error: new Error("Fyll i e-post och lösenord.") };
    }

    try {
      const response = await fetch("/api/auth/password-login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ email: normalizedEmail, password: normalizedPassword }),
      });

      const payload = (await response.json().catch(() => ({}))) as { message?: string };

      if (!response.ok) {
        return { error: new Error(payload.message || "Inloggningen misslyckades.") };
      }

      await loadSession();
      return { error: null };
    } catch (error) {
      return { error: toError(error, "Kunde inte nå inloggningstjänsten.") };
    }
  };

  const signOut = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } finally {
      setUser(null);
      setSession(null);
      setIsAdmin(false);
      setAdminRole("none");
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, isAdmin, adminRole, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

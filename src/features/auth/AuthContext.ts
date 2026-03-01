import { createContext } from "react";

export type AdminAccessRole = "none" | "viewer" | "editor" | "owner" | "admin";

export interface AuthUser {
  id: string;
  email: string;
}

export interface AppSession {
  expiresAt: string;
}

export interface AuthContextType {
  user: AuthUser | null;
  session: AppSession | null;
  isAdmin: boolean;
  adminRole: AdminAccessRole;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

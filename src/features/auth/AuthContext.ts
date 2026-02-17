import { createContext } from "react";
import type { Session, User } from "@supabase/supabase-js";

export type AdminAccessRole = "none" | "viewer" | "editor" | "owner" | "admin";

export interface AuthContextType {
  user: User | null;
  session: Session | null;
  isAdmin: boolean;
  adminRole: AdminAccessRole;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

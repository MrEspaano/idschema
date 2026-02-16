import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const FALLBACK_SUPABASE_URL = "https://invalid.supabase.co";
const FALLBACK_SUPABASE_KEY = "invalid-key";
const REQUEST_TIMEOUT_MS = 25_000;

const sanitizeEnvValue = (value: unknown): string => {
  if (typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim();
  const unquoted = trimmed.replace(/^['"`](.*)['"`]$/, "$1");
  return unquoted.trim();
};

const isLikelyProjectRef = (value: string): boolean => /^[a-z0-9]{20}$/i.test(value);

const normalizeSupabaseUrl = (value: unknown): string => {
  const normalized = sanitizeEnvValue(value);

  if (!normalized) {
    return "";
  }

  if (/^https?:\/\//i.test(normalized)) {
    return normalized.replace(/\/+$/, "");
  }

  if (isLikelyProjectRef(normalized)) {
    return `https://${normalized}.supabase.co`;
  }

  return "";
};

const SUPABASE_URL =
  normalizeSupabaseUrl(import.meta.env.VITE_SUPABASE_URL) ||
  normalizeSupabaseUrl(import.meta.env.VITE_SUPABASE_PROJECT_ID);

const SUPABASE_PUBLISHABLE_KEY =
  sanitizeEnvValue(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) ||
  sanitizeEnvValue(import.meta.env.VITE_SUPABASE_ANON_KEY);

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  console.error(
    "Supabase environment variables are missing/invalid. Check VITE_SUPABASE_URL (or VITE_SUPABASE_PROJECT_ID) and VITE_SUPABASE_PUBLISHABLE_KEY in Vercel.",
  );
}

const fetchWithTimeout: typeof fetch = async (input, init = {}) => {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  if (init.signal) {
    if (init.signal.aborted) {
      controller.abort();
    } else {
      init.signal.addEventListener("abort", () => controller.abort(), { once: true });
    }
  }

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    globalThis.clearTimeout(timeout);
  }
};

export const supabase = createClient<Database>(
  SUPABASE_URL || FALLBACK_SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY || FALLBACK_SUPABASE_KEY,
  {
    auth: {
      storage: localStorage,
      persistSession: true,
      autoRefreshToken: true,
    },
    global: {
      fetch: fetchWithTimeout,
    },
  },
);

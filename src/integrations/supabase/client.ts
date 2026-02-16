import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const DEFAULT_SUPABASE_URL = "https://hkysxdvndmbfckhjhshf.supabase.co";
const DEFAULT_SUPABASE_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhreXN4ZHZuZG1iZmNraGpoc2hmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4MTQwNzksImV4cCI6MjA4NjM5MDA3OX0.gRbOqngPrXmnErtxDY1Jqgl1DPwLJ4DA1CBo7ORmJus";
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

const resolvedUrl =
  normalizeSupabaseUrl(import.meta.env.VITE_SUPABASE_URL) ||
  normalizeSupabaseUrl(import.meta.env.VITE_SUPABASE_PROJECT_ID);

const resolvedKey =
  sanitizeEnvValue(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) ||
  sanitizeEnvValue(import.meta.env.VITE_SUPABASE_ANON_KEY);

if (!resolvedUrl || !resolvedKey) {
  console.warn(
    "Supabase env saknas eller är felaktig. Fallback-värden används.",
  );
}

export const SUPABASE_CONFIG = {
  url: resolvedUrl || DEFAULT_SUPABASE_URL,
  publishableKey: resolvedKey || DEFAULT_SUPABASE_PUBLISHABLE_KEY,
} as const;

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
  SUPABASE_CONFIG.url,
  SUPABASE_CONFIG.publishableKey,
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

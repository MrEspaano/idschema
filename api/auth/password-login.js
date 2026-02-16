const DEFAULT_SUPABASE_URL = "https://hkysxdvndmbfckhjhshf.supabase.co";
const DEFAULT_SUPABASE_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhreXN4ZHZuZG1iZmNraGpoc2hmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4MTQwNzksImV4cCI6MjA4NjM5MDA3OX0.gRbOqngPrXmnErtxDY1Jqgl1DPwLJ4DA1CBo7ORmJus";
const REQUEST_TIMEOUT_MS = 12_000;

const sanitizeEnvValue = (value) => {
  if (typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim();
  const unquoted = trimmed.replace(/^['"`](.*)['"`]$/, "$1");
  return unquoted.trim();
};

const isLikelyProjectRef = (value) => /^[a-z0-9]{20}$/i.test(value);

const normalizeSupabaseUrl = (value) => {
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

const getSupabaseConfig = () => {
  const resolvedUrl =
    normalizeSupabaseUrl(process.env.SUPABASE_URL) ||
    normalizeSupabaseUrl(process.env.VITE_SUPABASE_URL) ||
    normalizeSupabaseUrl(process.env.SUPABASE_PROJECT_ID) ||
    normalizeSupabaseUrl(process.env.VITE_SUPABASE_PROJECT_ID);

  const resolvedKey =
    sanitizeEnvValue(process.env.SUPABASE_ANON_KEY) ||
    sanitizeEnvValue(process.env.VITE_SUPABASE_ANON_KEY) ||
    sanitizeEnvValue(process.env.SUPABASE_PUBLISHABLE_KEY) ||
    sanitizeEnvValue(process.env.VITE_SUPABASE_PUBLISHABLE_KEY);

  return {
    url: resolvedUrl || DEFAULT_SUPABASE_URL,
    publishableKey: resolvedKey || DEFAULT_SUPABASE_PUBLISHABLE_KEY,
  };
};

const parseJsonBody = (rawBody) => {
  if (!rawBody) {
    return null;
  }

  if (typeof rawBody === "object") {
    return rawBody;
  }

  if (typeof rawBody !== "string") {
    return null;
  }

  try {
    return JSON.parse(rawBody);
  } catch {
    return null;
  }
};

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.status(405).json({ message: "Method not allowed" });
    return;
  }

  const body = parseJsonBody(req.body);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!email || !password) {
    res.status(400).json({ message: "Missing email or password" });
    return;
  }

  const { url, publishableKey } = getSupabaseConfig();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        apikey: publishableKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
      signal: controller.signal,
    });

    const text = await response.text();
    let payload = {};

    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = { message: text };
      }
    }

    res.status(response.status).json(payload);
  } catch (error) {
    if (error && typeof error === "object" && error.name === "AbortError") {
      res.status(504).json({ message: "AUTH_PROXY_TIMEOUT" });
      return;
    }

    res.status(503).json({ message: "AUTH_PROXY_NETWORK_ERROR" });
  } finally {
    clearTimeout(timeout);
  }
};

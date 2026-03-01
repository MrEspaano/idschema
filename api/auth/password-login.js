import crypto from "node:crypto";

const COOKIE_NAME = "idschema_session";
const SESSION_DAYS = 7;

const toBase64Url = (input) => {
  const raw = Buffer.isBuffer(input) ? input.toString("base64") : Buffer.from(input).toString("base64");
  return raw.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
};

const hmacSha256 = (value, secret) => {
  return crypto.createHmac("sha256", secret).update(value).digest("base64url");
};

const parseUsers = () => {
  const raw = process.env.AUTH_USERS_JSON;
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((item) => item && typeof item === "object")
          .map((item) => ({
            email: String(item.email || "").trim().toLowerCase(),
            password: String(item.password || ""),
            role: String(item.role || "owner"),
          }))
          .filter((item) => item.email && item.password);
      }
    } catch {
      // fallback below
    }
  }

  const email = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const password = String(process.env.ADMIN_PASSWORD || "");
  const role = String(process.env.ADMIN_ROLE || "owner");

  if (email && password) {
    return [{ email, password, role }];
  }

  return [];
};

const buildToken = (payload, secret) => {
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = toBase64Url(JSON.stringify(header));
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const unsigned = `${encodedHeader}.${encodedPayload}`;
  const signature = hmacSha256(unsigned, secret);
  return `${unsigned}.${signature}`;
};

const json = (res, status, payload) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { message: "Method not allowed" });
  }

  const secret = String(process.env.AUTH_SESSION_SECRET || "").trim();
  if (!secret) {
    return json(res, 500, { message: "Servern saknar AUTH_SESSION_SECRET." });
  }

  const users = parseUsers();
  if (users.length === 0) {
    return json(res, 500, { message: "Servern saknar ADMIN_EMAIL/ADMIN_PASSWORD eller AUTH_USERS_JSON." });
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");

  const matched = users.find((item) => item.email === email && item.password === password);

  if (!matched) {
    return json(res, 401, { message: "Fel e-post eller lösenord." });
  }

  const now = Math.floor(Date.now() / 1000);
  const exp = now + SESSION_DAYS * 24 * 60 * 60;
  const role = ["owner", "editor", "viewer", "admin"].includes(matched.role) ? matched.role : "owner";

  const token = buildToken(
    {
      sub: matched.email,
      email: matched.email,
      role,
      iat: now,
      exp,
    },
    secret,
  );

  const cookie = [
    `${COOKIE_NAME}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    process.env.NODE_ENV === "production" ? "Secure" : "",
    `Max-Age=${SESSION_DAYS * 24 * 60 * 60}`,
  ]
    .filter(Boolean)
    .join("; ");

  res.setHeader("Set-Cookie", cookie);

  return json(res, 200, { ok: true });
}

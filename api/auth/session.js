import crypto from "node:crypto";

const COOKIE_NAME = "idschema_session";

const parseCookie = (value) => {
  const entries = String(value || "").split(";").map((part) => part.trim());
  for (const entry of entries) {
    const [key, ...rest] = entry.split("=");
    if (key === COOKIE_NAME) {
      return rest.join("=");
    }
  }
  return "";
};

const decodeBase64Url = (value) => {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  return Buffer.from(padded, "base64").toString("utf-8");
};

const verifyToken = (token, secret) => {
  const [headerPart, payloadPart, signaturePart] = String(token || "").split(".");
  if (!headerPart || !payloadPart || !signaturePart) {
    return null;
  }

  const unsigned = `${headerPart}.${payloadPart}`;
  const expected = crypto.createHmac("sha256", secret).update(unsigned).digest("base64url");

  if (expected !== signaturePart) {
    return null;
  }

  try {
    const payload = JSON.parse(decodeBase64Url(payloadPart));
    if (!payload?.exp || Math.floor(Date.now() / 1000) > payload.exp) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
};

const json = (res, status, payload) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
};

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return json(res, 405, { message: "Method not allowed" });
  }

  const secret = String(process.env.AUTH_SESSION_SECRET || "").trim();
  if (!secret) {
    return json(res, 500, { authenticated: false, message: "AUTH_SESSION_SECRET saknas." });
  }

  const token = parseCookie(req.headers.cookie);
  const payload = verifyToken(token, secret);

  if (!payload) {
    return json(res, 200, {
      authenticated: false,
      user: null,
      role: "none",
    });
  }

  return json(res, 200, {
    authenticated: true,
    user: {
      id: String(payload.sub || payload.email || ""),
      email: String(payload.email || ""),
    },
    role: String(payload.role || "none"),
    expiresAt: new Date(Number(payload.exp) * 1000).toISOString(),
  });
}

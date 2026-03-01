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

export const getSessionFromRequest = (req) => {
  const secret = String(process.env.AUTH_SESSION_SECRET || "").trim();
  if (!secret) {
    return null;
  }

  const token = parseCookie(req.headers.cookie);
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

    return {
      email: String(payload.email || "").toLowerCase(),
      role: String(payload.role || "none"),
      exp: payload.exp,
    };
  } catch {
    return null;
  }
};

export const isAdminSession = (session) => {
  if (!session) {
    return false;
  }

  return ["owner", "editor", "admin"].includes(session.role);
};

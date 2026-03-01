const COOKIE_NAME = "idschema_session";

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

  const cookie = [
    `${COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    process.env.NODE_ENV === "production" ? "Secure" : "",
    "Max-Age=0",
  ]
    .filter(Boolean)
    .join("; ");

  res.setHeader("Set-Cookie", cookie);

  return json(res, 200, { ok: true });
}

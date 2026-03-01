import { query } from "./_lib/db.js";
import { getSessionFromRequest, isAdminSession } from "./_lib/session.js";

const json = (res, status, payload) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
};

const readBody = async (req) => {
  if (req.body && typeof req.body === "object") {
    return req.body;
  }

  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body || "{}");
    } catch {
      return {};
    }
  }

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf-8") || "{}");
  } catch {
    return {};
  }
};

const requireAdmin = (res, session) => {
  if (!isAdminSession(session)) {
    json(res, 403, { message: "Adminbehörighet krävs." });
    return false;
  }
  return true;
};

const asInt = (value, fallback = null) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
};

const actionNeedsAdmin = (resource, action) => {
  const readPublic = new Set([
    "class_day_halls:list",
    "weekly_schedules:list",
    "changing_room_codes:list",
    "term_plans:list",
    "school_settings:get",
    "calendar_exceptions:list",
  ]);

  return !readPublic.has(`${resource}:${action}`);
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { message: "Method not allowed" });
  }

  let body;
  try {
    body = await readBody(req);
  } catch {
    return json(res, 400, { message: "Ogiltig request body." });
  }

  const resource = String(body.resource || "").trim();
  const action = String(body.action || "").trim();
  const payload = body.payload && typeof body.payload === "object" ? body.payload : {};

  const session = getSessionFromRequest(req);

  if (actionNeedsAdmin(resource, action) && !requireAdmin(res, session)) {
    return;
  }

  try {
    if (resource === "class_day_halls" && action === "list") {
      const className = String(payload.className || "").trim();
      const params = [];
      let where = "";
      if (className) {
        params.push(className);
        where = "where class_name = $1";
      }
      const { rows } = await query(`select * from class_day_halls ${where} order by class_name, day`, params);
      return json(res, 200, { data: rows });
    }

    if (resource === "class_day_halls" && action === "replace_for_class") {
      const className = String(payload.className || "").trim();
      const rows = Array.isArray(payload.rows) ? payload.rows : [];
      if (!className) {
        return json(res, 400, { message: "className krävs." });
      }

      await query("delete from class_day_halls where class_name = $1", [className]);
      for (const row of rows) {
        await query(
          "insert into class_day_halls (class_name, day, hall) values ($1,$2,$3)",
          [className, String(row.day || ""), String(row.hall || "")],
        );
      }
      return json(res, 200, { ok: true });
    }

    if (resource === "weekly_schedules" && action === "list") {
      const className = String(payload.className || "").trim();
      const weekNumber = asInt(payload.weekNumber);

      const params = [];
      const clauses = [];
      if (className) {
        params.push(className);
        clauses.push(`class_name = $${params.length}`);
      }
      if (weekNumber) {
        params.push(weekNumber);
        clauses.push(`week_number = $${params.length}`);
      }

      const where = clauses.length > 0 ? `where ${clauses.join(" and ")}` : "";
      const { rows } = await query(`select * from weekly_schedules ${where} order by class_name, week_number, day`, params);
      return json(res, 200, { data: rows });
    }

    if (resource === "weekly_schedules" && action === "replace_for_class_week") {
      const className = String(payload.className || "").trim();
      const weekNumber = asInt(payload.weekNumber);
      const rows = Array.isArray(payload.rows) ? payload.rows : [];

      if (!className || !weekNumber) {
        return json(res, 400, { message: "className och weekNumber krävs." });
      }

      await query("delete from weekly_schedules where class_name = $1 and week_number = $2", [className, weekNumber]);

      for (const row of rows) {
        await query(
          `insert into weekly_schedules
            (week_number, class_name, day, activity, hall, changing_room, code, cancelled, is_theory, bring_change, bring_laptop)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [
            weekNumber,
            className,
            String(row.day || ""),
            String(row.activity || ""),
            String(row.hall || ""),
            String(row.changing_room || ""),
            String(row.code || ""),
            Boolean(row.cancelled),
            Boolean(row.is_theory),
            row.bring_change !== false,
            Boolean(row.bring_laptop),
          ],
        );
      }

      return json(res, 200, { ok: true });
    }

    if (resource === "changing_room_codes" && action === "list") {
      const weekNumber = asInt(payload.weekNumber);
      if (weekNumber) {
        const { rows } = await query(
          "select * from changing_room_codes where week_number = $1 order by week_number, day, changing_room",
          [weekNumber],
        );
        return json(res, 200, { data: rows });
      }

      const { rows } = await query("select * from changing_room_codes order by week_number, day, changing_room");
      return json(res, 200, { data: rows });
    }

    if (resource === "changing_room_codes" && action === "replace_weeks") {
      const rows = Array.isArray(payload.rows) ? payload.rows : [];
      const weeks = [...new Set(rows.map((row) => asInt(row.week_number)).filter(Boolean))];

      for (const week of weeks) {
        await query("delete from changing_room_codes where week_number = $1", [week]);
      }

      for (const row of rows) {
        await query(
          "insert into changing_room_codes (week_number, day, changing_room, code) values ($1,$2,$3,$4)",
          [asInt(row.week_number), String(row.day || ""), String(row.changing_room || ""), String(row.code || "")],
        );
      }

      return json(res, 200, { ok: true });
    }

    if (resource === "changing_room_codes" && action === "delete_week") {
      const weekNumber = asInt(payload.weekNumber);
      if (!weekNumber) {
        return json(res, 400, { message: "weekNumber krävs." });
      }
      await query("delete from changing_room_codes where week_number = $1", [weekNumber]);
      return json(res, 200, { ok: true });
    }

    if (resource === "term_plans" && action === "list") {
      const { rows } = await query("select * from term_plans order by sort_order");
      return json(res, 200, { data: rows });
    }

    if (resource === "term_plans" && action === "replace_all") {
      const rows = Array.isArray(payload.rows) ? payload.rows : [];
      await query("delete from term_plans");

      for (let index = 0; index < rows.length; index += 1) {
        const row = rows[index] || {};
        await query(
          "insert into term_plans (weeks, area, description, is_assessment, color, sort_order) values ($1,$2,$3,$4,$5,$6)",
          [
            String(row.weeks || ""),
            String(row.area || ""),
            String(row.description || ""),
            Boolean(row.is_assessment),
            String(row.color || "teal"),
            index,
          ],
        );
      }

      return json(res, 200, { ok: true });
    }

    if (resource === "school_settings" && action === "get") {
      const { rows } = await query("select settings, updated_at from school_settings where id = 'default' limit 1");
      return json(res, 200, { data: rows[0] || null });
    }

    if (resource === "school_settings" && action === "upsert") {
      await query(
        `insert into school_settings (id, settings, updated_by)
         values ('default', $1::jsonb, $2)
         on conflict (id) do update set settings = excluded.settings, updated_by = excluded.updated_by, updated_at = now()`,
        [JSON.stringify(payload.settings || {}), session?.email || null],
      );
      return json(res, 200, { ok: true });
    }

    if (resource === "admin_users" && action === "list") {
      const { rows } = await query("select id,email,role,active,created_at,updated_at from admin_users order by email");
      return json(res, 200, { data: rows });
    }

    if (resource === "admin_users" && action === "replace_all") {
      const rows = Array.isArray(payload.rows) ? payload.rows : [];
      await query("delete from admin_users");
      for (const row of rows) {
        await query("insert into admin_users (email, role, active) values ($1,$2,$3)", [
          String(row.email || "").toLowerCase(),
          String(row.role || "viewer"),
          row.active !== false,
        ]);
      }
      return json(res, 200, { ok: true });
    }

    if (resource === "calendar_exceptions" && action === "list") {
      const weekNumber = asInt(payload.weekNumber);
      const className = String(payload.className || "").trim();

      const params = [];
      const clauses = [];
      if (weekNumber) {
        params.push(weekNumber);
        clauses.push(`week_number = $${params.length}`);
      }

      const where = clauses.length ? `where ${clauses.join(" and ")}` : "";
      const { rows } = await query(`select * from calendar_exceptions ${where} order by week_number, day`, params);
      const filtered = className ? rows.filter((row) => !row.class_name || row.class_name === className) : rows;
      return json(res, 200, { data: filtered });
    }

    if (resource === "calendar_exceptions" && action === "upsert") {
      const row = payload.row || {};
      const id = String(row.id || "").trim();
      if (id) {
        await query(
          `update calendar_exceptions
           set week_number=$1, day=$2, class_name=$3, title=$4, message=$5, cancel_lesson=$6, updated_at=now()
           where id=$7`,
          [
            asInt(row.week_number, 1),
            String(row.day || "Måndag"),
            row.class_name ? String(row.class_name) : null,
            String(row.title || "Avvikelse"),
            String(row.message || ""),
            row.cancel_lesson !== false,
            id,
          ],
        );
      } else {
        await query(
          `insert into calendar_exceptions (week_number, day, class_name, title, message, cancel_lesson)
           values ($1,$2,$3,$4,$5,$6)`,
          [
            asInt(row.week_number, 1),
            String(row.day || "Måndag"),
            row.class_name ? String(row.class_name) : null,
            String(row.title || "Avvikelse"),
            String(row.message || ""),
            row.cancel_lesson !== false,
          ],
        );
      }
      return json(res, 200, { ok: true });
    }

    if (resource === "calendar_exceptions" && action === "delete") {
      const id = String(payload.id || "").trim();
      if (!id) {
        return json(res, 400, { message: "id krävs." });
      }
      await query("delete from calendar_exceptions where id = $1", [id]);
      return json(res, 200, { ok: true });
    }

    if (resource === "admin_change_log" && action === "list") {
      const limit = asInt(payload.limit, 80);
      const { rows } = await query("select * from admin_change_log order by created_at desc limit $1", [limit]);
      return json(res, 200, { data: rows });
    }

    if (resource === "admin_change_log" && action === "insert") {
      const row = payload.row || {};
      const { rows } = await query(
        `insert into admin_change_log (entity, scope, action, summary, actor_email, before_data, after_data, metadata)
         values ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb)
         returning *`,
        [
          String(row.entity || "unknown"),
          String(row.scope || "global"),
          String(row.action || "update"),
          String(row.summary || "Uppdatering"),
          row.actor_email ? String(row.actor_email) : session?.email || null,
          JSON.stringify(row.before_data ?? null),
          JSON.stringify(row.after_data ?? null),
          JSON.stringify(row.metadata ?? null),
        ],
      );
      return json(res, 200, { data: rows[0] || null });
    }

    if (resource === "admin_snapshots" && action === "list") {
      const limit = asInt(payload.limit, 30);
      const { rows } = await query("select * from admin_snapshots order by created_at desc limit $1", [limit]);
      return json(res, 200, { data: rows });
    }

    if (resource === "admin_snapshots" && action === "latest") {
      const entity = String(payload.entity || "");
      const scope = String(payload.scope || "");
      if (!entity) {
        return json(res, 400, { message: "entity krävs." });
      }

      let sql = "select * from admin_snapshots where entity = $1";
      const params = [entity];
      if (scope) {
        params.push(scope);
        sql += ` and scope = $${params.length}`;
      }
      sql += " order by created_at desc limit 1";

      const { rows } = await query(sql, params);
      return json(res, 200, { data: rows[0] || null });
    }

    if (resource === "admin_snapshots" && action === "insert") {
      const row = payload.row || {};
      const { rows } = await query(
        `insert into admin_snapshots (entity, scope, summary, actor_email, payload, metadata)
         values ($1,$2,$3,$4,$5::jsonb,$6::jsonb)
         returning *`,
        [
          String(row.entity || "unknown"),
          String(row.scope || "global"),
          String(row.summary || "Snapshot"),
          row.actor_email ? String(row.actor_email) : session?.email || null,
          JSON.stringify(row.payload ?? null),
          JSON.stringify(row.metadata ?? null),
        ],
      );
      return json(res, 200, { data: rows[0] || null });
    }

    if (resource === "health" && action === "ping") {
      const db = await query("select now() as now");
      return json(res, 200, { data: { now: db.rows[0]?.now || null, sessionRole: session?.role || "none" } });
    }

    return json(res, 400, { message: "Okänd resource/action." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Okänt serverfel";
    return json(res, 500, { message });
  }
}

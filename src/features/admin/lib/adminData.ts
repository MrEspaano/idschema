import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_SCHOOL_CONFIG, type SchoolConfig } from "@/shared/constants/school";

export type AdminRole = "owner" | "editor" | "viewer";

export interface AdminUser {
  id: string;
  email: string;
  role: AdminRole;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CalendarException {
  id: string;
  week_number: number;
  day: string;
  class_name: string | null;
  title: string;
  message: string;
  cancel_lesson: boolean;
  created_at: string;
  updated_at: string;
}

export interface AdminHistoryEntry {
  id: string;
  entity: string;
  scope: string;
  action: string;
  summary: string;
  actor_email: string | null;
  before_data: unknown;
  after_data: unknown;
  metadata: unknown;
  created_at: string;
}

export interface AdminSnapshot {
  id: string;
  entity: string;
  scope: string;
  summary: string;
  actor_email: string | null;
  payload: unknown;
  metadata: unknown;
  created_at: string;
}

interface HistoryInput {
  entity: string;
  scope: string;
  action: string;
  summary: string;
  actor_email?: string | null;
  before_data?: unknown;
  after_data?: unknown;
  metadata?: unknown;
}

interface SnapshotInput {
  entity: string;
  scope: string;
  summary: string;
  actor_email?: string | null;
  payload: unknown;
  metadata?: unknown;
}

const LOCAL_KEYS = {
  schoolConfig: "idschema_school_config",
  adminUsers: "idschema_admin_users",
  calendarExceptions: "idschema_calendar_exceptions",
  history: "idschema_admin_history",
  snapshots: "idschema_admin_snapshots",
} as const;

const MAX_LOCAL_HISTORY = 300;
const MAX_LOCAL_SNAPSHOTS = 120;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabaseAny = supabase as any

const isBrowser = typeof window !== "undefined";

const nowIso = (): string => new Date().toISOString();

const createId = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const readLocal = <T>(key: string, fallback: T): T => {
  if (!isBrowser) {
    return fallback;
  }

  try {
    const value = window.localStorage.getItem(key);
    if (!value) {
      return fallback;
    }

    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const writeLocal = (key: string, value: unknown): void => {
  if (!isBrowser) {
    return;
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore local storage errors.
  }
};

const normalizeList = (values: unknown, fallback: string[]): string[] => {
  if (!Array.isArray(values)) {
    return fallback;
  }

  const dedupe = new Set<string>();

  for (const value of values) {
    if (typeof value !== "string") {
      continue;
    }

    const clean = value.trim();
    if (clean) {
      dedupe.add(clean);
    }
  }

  const normalized = [...dedupe];
  return normalized.length > 0 ? normalized : fallback;
};

export const normalizeSchoolConfig = (input: Partial<SchoolConfig> | null | undefined): SchoolConfig => {
  const source = input ?? {};

  return {
    classes: normalizeList(source.classes, DEFAULT_SCHOOL_CONFIG.classes),
    weekDays: normalizeList(source.weekDays, DEFAULT_SCHOOL_CONFIG.weekDays),
    halls: normalizeList(source.halls, DEFAULT_SCHOOL_CONFIG.halls),
    changingRooms: normalizeList(source.changingRooms, DEFAULT_SCHOOL_CONFIG.changingRooms),
    updatedAt: typeof source.updatedAt === "string" && source.updatedAt ? source.updatedAt : nowIso(),
  };
};

const normalizeAdminUsers = (users: unknown): AdminUser[] => {
  if (!Array.isArray(users)) {
    return [];
  }

  const roles: AdminRole[] = ["owner", "editor", "viewer"];
  const dedupe = new Map<string, AdminUser>();

  for (const row of users) {
    if (!row || typeof row !== "object") {
      continue;
    }

    const item = row as Record<string, unknown>;
    const email = typeof item.email === "string" ? item.email.trim().toLowerCase() : "";
    const role = typeof item.role === "string" ? (item.role.toLowerCase() as AdminRole) : "viewer";

    if (!email || !roles.includes(role)) {
      continue;
    }

    dedupe.set(email, {
      id: typeof item.id === "string" && item.id ? item.id : createId(),
      email,
      role,
      active: item.active !== false,
      created_at: typeof item.created_at === "string" && item.created_at ? item.created_at : nowIso(),
      updated_at: nowIso(),
    });
  }

  return [...dedupe.values()].sort((a, b) => a.email.localeCompare(b.email));
};

const normalizeCalendarExceptions = (items: unknown): CalendarException[] => {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((row) => {
      if (!row || typeof row !== "object") {
        return null;
      }

      const item = row as Record<string, unknown>;
      const weekNumber = Number(item.week_number);
      const day = typeof item.day === "string" ? item.day.trim() : "";
      const title = typeof item.title === "string" ? item.title.trim() : "";

      if (!Number.isFinite(weekNumber) || weekNumber < 1 || weekNumber > 53 || !day || !title) {
        return null;
      }

      return {
        id: typeof item.id === "string" && item.id ? item.id : createId(),
        week_number: weekNumber,
        day,
        class_name: typeof item.class_name === "string" && item.class_name ? item.class_name : null,
        title,
        message: typeof item.message === "string" ? item.message : "",
        cancel_lesson: item.cancel_lesson !== false,
        created_at: typeof item.created_at === "string" && item.created_at ? item.created_at : nowIso(),
        updated_at: nowIso(),
      } as CalendarException;
    })
    .filter((item): item is CalendarException => Boolean(item))
    .sort((a, b) => {
      if (a.week_number === b.week_number) {
        return a.day.localeCompare(b.day, "sv");
      }
      return a.week_number - b.week_number;
    });
};

const normalizeHistory = (items: unknown): AdminHistoryEntry[] => {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((row) => {
      if (!row || typeof row !== "object") {
        return null;
      }

      const item = row as Record<string, unknown>;
      const entity = typeof item.entity === "string" ? item.entity : "unknown";
      const scope = typeof item.scope === "string" ? item.scope : "global";
      const action = typeof item.action === "string" ? item.action : "unknown";
      const summary = typeof item.summary === "string" ? item.summary : "Uppdatering";

      return {
        id: typeof item.id === "string" && item.id ? item.id : createId(),
        entity,
        scope,
        action,
        summary,
        actor_email: typeof item.actor_email === "string" ? item.actor_email : null,
        before_data: item.before_data ?? null,
        after_data: item.after_data ?? null,
        metadata: item.metadata ?? null,
        created_at: typeof item.created_at === "string" && item.created_at ? item.created_at : nowIso(),
      };
    })
    .filter((item): item is AdminHistoryEntry => Boolean(item))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
};

const normalizeSnapshots = (items: unknown): AdminSnapshot[] => {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((row) => {
      if (!row || typeof row !== "object") {
        return null;
      }

      const item = row as Record<string, unknown>;
      const entity = typeof item.entity === "string" ? item.entity : "unknown";
      const scope = typeof item.scope === "string" ? item.scope : "global";
      const summary = typeof item.summary === "string" ? item.summary : "Snapshot";

      return {
        id: typeof item.id === "string" && item.id ? item.id : createId(),
        entity,
        scope,
        summary,
        actor_email: typeof item.actor_email === "string" ? item.actor_email : null,
        payload: item.payload ?? null,
        metadata: item.metadata ?? null,
        created_at: typeof item.created_at === "string" && item.created_at ? item.created_at : nowIso(),
      };
    })
    .filter((item): item is AdminSnapshot => Boolean(item))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
};

export const getSchoolConfig = async (): Promise<SchoolConfig> => {
  const local = normalizeSchoolConfig(readLocal(LOCAL_KEYS.schoolConfig, DEFAULT_SCHOOL_CONFIG));

  try {
    const { data, error } = await supabaseAny
      .from("school_settings")
      .select("settings, updated_at")
      .eq("id", "default")
      .maybeSingle();

    if (!error && data?.settings) {
      const normalized = normalizeSchoolConfig({
        ...(data.settings as Record<string, unknown>),
        updatedAt: typeof data.updated_at === "string" ? data.updated_at : nowIso(),
      });
      writeLocal(LOCAL_KEYS.schoolConfig, normalized);
      return normalized;
    }
  } catch {
    // Ignore and fallback.
  }

  return local;
};

export const saveSchoolConfig = async (
  config: Partial<SchoolConfig>,
  actorEmail?: string | null,
): Promise<SchoolConfig> => {
  const normalized = normalizeSchoolConfig(config);

  writeLocal(LOCAL_KEYS.schoolConfig, normalized);

  try {
    await supabaseAny.from("school_settings").upsert({
      id: "default",
      settings: {
        classes: normalized.classes,
        weekDays: normalized.weekDays,
        halls: normalized.halls,
        changingRooms: normalized.changingRooms,
      },
      updated_by: actorEmail || null,
      updated_at: nowIso(),
    });
  } catch {
    // Keep local fallback.
  }

  return normalized;
};

export const listAdminUsers = async (): Promise<AdminUser[]> => {
  const localUsers = normalizeAdminUsers(readLocal(LOCAL_KEYS.adminUsers, []));

  try {
    const { data, error } = await supabaseAny
      .from("admin_users")
      .select("id,email,role,active,created_at,updated_at")
      .order("email");

    if (!error && Array.isArray(data)) {
      const normalized = normalizeAdminUsers(data);
      writeLocal(LOCAL_KEYS.adminUsers, normalized);
      return normalized;
    }
  } catch {
    // Keep local fallback.
  }

  return localUsers;
};

export const saveAdminUsers = async (users: AdminUser[]): Promise<AdminUser[]> => {
  const normalized = normalizeAdminUsers(users);
  writeLocal(LOCAL_KEYS.adminUsers, normalized);

  try {
    await supabaseAny.from("admin_users").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    if (normalized.length > 0) {
      await supabaseAny.from("admin_users").insert(
        normalized.map((row) => ({
          email: row.email,
          role: row.role,
          active: row.active,
        })),
      );
    }
  } catch {
    // Keep local fallback.
  }

  return normalized;
};

export const listCalendarExceptions = async (params?: {
  weekNumber?: number;
  className?: string | null;
}): Promise<CalendarException[]> => {
  const local = normalizeCalendarExceptions(readLocal(LOCAL_KEYS.calendarExceptions, []));

  try {
    let query = supabaseAny
      .from("calendar_exceptions")
      .select("*")
      .order("week_number")
      .order("day");

    if (params?.weekNumber) {
      query = query.eq("week_number", params.weekNumber);
    }

    const { data, error } = await query;

    if (!error && Array.isArray(data)) {
      const normalized = normalizeCalendarExceptions(data);
      writeLocal(LOCAL_KEYS.calendarExceptions, normalized);

      if (!params?.className) {
        return normalized;
      }

      return normalized.filter((item) => !item.class_name || item.class_name === params.className);
    }
  } catch {
    // Keep local fallback.
  }

  const filteredByWeek = params?.weekNumber
    ? local.filter((item) => item.week_number === params.weekNumber)
    : local;

  if (!params?.className) {
    return filteredByWeek;
  }

  return filteredByWeek.filter((item) => !item.class_name || item.class_name === params.className);
};

export const upsertCalendarException = async (
  input: Partial<CalendarException>,
): Promise<CalendarException[]> => {
  const existing = normalizeCalendarExceptions(readLocal(LOCAL_KEYS.calendarExceptions, []));
  const next: CalendarException = {
    id: typeof input.id === "string" && input.id ? input.id : createId(),
    week_number: Number(input.week_number) || 1,
    day: typeof input.day === "string" ? input.day : "Måndag",
    class_name:
      typeof input.class_name === "string" && input.class_name.trim() ? input.class_name.trim() : null,
    title: typeof input.title === "string" && input.title.trim() ? input.title.trim() : "Avvikelse",
    message: typeof input.message === "string" ? input.message : "",
    cancel_lesson: input.cancel_lesson !== false,
    created_at: typeof input.created_at === "string" && input.created_at ? input.created_at : nowIso(),
    updated_at: nowIso(),
  };

  const upserted = [...existing.filter((item) => item.id !== next.id), next];
  const normalized = normalizeCalendarExceptions(upserted);
  writeLocal(LOCAL_KEYS.calendarExceptions, normalized);

  try {
    await supabaseAny.from("calendar_exceptions").upsert({
      id: next.id,
      week_number: next.week_number,
      day: next.day,
      class_name: next.class_name,
      title: next.title,
      message: next.message,
      cancel_lesson: next.cancel_lesson,
    });
  } catch {
    // Keep local fallback.
  }

  return normalized;
};

export const deleteCalendarException = async (id: string): Promise<CalendarException[]> => {
  const existing = normalizeCalendarExceptions(readLocal(LOCAL_KEYS.calendarExceptions, []));
  const normalized = existing.filter((item) => item.id !== id);
  writeLocal(LOCAL_KEYS.calendarExceptions, normalized);

  try {
    await supabaseAny.from("calendar_exceptions").delete().eq("id", id);
  } catch {
    // Keep local fallback.
  }

  return normalized;
};

export const logAdminChange = async (input: HistoryInput): Promise<AdminHistoryEntry> => {
  const entry: AdminHistoryEntry = {
    id: createId(),
    entity: input.entity,
    scope: input.scope,
    action: input.action,
    summary: input.summary,
    actor_email: input.actor_email ?? null,
    before_data: input.before_data ?? null,
    after_data: input.after_data ?? null,
    metadata: input.metadata ?? null,
    created_at: nowIso(),
  };

  const existing = normalizeHistory(readLocal(LOCAL_KEYS.history, []));
  const merged = [entry, ...existing].slice(0, MAX_LOCAL_HISTORY);
  writeLocal(LOCAL_KEYS.history, merged);

  try {
    await supabaseAny.from("admin_change_log").insert({
      entity: entry.entity,
      scope: entry.scope,
      action: entry.action,
      summary: entry.summary,
      actor_email: entry.actor_email,
      before_data: entry.before_data,
      after_data: entry.after_data,
      metadata: entry.metadata,
    });
  } catch {
    // Keep local fallback.
  }

  return entry;
};

export const listAdminChanges = async (limit = 80): Promise<AdminHistoryEntry[]> => {
  const local = normalizeHistory(readLocal(LOCAL_KEYS.history, []));

  try {
    const { data, error } = await supabaseAny
      .from("admin_change_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (!error && Array.isArray(data)) {
      const normalized = normalizeHistory(data);
      writeLocal(LOCAL_KEYS.history, normalized.slice(0, MAX_LOCAL_HISTORY));
      return normalized.slice(0, limit);
    }
  } catch {
    // Keep local fallback.
  }

  return local.slice(0, limit);
};

export const listAnnouncements = async (limit = 6): Promise<AdminHistoryEntry[]> => {
  const entries = await listAdminChanges(120);
  const allowedActions = new Set(["save", "copy", "import", "restore", "delete", "update"]);

  return entries
    .filter((entry) => allowedActions.has(entry.action))
    .slice(0, limit);
};

export const saveAdminSnapshot = async (input: SnapshotInput): Promise<AdminSnapshot> => {
  const snapshot: AdminSnapshot = {
    id: createId(),
    entity: input.entity,
    scope: input.scope,
    summary: input.summary,
    actor_email: input.actor_email ?? null,
    payload: input.payload,
    metadata: input.metadata ?? null,
    created_at: nowIso(),
  };

  const existing = normalizeSnapshots(readLocal(LOCAL_KEYS.snapshots, []));
  const merged = [snapshot, ...existing].slice(0, MAX_LOCAL_SNAPSHOTS);
  writeLocal(LOCAL_KEYS.snapshots, merged);

  try {
    await supabaseAny.from("admin_snapshots").insert({
      entity: snapshot.entity,
      scope: snapshot.scope,
      summary: snapshot.summary,
      actor_email: snapshot.actor_email,
      payload: snapshot.payload,
      metadata: snapshot.metadata,
    });
  } catch {
    // Keep local fallback.
  }

  return snapshot;
};

export const getLatestSnapshot = async (
  entity: string,
  scope?: string,
): Promise<AdminSnapshot | null> => {
  const local = normalizeSnapshots(readLocal(LOCAL_KEYS.snapshots, []));

  try {
    let query = supabaseAny
      .from("admin_snapshots")
      .select("*")
      .eq("entity", entity)
      .order("created_at", { ascending: false })
      .limit(1);

    if (scope) {
      query = query.eq("scope", scope);
    }

    const { data, error } = await query;

    if (!error && Array.isArray(data) && data.length > 0) {
      const normalized = normalizeSnapshots(data);
      return normalized[0] ?? null;
    }
  } catch {
    // Keep local fallback.
  }

  return local.find((item) => item.entity === entity && (!scope || item.scope === scope)) ?? null;
};

export const listSnapshots = async (limit = 30): Promise<AdminSnapshot[]> => {
  const local = normalizeSnapshots(readLocal(LOCAL_KEYS.snapshots, []));

  try {
    const { data, error } = await supabaseAny
      .from("admin_snapshots")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (!error && Array.isArray(data)) {
      const normalized = normalizeSnapshots(data);
      writeLocal(LOCAL_KEYS.snapshots, normalized.slice(0, MAX_LOCAL_SNAPSHOTS));
      return normalized.slice(0, limit);
    }
  } catch {
    // Keep local fallback.
  }

  return local.slice(0, limit);
};

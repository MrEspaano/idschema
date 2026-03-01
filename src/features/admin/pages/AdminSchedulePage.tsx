import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, Save, WandSparkles } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/features/auth/useAuth";
import { apiData } from "@/shared/lib/api";
import AppLayout from "@/shared/layout/AppLayout";
import {
  CHANGING_ROOMS,
  CLASSES,
  WEEK_DAYS,
  type ClassName,
} from "@/shared/constants/school";
import { getCurrentWeek } from "@/shared/lib/date";
interface ClassDayHallRow {
  id: string;
  class_name: string;
  day: string;
  hall: string;
}

interface WeeklyScheduleInsert {
  week_number: number;
  class_name: string;
  day: string;
  activity: string;
  hall: string;
  changing_room: string;
  code: string;
  cancelled: boolean;
  is_theory: boolean;
  bring_change: boolean;
  bring_laptop: boolean;
}

interface LessonRow {
  id?: string;
  day: string;
  hall: string;
  activity: string;
  changing_room: string;
  cancelled: boolean;
  is_theory: boolean;
  bring_change: boolean;
  bring_laptop: boolean;
}

interface ParsedDraftRow {
  class_name?: string;
  week_number?: number;
  day: string;
  hall?: string;
  activity?: string;
  changing_room?: string;
  cancelled?: boolean;
  is_theory?: boolean;
  bring_change?: boolean;
  bring_laptop?: boolean;
}

const AdminSchedulePage = () => {
  const { isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [selectedClass, setSelectedClass] = useState<ClassName>(CLASSES[0]);
  const [weekNumber, setWeekNumber] = useState(getCurrentWeek());
  const [classDayHalls, setClassDayHalls] = useState<ClassDayHallRow[]>([]);
  const [rows, setRows] = useState<LessonRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [draftText, setDraftText] = useState("");

  const dayOrder = useMemo(() => WEEK_DAYS, []);

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      navigate("/admin/login");
    }
  }, [authLoading, isAdmin, navigate]);

  useEffect(() => {
    const loadClassStructure = async () => {
      const data = await apiData<Array<{ id: string; class_name: string; day: string; hall: string }>>("class_day_halls", "list", { className: selectedClass });

      setClassDayHalls(data ?? []);
    };

    loadClassStructure();
  }, [selectedClass]);

  useEffect(() => {
    if (classDayHalls.length === 0) {
      setRows([]);
      return;
    }

    const loadRows = async () => {
      const data = await apiData<Array<{ id: string; day: string; activity: string; changing_room: string; cancelled: boolean; is_theory: boolean; bring_change: boolean; bring_laptop: boolean }>>("weekly_schedules", "list", { className: selectedClass, weekNumber });

      const schedules = data ?? [];

      const mergedRows: LessonRow[] = [...classDayHalls]
        .sort((a, b) => dayOrder.indexOf(a.day as (typeof WEEK_DAYS)[number]) - dayOrder.indexOf(b.day as (typeof WEEK_DAYS)[number]))
        .map((entry) => {
          const existing = schedules.find((schedule) => schedule.day === entry.day);

          return {
            id: existing?.id,
            day: entry.day,
            hall: entry.hall,
            activity: existing?.activity || "",
            changing_room: existing?.changing_room || (entry.hall === "Gy-sal" ? "-" : ""),
            cancelled: existing?.cancelled ?? false,
            is_theory: existing?.is_theory ?? false,
            bring_change: existing?.bring_change ?? true,
            bring_laptop: existing?.bring_laptop ?? false,
          };
        });

      setRows(mergedRows);
    };

    loadRows();
  }, [classDayHalls, dayOrder, selectedClass, weekNumber]);

  useEffect(() => {
    const checkConflicts = async () => {
      if (rows.length === 0) {
        setConflicts([]);
        return;
      }

      const allWeek = await apiData<Array<{ class_name: string; day: string; changing_room: string }>>("weekly_schedules", "list", { weekNumber });

      const data = allWeek.filter((item) => item.class_name !== selectedClass);

      const schedules = data ?? [];
      const warnings: string[] = [];

      for (const row of rows) {
        if (!row.changing_room || row.changing_room === "-") {
          continue;
        }

        const conflict = schedules.find(
          (schedule) => schedule.day === row.day && schedule.changing_room === row.changing_room,
        );

        if (conflict) {
          warnings.push(
            `${row.day}: Omkladningsrum ${row.changing_room} anvands redan av ${conflict.class_name}`,
          );
        }
      }

      setConflicts(warnings);
    };

    checkConflicts();
  }, [rows, selectedClass, weekNumber]);

  const updateRow = (index: number, field: keyof LessonRow, value: string | boolean) => {
    setRows((current) => {
      const updated = [...current];
      updated[index] = {
        ...updated[index],
        [field]: value,
      };

      if (updated[index].hall === "Gy-sal") {
        updated[index].changing_room = "-";
      }

      return updated;
    });
  };

  const applyDraft = () => {
    const parsedRows = parseScheduleDraft(draftText);

    if (parsedRows.length === 0) {
      toast.error("Kunde inte tolka utkastet. Prova JSON eller tabell med kolumner.");
      return;
    }

    const filtered = parsedRows.filter((entry) => {
      const classOk = !entry.class_name || entry.class_name === selectedClass;
      const weekOk = !entry.week_number || entry.week_number === weekNumber;
      return classOk && weekOk;
    });

    if (filtered.length === 0) {
      toast.error("Utkastet saknar rader för vald klass/vecka.");
      return;
    }

    const byDay = new Map(filtered.map((item) => [item.day, item]));

    setRows((current) =>
      current.map((row) => {
        const next = byDay.get(row.day);
        if (!next) {
          return row;
        }

        return {
          ...row,
          hall: next.hall?.trim() || row.hall,
          activity: next.activity?.trim() || row.activity,
          changing_room:
            row.hall === "Gy-sal"
              ? "-"
              : next.changing_room?.trim() || row.changing_room,
          cancelled: next.cancelled ?? row.cancelled,
          is_theory: next.is_theory ?? row.is_theory,
          bring_change: next.bring_change ?? row.bring_change,
          bring_laptop: next.bring_laptop ?? row.bring_laptop,
        };
      }),
    );

    toast.success(`${filtered.length} rader applicerade i formuläret. Granska och klicka Spara schema.`);
  };

  const saveSchedule = async () => {
    for (const row of rows) {
      const changingRoomMissing = !row.changing_room || row.changing_room === "-";
      if (row.activity && row.hall !== "Gy-sal" && changingRoomMissing) {
        toast.error(`${row.day}: Freja-lokaler kräver omklädningsrum.`);
        return;
      }
    }

    setSaving(true);

    // handled in replace_for_class_week

    const toInsert: WeeklyScheduleInsert[] = rows
      .filter((row) => row.activity.trim() !== "")
      .map(({ hall, id, ...rest }) => ({
        ...rest,
        hall,
        class_name: selectedClass,
        week_number: weekNumber,
        code: "",
      }));

    if (toInsert.length > 0) {
      await apiData("weekly_schedules", "replace_for_class_week", { className: selectedClass, weekNumber, rows: toInsert });
      toast.success("Schemat sparat.");
    } else {
      toast.success("Schemat rensat.");
    }

    setSaving(false);
  };

  if (authLoading) {
    return (
      <AppLayout>
        <p className="py-16 text-center text-sm text-muted-foreground">Laddar...</p>
      </AppLayout>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <AppLayout>
      <div className="space-y-5">
        <header className="flex items-center gap-3">
          <Link to="/admin" className="rounded-lg p-2 transition-colors hover:bg-secondary">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Redigera veckoschema</h1>
            <p className="text-sm text-muted-foreground">Aktiviteter fylls i per klass och vecka.</p>
          </div>
        </header>

        <section className="flex flex-wrap gap-2">
          {CLASSES.map((className) => (
            <button
              key={className}
              onClick={() => setSelectedClass(className)}
              className={
                selectedClass === className
                  ? "rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                  : "rounded-xl border bg-card px-4 py-2 text-sm font-semibold text-card-foreground transition-colors hover:bg-secondary"
              }
            >
              {className}
            </button>
          ))}
        </section>

        <section className="flex items-center gap-3">
          <label htmlFor="week-number" className="text-sm font-medium">
            Vecka:
          </label>
          <input
            id="week-number"
            type="number"
            value={weekNumber}
            onChange={(event) => setWeekNumber(Number(event.target.value))}
            className="w-20 rounded-xl border bg-card px-3 py-2 text-center text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            min={1}
            max={53}
          />
        </section>

        <section className="space-y-2 rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <WandSparkles className="h-4 w-4 text-primary" />
            Klistra in utkast fran ChatGPT
          </div>
          <p className="text-xs text-muted-foreground">
            Stoder JSON-array eller tabell med kolumner: class_name, week_number, day, activity, hall, changing_room,
            is_theory, cancelled, bring_change, bring_laptop.
          </p>
          <textarea
            value={draftText}
            onChange={(event) => setDraftText(event.target.value)}
            rows={7}
            placeholder='Exempel: [{"class_name":"7A","week_number":12,"day":"Måndag","activity":"Fotboll","hall":"Freja A","changing_room":"1&2","bring_change":true,"bring_laptop":false}]'
            className="w-full rounded-lg border bg-background px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <button
            onClick={applyDraft}
            className="inline-flex items-center justify-center rounded-lg border px-3 py-2 text-xs font-semibold transition-colors hover:bg-secondary"
          >
            Applicera utkast
          </button>
        </section>

        {conflicts.length > 0 && (
          <section className="space-y-1 rounded-xl border border-destructive/30 bg-destructive/10 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Omkladningsrumskonflikt
            </div>

            {conflicts.map((warning) => (
              <p key={warning} className="text-sm text-destructive/80">
                {warning}
              </p>
            ))}
          </section>
        )}

        <section className="space-y-3">
          {rows.map((row, index) => (
            <article key={row.day} className="space-y-3 rounded-xl border bg-card p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className="font-bold">{row.day}</span>
                  <span className="ml-2 text-sm text-muted-foreground">- {row.hall}</span>
                </div>

                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={row.is_theory}
                      onChange={(event) => updateRow(index, "is_theory", event.target.checked)}
                    />
                    Teoripass
                  </label>

                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={row.cancelled}
                      onChange={(event) => updateRow(index, "cancelled", event.target.checked)}
                    />
                    Inställd
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2">
                <input
                  placeholder="Aktivitet (t.ex. Fotboll)"
                  value={row.activity}
                  onChange={(event) => updateRow(index, "activity", event.target.value)}
                  className="rounded-lg border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />

                {row.hall !== "Gy-sal" ? (
                  <label className="space-y-1">
                    <span className="block text-xs text-muted-foreground">Omkladningsrum</span>
                    <select
                      value={row.changing_room}
                      onChange={(event) => updateRow(index, "changing_room", event.target.value)}
                      className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="">Valj omklädningsrum</option>
                      {CHANGING_ROOMS.map((room) => (
                        <option key={room} value={room}>
                          {room}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <p className="text-xs italic text-muted-foreground">Gy-sal - inget omklädningsrum eller kod.</p>
                )}

                <div className="flex flex-wrap gap-4 pt-1">
                  <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={row.bring_change}
                      onChange={(event) => updateRow(index, "bring_change", event.target.checked)}
                    />
                    Ombyte (forvalt)
                  </label>

                  <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={row.bring_laptop}
                      onChange={(event) => updateRow(index, "bring_laptop", event.target.checked)}
                    />
                    Dator
                  </label>
                </div>
              </div>
            </article>
          ))}
        </section>

        {rows.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Ingen klassstruktur hittad. Lägg till dagar under Klassstruktur.
          </p>
        )}

        <button
          onClick={saveSchedule}
          disabled={saving}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {saving ? "Sparar..." : "Spara schema"}
        </button>
      </div>
    </AppLayout>
  );
};

const parseScheduleDraft = (input: string): ParsedDraftRow[] => {
  const trimmed = input.trim();
  if (!trimmed) {
    return [];
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => normalizeDraftRow(item))
        .filter((item): item is ParsedDraftRow => item !== null);
    }
  } catch {
    // fall through to delimited parsing
  }

  const lines = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("```") && !line.startsWith("|---"));

  if (lines.length === 0) {
    return [];
  }

  const delimiter = detectDelimiter(lines[0]);
  const table = lines.map((line) => splitRow(line, delimiter));

  const header = table[0].map((value) => value.toLowerCase());
  const hasHeader = header.includes("day") || header.includes("dag");

  if (!hasHeader) {
    return table
      .map((cols) =>
        normalizeDraftRow({
          day: cols[0],
          activity: cols[1],
          hall: cols[2],
          changing_room: cols[3],
          is_theory: cols[4],
          cancelled: cols[5],
          bring_change: cols[6],
          bring_laptop: cols[7],
        }),
      )
      .filter((item): item is ParsedDraftRow => item !== null);
  }

  const keyIndex = new Map<string, number>();
  header.forEach((key, index) => keyIndex.set(key, index));

  return table
    .slice(1)
    .map((cols) =>
      normalizeDraftRow({
        class_name: readByHeader(cols, keyIndex, ["class_name", "class", "klass"]),
        week_number: readByHeader(cols, keyIndex, ["week_number", "week", "vecka"]),
        day: readByHeader(cols, keyIndex, ["day", "dag"]),
        activity: readByHeader(cols, keyIndex, ["activity", "aktivitet"]),
        hall: readByHeader(cols, keyIndex, ["hall", "sal"]),
        changing_room: readByHeader(cols, keyIndex, ["changing_room", "omkladningsrum", "omkl"]),
        is_theory: readByHeader(cols, keyIndex, ["is_theory", "teori", "teoripass"]),
        cancelled: readByHeader(cols, keyIndex, ["cancelled", "installd", "installd"]),
        bring_change: readByHeader(cols, keyIndex, ["bring_change", "ombyte"]),
        bring_laptop: readByHeader(cols, keyIndex, ["bring_laptop", "dator", "laptop"]),
      }),
    )
    .filter((item): item is ParsedDraftRow => item !== null);
};

const normalizeDraftRow = (input: unknown): ParsedDraftRow | null => {
  if (!input || typeof input !== "object") {
    return null;
  }

  const row = input as Record<string, unknown>;
  const day = normalizeDay(row.day);

  if (!day) {
    return null;
  }

  const classNameRaw = typeof row.class_name === "string" ? row.class_name.trim() : undefined;
  const weekNumber = parseWeekNumber(row.week_number);

  return {
    class_name: classNameRaw || undefined,
    week_number: weekNumber || undefined,
    day,
    activity: toStringValue(row.activity),
    hall: toStringValue(row.hall),
    changing_room: toStringValue(row.changing_room),
    is_theory: toBooleanValue(row.is_theory),
    cancelled: toBooleanValue(row.cancelled),
    bring_change: toBooleanValue(row.bring_change),
    bring_laptop: toBooleanValue(row.bring_laptop),
  };
};

const readByHeader = (cols: string[], map: Map<string, number>, aliases: string[]): string | undefined => {
  const key = aliases.find((alias) => map.has(alias));
  if (!key) {
    return undefined;
  }

  const value = cols[map.get(key) ?? -1];
  return value?.trim();
};

const detectDelimiter = (line: string): string => {
  if (line.includes("|")) {
    return "|";
  }

  if (line.includes(";")) {
    return ";";
  }

  if (line.includes("\t")) {
    return "\t";
  }

  return ",";
};

const splitRow = (line: string, delimiter: string): string[] => {
  const raw = line
    .split(delimiter)
    .map((part) => part.trim())
    .filter((part) => part !== "");

  return raw;
};

const normalizeDay = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\./g, "")
    .trim();

  if (!normalized) {
    return null;
  }

  if (normalized.startsWith("man") || normalized.startsWith("mon")) return "Måndag";
  if (normalized.startsWith("tis") || normalized.startsWith("tue")) return "Tisdag";
  if (normalized.startsWith("ons") || normalized.startsWith("wed")) return "Onsdag";
  if (normalized.startsWith("tor") || normalized.startsWith("thu")) return "Torsdag";
  if (normalized.startsWith("fre") || normalized.startsWith("fri")) return "Fredag";

  return null;
};

const parseWeekNumber = (value: unknown): number | null => {
  if (typeof value === "number" && value >= 1 && value <= 53) {
    return Math.trunc(value);
  }

  if (typeof value !== "string") {
    return null;
  }

  const match = value.match(/\d{1,2}/);
  if (!match) {
    return null;
  }

  const week = Number.parseInt(match[0], 10);
  return week >= 1 && week <= 53 ? week : null;
};

const toStringValue = (value: unknown): string | undefined => {
  return typeof value === "string" ? value.trim() : undefined;
};

const toBooleanValue = (value: unknown): boolean | undefined => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value === 1 ? true : value === 0 ? false : undefined;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();

  if (["true", "ja", "yes", "1", "y"].includes(normalized)) {
    return true;
  }

  if (["false", "nej", "no", "0", "n"].includes(normalized)) {
    return false;
  }

  return undefined;
};

export default AdminSchedulePage;

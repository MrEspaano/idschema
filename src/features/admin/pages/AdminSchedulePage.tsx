import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, Plus, Save, Trash2, WandSparkles } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/features/auth/useAuth";
import { apiData } from "@/shared/lib/api";
import AppLayout from "@/shared/layout/AppLayout";
import {
  CHANGING_ROOMS,
  CLASSES,
  HALLS,
  WEEK_DAYS,
  type ClassName,
  type WeekDay,
} from "@/shared/constants/school";
import { getCurrentWeek } from "@/shared/lib/date";

interface ClassDayHallRow {
  id: string;
  class_name: string;
  day: string;
  hall: string;
}

interface WeeklyScheduleRow {
  id: string;
  day: string;
  activity: string;
  hall: string;
  changing_room: string;
  cancelled: boolean;
  is_theory: boolean;
  bring_change: boolean;
  bring_laptop: boolean;
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

const createEmptyLessonRow = (day: string, hall = HALLS[0]): LessonRow => ({
  day,
  hall,
  activity: "",
  changing_room: hall === "Gy-sal" ? "-" : "",
  cancelled: false,
  is_theory: false,
  bring_change: true,
  bring_laptop: false,
});

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
      const data = await apiData<Array<{ id: string; class_name: string; day: string; hall: string }>>(
        "class_day_halls",
        "list",
        { className: selectedClass },
      );

      setClassDayHalls(data ?? []);
    };

    loadClassStructure();
  }, [selectedClass]);

  useEffect(() => {
    const loadRows = async () => {
      const schedules = await apiData<WeeklyScheduleRow[]>("weekly_schedules", "list", {
        className: selectedClass,
        weekNumber,
      });

      const baseRows: Array<{ day: string; hall: string }> =
        classDayHalls.length > 0
          ? [...classDayHalls]
              .sort(
                (a, b) =>
                  dayOrder.indexOf(a.day as (typeof WEEK_DAYS)[number]) -
                  dayOrder.indexOf(b.day as (typeof WEEK_DAYS)[number]),
              )
              .map((entry) => ({ day: entry.day, hall: entry.hall }))
          : WEEK_DAYS.map((day) => ({ day, hall: HALLS[0] }));

      const mergedRows: LessonRow[] = baseRows.map((entry) => {
        const existing = (schedules ?? []).find((schedule) => schedule.day === entry.day);
        const hall = existing?.hall || entry.hall;

        return {
          id: existing?.id,
          day: entry.day,
          hall,
          activity: existing?.activity || "",
          changing_room: existing?.changing_room || (hall === "Gy-sal" ? "-" : ""),
          cancelled: existing?.cancelled ?? false,
          is_theory: existing?.is_theory ?? false,
          bring_change: existing?.bring_change ?? true,
          bring_laptop: existing?.bring_laptop ?? false,
        };
      });

      const extraRows = (schedules ?? [])
        .filter((schedule) => !mergedRows.some((row) => row.day === schedule.day))
        .map((schedule) => ({
          id: schedule.id,
          day: schedule.day,
          hall: schedule.hall || HALLS[0],
          activity: schedule.activity || "",
          changing_room: schedule.changing_room || (schedule.hall === "Gy-sal" ? "-" : ""),
          cancelled: schedule.cancelled ?? false,
          is_theory: schedule.is_theory ?? false,
          bring_change: schedule.bring_change ?? true,
          bring_laptop: schedule.bring_laptop ?? false,
        }));

      setRows([...mergedRows, ...extraRows]);
    };

    loadRows();
  }, [classDayHalls, dayOrder, selectedClass, weekNumber]);

  useEffect(() => {
    const checkConflicts = async () => {
      if (rows.length === 0) {
        setConflicts([]);
        return;
      }

      const allWeek = await apiData<Array<{ class_name: string; day: string; changing_room: string }>>(
        "weekly_schedules",
        "list",
        { weekNumber },
      );

      const schedules = allWeek.filter((item) => item.class_name !== selectedClass);
      const warnings: string[] = [];

      for (const row of rows) {
        if (!row.changing_room || row.changing_room === "-") {
          continue;
        }

        const conflict = schedules.find(
          (schedule) => schedule.day === row.day && schedule.changing_room === row.changing_room,
        );

        if (conflict) {
          warnings.push(`${row.day}: Omkladningsrum ${row.changing_room} anvands redan av ${conflict.class_name}`);
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

      if (field === "hall" && updated[index].hall === "Gy-sal") {
        updated[index].changing_room = "-";
      }

      if (field === "hall" && updated[index].hall !== "Gy-sal" && updated[index].changing_room === "-") {
        updated[index].changing_room = "";
      }

      return updated;
    });
  };

  const addLessonRow = () => {
    const usedDays = new Set(rows.map((row) => row.day));
    const nextDay = WEEK_DAYS.find((day) => !usedDays.has(day)) ?? WEEK_DAYS[0];
    setRows((current) => [...current, createEmptyLessonRow(nextDay)]);
  };

  const removeLessonRow = (index: number) => {
    setRows((current) => current.filter((_, rowIndex) => rowIndex !== index));
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

    if (rows.length === 0) {
      const nextRows = filtered.map((item) => ({
        ...createEmptyLessonRow(item.day, item.hall?.trim() || HALLS[0]),
        day: item.day,
        hall: item.hall?.trim() || HALLS[0],
        activity: item.activity?.trim() || "",
        changing_room: item.changing_room?.trim() || "",
        cancelled: item.cancelled ?? false,
        is_theory: item.is_theory ?? false,
        bring_change: item.bring_change ?? true,
        bring_laptop: item.bring_laptop ?? false,
      }));

      setRows(nextRows);
      toast.success(`${filtered.length} rader applicerade i formuläret. Granska och klicka Spara schema.`);
      return;
    }

    setRows((current) =>
      current.map((row) => {
        const next = byDay.get(row.day);
        if (!next) {
          return row;
        }

        const hall = next.hall?.trim() || row.hall;

        return {
          ...row,
          hall,
          activity: next.activity?.trim() || row.activity,
          changing_room: hall === "Gy-sal" ? "-" : next.changing_room?.trim() || row.changing_room,
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
    const seenDays = new Set<string>();
    for (const row of rows) {
      if (seenDays.has(row.day)) {
        toast.error(`Dagen ${row.day} förekommer flera gånger. Välj unika dagar.`);
        return;
      }
      seenDays.add(row.day);

      const changingRoomMissing = !row.changing_room || row.changing_room === "-";
      if (row.activity && row.hall !== "Gy-sal" && changingRoomMissing) {
        toast.error(`${row.day}: Freja-lokaler kräver omklädningsrum.`);
        return;
      }
    }

    setSaving(true);

    const toInsert: WeeklyScheduleInsert[] = rows
      .filter((row) => row.activity.trim() !== "")
      .map(({ id, ...rest }) => ({
        ...rest,
        class_name: selectedClass,
        week_number: weekNumber,
        code: "",
      }));

    try {
      await apiData("weekly_schedules", "replace_for_class_week", {
        className: selectedClass,
        weekNumber,
        rows: toInsert,
      });
      toast.success(toInsert.length > 0 ? "Schemat sparat." : "Schemat rensat.");
    } catch (error) {
      console.error(error);
      toast.error("Kunde inte spara schema.");
    } finally {
      setSaving(false);
    }
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
            <article key={row.id || `${row.day}-${index}`} className="space-y-3 rounded-xl border bg-card p-4">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <label className="space-y-1">
                  <span className="block text-xs text-muted-foreground">Dag</span>
                  <select
                    value={row.day}
                    onChange={(event) => updateRow(index, "day", event.target.value as WeekDay)}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {WEEK_DAYS.map((day) => (
                      <option key={day} value={day}>
                        {day}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="block text-xs text-muted-foreground">Sal</span>
                  <select
                    value={row.hall}
                    onChange={(event) => updateRow(index, "hall", event.target.value)}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {HALLS.map((hall) => (
                      <option key={hall} value={hall}>
                        {hall}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

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

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="flex flex-wrap gap-4">
                  <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={row.is_theory}
                      onChange={(event) => updateRow(index, "is_theory", event.target.checked)}
                    />
                    Teoripass
                  </label>

                  <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={row.cancelled}
                      onChange={(event) => updateRow(index, "cancelled", event.target.checked)}
                    />
                    Inställd
                  </label>

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

                <button
                  onClick={() => removeLessonRow(index)}
                  className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs text-destructive transition-colors hover:bg-destructive/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Ta bort
                </button>
              </div>
            </article>
          ))}
        </section>

        <button
          onClick={addLessonRow}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border py-3 text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary"
        >
          <Plus className="h-4 w-4" />
          Lägg till lektion
        </button>

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

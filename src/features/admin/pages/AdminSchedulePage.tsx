import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, Plus, Save, Trash2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/features/auth/useAuth";
import { apiData } from "@/shared/lib/api";
import AppLayout from "@/shared/layout/AppLayout";
import { CHANGING_ROOMS, CLASSES, HALLS, WEEK_DAYS, type WeekDay } from "@/shared/constants/school";
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
  code: string;
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
  code: string;
  cancelled: boolean;
  is_theory: boolean;
  bring_change: boolean;
  bring_laptop: boolean;
}

interface SchoolSettingsResponse {
  settings?: {
    classes?: string[];
  };
}

const OTHER_HALL_VALUE = "__other_hall__";

const createEmptyLessonRow = (day: string, hall = HALLS[0]): LessonRow => ({
  day,
  hall,
  activity: "",
  changing_room: hall === "Gy-sal" ? "-" : "",
  code: "",
  cancelled: false,
  is_theory: false,
  bring_change: true,
  bring_laptop: false,
});

const isKnownHall = (hall: string): boolean => HALLS.includes(hall as (typeof HALLS)[number]);

const AdminSchedulePage = () => {
  const { isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [classOptions, setClassOptions] = useState<string[]>([...CLASSES]);
  const [selectedClass, setSelectedClass] = useState<string>(CLASSES[0]);
  const [weekNumber, setWeekNumber] = useState(getCurrentWeek());
  const [classDayHalls, setClassDayHalls] = useState<ClassDayHallRow[]>([]);
  const [rows, setRows] = useState<LessonRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [conflicts, setConflicts] = useState<string[]>([]);
  const structureLoadIdRef = useRef(0);
  const rowsLoadIdRef = useRef(0);

  const dayOrder = useMemo(() => WEEK_DAYS, []);

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      navigate("/admin/login");
    }
  }, [authLoading, isAdmin, navigate]);

  useEffect(() => {
    const loadClassOptions = async () => {
      try {
        const data = await apiData<SchoolSettingsResponse | null>("school_settings", "get");
        const classesFromSettings =
          data?.settings?.classes?.filter((item) => typeof item === "string" && item.trim()) ?? [];

        if (classesFromSettings.length > 0) {
          setClassOptions(classesFromSettings);
          setSelectedClass((current) =>
            current && classesFromSettings.includes(current) ? current : classesFromSettings[0],
          );
          return;
        }
      } catch {
        // fallback to defaults
      }

      setClassOptions([...CLASSES]);
      setSelectedClass((current) => current || CLASSES[0]);
    };

    loadClassOptions();
  }, []);

  useEffect(() => {
    const loadClassStructure = async () => {
      const requestId = ++structureLoadIdRef.current;
      setClassDayHalls([]);
      const data = await apiData<Array<{ id: string; class_name: string; day: string; hall: string }>>(
        "class_day_halls",
        "list",
        { className: selectedClass },
      );

      if (requestId !== structureLoadIdRef.current) {
        return;
      }

      setClassDayHalls(data ?? []);
    };

    loadClassStructure();
  }, [selectedClass]);

  useEffect(() => {
    const loadRows = async () => {
      const requestId = ++rowsLoadIdRef.current;
      setRows([]);
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
          code: existing?.code || "",
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
          code: schedule.code || "",
          cancelled: schedule.cancelled ?? false,
          is_theory: schedule.is_theory ?? false,
          bring_change: schedule.bring_change ?? true,
          bring_laptop: schedule.bring_laptop ?? false,
        }));

      if (requestId !== rowsLoadIdRef.current) {
        return;
      }

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

  const saveSchedule = async () => {
    const seenDays = new Set<string>();
    for (const row of rows) {
      if (seenDays.has(row.day)) {
        toast.error(`Dagen ${row.day} förekommer flera gånger. Välj unika dagar.`);
        return;
      }
      seenDays.add(row.day);

      if (!row.hall.trim()) {
        toast.error(`${row.day}: Ange sal.`);
        return;
      }

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
        hall: rest.hall.trim(),
        code: rest.code.trim(),
        class_name: selectedClass,
        week_number: weekNumber,
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
          {classOptions.map((className) => (
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
          {rows.map((row, index) => {
            const usesOtherHall = !isKnownHall(row.hall);
            const hallSelectValue = usesOtherHall ? OTHER_HALL_VALUE : row.hall;

            return (
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
                      value={hallSelectValue}
                      onChange={(event) => {
                        const value = event.target.value;
                        if (value === OTHER_HALL_VALUE) {
                          updateRow(index, "hall", "");
                          return;
                        }
                        updateRow(index, "hall", value);
                      }}
                      className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {HALLS.map((hall) => (
                        <option key={hall} value={hall}>
                          {hall}
                        </option>
                      ))}
                      <option value={OTHER_HALL_VALUE}>Annan</option>
                    </select>
                  </label>
                </div>

                {(usesOtherHall || row.hall === "") && (
                  <label className="space-y-1">
                    <span className="block text-xs text-muted-foreground">Annan sal (fritext)</span>
                    <input
                      value={row.hall}
                      onChange={(event) => updateRow(index, "hall", event.target.value)}
                      placeholder="T.ex. ishall, uteplan, annan lokal"
                      className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </label>
                )}

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

                {row.hall !== "Gy-sal" && (
                  <label className="space-y-1">
                    <span className="block text-xs text-muted-foreground">Kod till omklädningsrum</span>
                    <input
                      value={row.code}
                      onChange={(event) => updateRow(index, "code", event.target.value)}
                      placeholder="T.ex. 1234"
                      className="w-full rounded-lg border bg-background px-3 py-2 text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </label>
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
            );
          })}
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

export default AdminSchedulePage;

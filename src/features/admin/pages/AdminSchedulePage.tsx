import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, Save } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/features/auth/useAuth";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/shared/layout/AppLayout";
import {
  CHANGING_ROOMS,
  CLASSES,
  WEEK_DAYS,
  type ClassName,
} from "@/shared/constants/school";
import { getCurrentWeek } from "@/shared/lib/date";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

type ClassDayHallRow = Tables<"class_day_halls">;
type WeeklyScheduleRow = Tables<"weekly_schedules">;
type WeeklyScheduleInsert = TablesInsert<"weekly_schedules">;

interface LessonRow {
  id?: string;
  day: string;
  hall: string;
  activity: string;
  changing_room: string;
  cancelled: boolean;
  is_theory: boolean;
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

  const dayOrder = useMemo(() => WEEK_DAYS, []);

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      navigate("/admin/login");
    }
  }, [authLoading, isAdmin, navigate]);

  useEffect(() => {
    const loadClassStructure = async () => {
      const { data } = await supabase
        .from("class_day_halls")
        .select("*")
        .eq("class_name", selectedClass)
        .order("day");

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
      const { data } = await supabase
        .from("weekly_schedules")
        .select("*")
        .eq("class_name", selectedClass)
        .eq("week_number", weekNumber);

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

      const { data } = await supabase
        .from("weekly_schedules")
        .select("class_name, day, changing_room")
        .eq("week_number", weekNumber)
        .neq("class_name", selectedClass);

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

  const saveSchedule = async () => {
    for (const row of rows) {
      const changingRoomMissing = !row.changing_room || row.changing_room === "-";
      if (row.activity && row.hall !== "Gy-sal" && changingRoomMissing) {
        toast.error(`${row.day}: Freja-lokaler kräver omklädningsrum.`);
        return;
      }
    }

    setSaving(true);

    await supabase
      .from("weekly_schedules")
      .delete()
      .eq("class_name", selectedClass)
      .eq("week_number", weekNumber);

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
      const { error } = await supabase.from("weekly_schedules").insert(toInsert);

      if (error) {
        console.error(error);
        toast.error("Kunde inte spara. Försök igen.");
      } else {
        toast.success("Schemat sparat.");
      }
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

export default AdminSchedulePage;

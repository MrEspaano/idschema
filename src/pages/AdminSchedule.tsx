import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Save, ArrowLeft, AlertTriangle } from "lucide-react";
import Layout from "@/components/Layout";
import { Link } from "react-router-dom";
import { toast } from "sonner";

const CLASSES = ["7A", "7F", "8B", "8C", "8H"];
const CHANGING_ROOMS = ["1&2", "3&4", "5&6"];

interface ClassDayHall {
  class_name: string;
  day: string;
  hall: string;
}

interface LessonRow {
  id?: string;
  day: string;
  hall: string; // derived from class_day_halls
  activity: string;
  changing_room: string;
  cancelled: boolean;
  is_theory: boolean;
}

const AdminSchedule = () => {
  const { isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [selectedClass, setSelectedClass] = useState(CLASSES[0]);
  const [weekNumber, setWeekNumber] = useState(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    return Math.ceil(((now.getTime() - start.getTime()) / 604800000) + 1);
  });
  const [classDayHalls, setClassDayHalls] = useState<ClassDayHall[]>([]);
  const [rows, setRows] = useState<LessonRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [conflicts, setConflicts] = useState<string[]>([]);

  useEffect(() => {
    if (!authLoading && !isAdmin) navigate("/admin/login");
  }, [authLoading, isAdmin, navigate]);

  // Load class structure
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("class_day_halls")
        .select("*")
        .eq("class_name", selectedClass)
        .order("day");
      if (data) setClassDayHalls(data);
    };
    load();
  }, [selectedClass]);

  // Load existing schedule for this class+week and merge with structure
  useEffect(() => {
    if (classDayHalls.length === 0) return;
    const load = async () => {
      const { data: schedules } = await supabase
        .from("weekly_schedules")
        .select("*")
        .eq("class_name", selectedClass)
        .eq("week_number", weekNumber);

      const dayOrder = ["Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag"];
      const merged: LessonRow[] = classDayHalls
        .sort((a, b) => dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day))
        .map((cdh) => {
          const existing = schedules?.find((s: any) => s.day === cdh.day);
          return {
            id: existing?.id,
            day: cdh.day,
            hall: cdh.hall,
            activity: existing?.activity || "",
            changing_room: existing?.changing_room || (cdh.hall === "Gy-sal" ? "–" : ""),
            cancelled: existing?.cancelled || false,
            is_theory: existing?.is_theory || false,
          };
        });
      setRows(merged);
    };
    load();
  }, [classDayHalls, weekNumber, selectedClass]);

  // Check for changing room conflicts
  useEffect(() => {
    const checkConflicts = async () => {
      if (rows.length === 0) return;
      // Get all schedules for this week (all classes)
      const { data: allSchedules } = await supabase
        .from("weekly_schedules")
        .select("class_name, day, changing_room")
        .eq("week_number", weekNumber)
        .neq("class_name", selectedClass);

      const warnings: string[] = [];
      for (const row of rows) {
        if (!row.changing_room || row.changing_room === "–") continue;
        const conflict = allSchedules?.find(
          (s: any) => s.day === row.day && s.changing_room === row.changing_room
        );
        if (conflict) {
          warnings.push(
            `${row.day}: Omklädningsrum ${row.changing_room} används redan av ${conflict.class_name}`
          );
        }
      }
      setConflicts(warnings);
    };
    checkConflicts();
  }, [rows, weekNumber, selectedClass]);

  const updateRow = (index: number, field: keyof LessonRow, value: string | boolean) => {
    const updated = [...rows];
    (updated[index] as any)[field] = value;

    // If hall is Gy-sal, force changing room to "–"
    if (field === "changing_room" && updated[index].hall === "Gy-sal") {
      updated[index].changing_room = "–";
    }

    setRows(updated);
  };

  const save = async () => {
    // Validate: Freja halls require changing room
    for (const row of rows) {
      if (row.activity && row.hall !== "Gy-sal" && (!row.changing_room || row.changing_room === "–" || row.changing_room === "")) {
        toast.error(`${row.day}: Freja-lokaler kräver omklädningsrum`);
        return;
      }
    }

    setSaving(true);
    // Delete existing for this class+week
    await supabase
      .from("weekly_schedules")
      .delete()
      .eq("class_name", selectedClass)
      .eq("week_number", weekNumber);

    // Insert rows that have activity
    const toInsert = rows
      .filter((r) => r.activity.trim() !== "")
      .map(({ id, hall, ...rest }) => ({
        ...rest,
        week_number: weekNumber,
        class_name: selectedClass,
        hall: hall, // store for legacy/reference
        code: "", // codes come from changing_room_codes table
      }));

    if (toInsert.length > 0) {
      const { error } = await supabase.from("weekly_schedules").insert(toInsert);
      if (error) {
        toast.error("Kunde inte spara. Försök igen.");
        console.error(error);
      } else {
        toast.success("Schemat sparat!");
      }
    } else {
      toast.success("Schemat rensat!");
    }
    setSaving(false);
  };

  if (authLoading) return <Layout><div className="text-center py-16 text-muted-foreground">Laddar...</div></Layout>;
  if (!isAdmin) return null;

  return (
    <Layout>
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <Link to="/admin" className="p-2 rounded-lg hover:bg-secondary transition-colors">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-foreground">Redigera veckoschema</h1>
            <p className="text-sm text-muted-foreground">Aktiviteter fylls i per klass och vecka</p>
          </div>
        </div>

        {/* Class filter */}
        <div className="flex flex-wrap gap-2">
          {CLASSES.map((cls) => (
            <button
              key={cls}
              onClick={() => setSelectedClass(cls)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                selectedClass === cls
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border text-card-foreground hover:bg-secondary"
              }`}
            >
              {cls}
            </button>
          ))}
        </div>

        {/* Week selector */}
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-foreground">Vecka:</label>
          <input
            type="number"
            value={weekNumber}
            onChange={(e) => setWeekNumber(Number(e.target.value))}
            className="w-20 px-3 py-2 rounded-xl border bg-card text-card-foreground text-center focus:outline-none focus:ring-2 focus:ring-ring"
            min={1}
            max={53}
          />
        </div>

        {/* Conflict warnings */}
        {conflicts.length > 0 && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 space-y-1">
            <div className="flex items-center gap-2 text-destructive font-semibold text-sm">
              <AlertTriangle className="w-4 h-4" />
              Omklädningsrumskonflikt
            </div>
            {conflicts.map((c, i) => (
              <p key={i} className="text-sm text-destructive/80">{c}</p>
            ))}
          </div>
        )}

        {/* Lesson rows */}
        <div className="space-y-3">
          {rows.map((row, i) => (
            <div key={i} className="bg-card border rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-card-foreground">{row.day}</span>
                  <span className="ml-2 text-sm text-muted-foreground">– {row.hall}</span>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={row.is_theory}
                      onChange={(e) => updateRow(i, "is_theory", e.target.checked)}
                      className="rounded"
                    />
                    Teoripass
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={row.cancelled}
                      onChange={(e) => updateRow(i, "cancelled", e.target.checked)}
                      className="rounded"
                    />
                    Inställd
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2">
                <input
                  placeholder="Aktivitet (t.ex. Fotboll)"
                  value={row.activity}
                  onChange={(e) => updateRow(i, "activity", e.target.value)}
                  className="px-3 py-2 rounded-lg border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />

                {row.hall !== "Gy-sal" && (
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Omklädningsrum</label>
                    <select
                      value={row.changing_room}
                      onChange={(e) => updateRow(i, "changing_room", e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">Välj omklädningsrum</option>
                      {CHANGING_ROOMS.map((cr) => (
                        <option key={cr} value={cr}>{cr}</option>
                      ))}
                    </select>
                  </div>
                )}

                {row.hall === "Gy-sal" && (
                  <p className="text-xs text-muted-foreground italic">
                    Gy-sal – inget omklädningsrum eller kod
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {rows.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            Ingen klassstruktur hittad. Lägg till dagar under "Klassstruktur".
          </div>
        )}

        <button
          onClick={save}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? "Sparar..." : "Spara schema"}
        </button>
      </div>
    </Layout>
  );
};

export default AdminSchedule;

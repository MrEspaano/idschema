import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, Save, ArrowLeft } from "lucide-react";
import Layout from "@/components/Layout";
import { Link } from "react-router-dom";
import { toast } from "sonner";

const CLASSES = ["7A", "7F", "8B", "8C", "8H"];

interface ScheduleRow {
  id?: string;
  week_number: number;
  class_name: string;
  day: string;
  activity: string;
  hall: string;
  changing_room: string;
  code: string;
  cancelled: boolean;
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
  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAdmin) navigate("/admin/login");
  }, [authLoading, isAdmin, navigate]);

  useEffect(() => {
    loadSchedule();
  }, [selectedClass, weekNumber]);

  const loadSchedule = async () => {
    const { data } = await supabase
      .from("weekly_schedules")
      .select("*")
      .eq("class_name", selectedClass)
      .eq("week_number", weekNumber)
      .order("day");
    if (data) setRows(data as ScheduleRow[]);
  };

  const addRow = () => {
    setRows([...rows, {
      week_number: weekNumber,
      class_name: selectedClass,
      day: "",
      activity: "",
      hall: "",
      changing_room: "",
      code: "",
      cancelled: false,
    }]);
  };

  const updateRow = (index: number, field: keyof ScheduleRow, value: string | boolean | number) => {
    const updated = [...rows];
    (updated[index] as any)[field] = value;
    setRows(updated);
  };

  const removeRow = (index: number) => {
    setRows(rows.filter((_, i) => i !== index));
  };

  const save = async () => {
    setSaving(true);
    // Delete existing rows for this class+week
    await supabase
      .from("weekly_schedules")
      .delete()
      .eq("class_name", selectedClass)
      .eq("week_number", weekNumber);

    // Insert all current rows
    if (rows.length > 0) {
      const toInsert = rows.map(({ id, ...rest }) => rest);
      const { error } = await supabase.from("weekly_schedules").insert(toInsert);
      if (error) {
        toast.error("Kunde inte spara. Försök igen.");
      } else {
        toast.success("Schemat sparat!");
        loadSchedule();
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
            <p className="text-sm text-muted-foreground">Välj klass och vecka</p>
          </div>
        </div>

        {/* Filters */}
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

        {/* Schedule rows */}
        <div className="space-y-3">
          {rows.map((row, i) => (
            <div key={i} className="bg-card border rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-muted-foreground">Lektion {i + 1}</span>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={row.cancelled}
                      onChange={(e) => updateRow(i, "cancelled", e.target.checked)}
                      className="rounded"
                    />
                    Inställd
                  </label>
                  <button onClick={() => removeRow(i)} className="p-1.5 text-destructive hover:bg-destructive/10 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  placeholder="Dag (t.ex. Tisdag)"
                  value={row.day}
                  onChange={(e) => updateRow(i, "day", e.target.value)}
                  className="px-3 py-2 rounded-lg border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <input
                  placeholder="Aktivitet"
                  value={row.activity}
                  onChange={(e) => updateRow(i, "activity", e.target.value)}
                  className="px-3 py-2 rounded-lg border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <input
                  placeholder="Sal"
                  value={row.hall}
                  onChange={(e) => updateRow(i, "hall", e.target.value)}
                  className="px-3 py-2 rounded-lg border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <input
                  placeholder="Omklädningsrum"
                  value={row.changing_room}
                  onChange={(e) => updateRow(i, "changing_room", e.target.value)}
                  className="px-3 py-2 rounded-lg border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <input
                  placeholder="Kod"
                  value={row.code}
                  onChange={(e) => updateRow(i, "code", e.target.value)}
                  className="px-3 py-2 rounded-lg border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            onClick={addRow}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors font-medium text-sm"
          >
            <Plus className="w-4 h-4" />
            Lägg till lektion
          </button>
        </div>

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

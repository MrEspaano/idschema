import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Plus, Trash2, Save } from "lucide-react";
import Layout from "@/components/Layout";
import { Link } from "react-router-dom";
import { toast } from "sonner";

const CLASSES = ["7A", "7F", "8B", "8C", "8H"];
const DAYS = ["Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag"];
const HALLS = ["Gy-sal", "Freja A", "Freja B"];

interface DayHall {
  id?: string;
  day: string;
  hall: string;
}

const AdminClassStructure = () => {
  const { isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [selectedClass, setSelectedClass] = useState(CLASSES[0]);
  const [rows, setRows] = useState<DayHall[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAdmin) navigate("/admin/login");
  }, [authLoading, isAdmin, navigate]);

  useEffect(() => {
    loadStructure();
  }, [selectedClass]);

  const loadStructure = async () => {
    const { data } = await supabase
      .from("class_day_halls")
      .select("*")
      .eq("class_name", selectedClass)
      .order("day");
    if (data) {
      const dayOrder = DAYS;
      setRows(
        data
          .map((d: any) => ({ id: d.id, day: d.day, hall: d.hall }))
          .sort((a: DayHall, b: DayHall) => dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day))
      );
    }
  };

  const addRow = () => {
    const usedDays = rows.map((r) => r.day);
    const nextDay = DAYS.find((d) => !usedDays.includes(d)) || DAYS[0];
    setRows([...rows, { day: nextDay, hall: HALLS[0] }]);
  };

  const updateRow = (index: number, field: "day" | "hall", value: string) => {
    const updated = [...rows];
    updated[index][field] = value;
    setRows(updated);
  };

  const removeRow = (index: number) => {
    setRows(rows.filter((_, i) => i !== index));
  };

  const save = async () => {
    setSaving(true);
    // Delete all for this class
    await supabase.from("class_day_halls").delete().eq("class_name", selectedClass);

    if (rows.length > 0) {
      const toInsert = rows.map(({ id, ...rest }) => ({
        ...rest,
        class_name: selectedClass,
      }));
      const { error } = await supabase.from("class_day_halls").insert(toInsert);
      if (error) {
        toast.error("Kunde inte spara.");
        console.error(error);
      } else {
        toast.success("Klassstrukturen sparad!");
        loadStructure();
      }
    } else {
      toast.success("Strukturen rensad!");
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
            <h1 className="text-xl font-bold text-foreground">Klassstruktur</h1>
            <p className="text-sm text-muted-foreground">Fasta dagar och lokaler per klass</p>
          </div>
        </div>

        {/* Class selector */}
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

        {/* Day-hall rows */}
        <div className="space-y-2">
          {rows.map((row, i) => (
            <div key={i} className="bg-card border rounded-xl p-3 flex items-center gap-2">
              <select
                value={row.day}
                onChange={(e) => updateRow(i, "day", e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {DAYS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              <select
                value={row.hall}
                onChange={(e) => updateRow(i, "hall", e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {HALLS.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
              <button
                onClick={() => removeRow(i)}
                className="p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={addRow}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors font-medium text-sm"
        >
          <Plus className="w-4 h-4" />
          Lägg till dag
        </button>

        <button
          onClick={save}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? "Sparar..." : "Spara struktur"}
        </button>
      </div>
    </Layout>
  );
};

export default AdminClassStructure;

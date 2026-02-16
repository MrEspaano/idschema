import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Plus, Save, Trash2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import AppLayout from "@/shared/layout/AppLayout";
import { useAuth } from "@/features/auth/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  CLASSES,
  HALLS,
  WEEK_DAYS,
  type ClassName,
  type Hall,
  type WeekDay,
} from "@/shared/constants/school";
import type { TablesInsert } from "@/integrations/supabase/types";

type ClassDayHallInsert = TablesInsert<"class_day_halls">;

interface DayHallRow {
  id?: string;
  day: WeekDay;
  hall: Hall;
}

const AdminClassStructurePage = () => {
  const { isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [selectedClass, setSelectedClass] = useState<ClassName>(CLASSES[0]);
  const [rows, setRows] = useState<DayHallRow[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      navigate("/admin/login");
    }
  }, [authLoading, isAdmin, navigate]);

  const loadStructure = useCallback(async () => {
    const { data } = await supabase
      .from("class_day_halls")
      .select("*")
      .eq("class_name", selectedClass)
      .order("day");

    const mapped = (data ?? [])
      .map((item) => ({
        id: item.id,
        day: item.day as WeekDay,
        hall: item.hall as Hall,
      }))
      .sort((a, b) => WEEK_DAYS.indexOf(a.day) - WEEK_DAYS.indexOf(b.day));

    setRows(mapped);
  }, [selectedClass]);

  useEffect(() => {
    loadStructure();
  }, [loadStructure]);

  const addRow = () => {
    const usedDays = rows.map((row) => row.day);
    const nextDay = WEEK_DAYS.find((day) => !usedDays.includes(day)) ?? WEEK_DAYS[0];

    setRows((current) => [...current, { day: nextDay, hall: HALLS[0] }]);
  };

  const updateRow = (index: number, field: "day" | "hall", value: string) => {
    setRows((current) => {
      const updated = [...current];
      updated[index] = {
        ...updated[index],
        [field]: value,
      } as DayHallRow;
      return updated;
    });
  };

  const removeRow = (index: number) => {
    setRows((current) => current.filter((_, rowIndex) => rowIndex !== index));
  };

  const save = async () => {
    setSaving(true);

    await supabase.from("class_day_halls").delete().eq("class_name", selectedClass);

    if (rows.length > 0) {
      const toInsert: ClassDayHallInsert[] = rows.map(({ id, ...rest }) => ({
        ...rest,
        class_name: selectedClass,
      }));

      const { error } = await supabase.from("class_day_halls").insert(toInsert);

      if (error) {
        console.error(error);
        toast.error("Kunde inte spara klassstrukturen.");
      } else {
        toast.success("Klassstrukturen sparad.");
        await loadStructure();
      }
    } else {
      toast.success("Strukturen rensad.");
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
            <h1 className="text-xl font-bold tracking-tight">Klassstruktur</h1>
            <p className="text-sm text-muted-foreground">Fasta dagar och lokaler per klass.</p>
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

        <section className="space-y-2">
          {rows.map((row, index) => (
            <article key={row.id || `${row.day}-${index}`} className="flex items-center gap-2 rounded-xl border bg-card p-3">
              <select
                value={row.day}
                onChange={(event) => updateRow(index, "day", event.target.value)}
                className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {WEEK_DAYS.map((day) => (
                  <option key={day} value={day}>
                    {day}
                  </option>
                ))}
              </select>

              <select
                value={row.hall}
                onChange={(event) => updateRow(index, "hall", event.target.value)}
                className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {HALLS.map((hall) => (
                  <option key={hall} value={hall}>
                    {hall}
                  </option>
                ))}
              </select>

              <button
                onClick={() => removeRow(index)}
                className="rounded-lg p-2 text-destructive transition-colors hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </article>
          ))}
        </section>

        <button
          onClick={addRow}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border py-3 text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary"
        >
          <Plus className="h-4 w-4" />
          Lägg till dag
        </button>

        <button
          onClick={save}
          disabled={saving}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {saving ? "Sparar..." : "Spara struktur"}
        </button>
      </div>
    </AppLayout>
  );
};

export default AdminClassStructurePage;

import { useEffect, useState } from "react";
import { ArrowLeft, GripVertical, Plus, Save, Trash2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import AppLayout from "@/shared/layout/AppLayout";
import { useAuth } from "@/features/auth/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

type TermPlanRow = Tables<"term_plans">;
type TermPlanInsert = TablesInsert<"term_plans">;

const COLORS = [
  { value: "teal", label: "Turkos" },
  { value: "green", label: "Gron" },
  { value: "blue", label: "Bla" },
  { value: "orange", label: "Orange" },
  { value: "purple", label: "Lila" },
] as const;

const AdminTermPlanPage = () => {
  const { isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [rows, setRows] = useState<TermPlanRow[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      navigate("/admin/login");
    }
  }, [authLoading, isAdmin, navigate]);

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    const { data } = await supabase.from("term_plans").select("*").order("sort_order");
    setRows(data ?? []);
  };

  const addRow = () => {
    const newRow: TermPlanRow = {
      id: crypto.randomUUID(),
      weeks: "",
      area: "",
      description: "",
      is_assessment: false,
      color: "teal",
      sort_order: rows.length,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setRows((current) => [...current, newRow]);
  };

  const updateRow = (index: number, field: keyof TermPlanRow, value: string | boolean | number) => {
    setRows((current) => {
      const updated = [...current];
      updated[index] = {
        ...updated[index],
        [field]: value,
      };
      return updated;
    });
  };

  const removeRow = (index: number) => {
    setRows((current) => current.filter((_, rowIndex) => rowIndex !== index));
  };

  const save = async () => {
    setSaving(true);

    await supabase
      .from("term_plans")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");

    if (rows.length > 0) {
      const toInsert: TermPlanInsert[] = rows.map(({ id, created_at, updated_at, ...rest }, index) => ({
        ...rest,
        sort_order: index,
      }));

      const { error } = await supabase.from("term_plans").insert(toInsert);

      if (error) {
        console.error(error);
        toast.error("Kunde inte spara. Försök igen.");
      } else {
        toast.success("Terminsplaneringen sparad.");
        await loadPlans();
      }
    } else {
      toast.success("Terminsplaneringen rensad.");
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
            <h1 className="text-xl font-bold tracking-tight">Redigera terminsplanering</h1>
            <p className="text-sm text-muted-foreground">Lägg till och redigera arbetsomraden.</p>
          </div>
        </header>

        <section className="space-y-3">
          {rows.map((row, index) => (
            <article key={row.id || `${row.weeks}-${index}`} className="space-y-3 rounded-xl border bg-card p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-semibold text-muted-foreground">Block {index + 1}</span>
                </div>

                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={row.is_assessment}
                      onChange={(event) => updateRow(index, "is_assessment", event.target.checked)}
                    />
                    Bedömning
                  </label>

                  <button
                    onClick={() => removeRow(index)}
                    className="rounded-lg p-1.5 text-destructive transition-colors hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <input
                  placeholder="Veckor (t.ex. v.3-5)"
                  value={row.weeks}
                  onChange={(event) => updateRow(index, "weeks", event.target.value)}
                  className="rounded-lg border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />

                <input
                  placeholder="Omrade"
                  value={row.area}
                  onChange={(event) => updateRow(index, "area", event.target.value)}
                  className="rounded-lg border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />

                <select
                  value={row.color}
                  onChange={(event) => updateRow(index, "color", event.target.value)}
                  className="rounded-lg border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {COLORS.map((color) => (
                    <option key={color.value} value={color.value}>
                      {color.label}
                    </option>
                  ))}
                </select>
              </div>

              <textarea
                placeholder="Beskrivning"
                value={row.description || ""}
                onChange={(event) => updateRow(index, "description", event.target.value)}
                rows={2}
                className="w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </article>
          ))}
        </section>

        <button
          onClick={addRow}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border py-3 text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary"
        >
          <Plus className="h-4 w-4" />
          Lägg till arbetsomrade
        </button>

        <button
          onClick={save}
          disabled={saving}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {saving ? "Sparar..." : "Spara planering"}
        </button>
      </div>
    </AppLayout>
  );
};

export default AdminTermPlanPage;

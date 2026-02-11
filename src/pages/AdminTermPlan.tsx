import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, Save, ArrowLeft, GripVertical } from "lucide-react";
import Layout from "@/components/Layout";
import { toast } from "sonner";

interface TermPlanRow {
  id?: string;
  weeks: string;
  area: string;
  description: string;
  is_assessment: boolean;
  color: string;
  sort_order: number;
}

const COLORS = [
  { value: "teal", label: "Teal" },
  { value: "green", label: "Grön" },
  { value: "blue", label: "Blå" },
  { value: "orange", label: "Orange" },
  { value: "purple", label: "Lila" },
];

const AdminTermPlan = () => {
  const { isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<TermPlanRow[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAdmin) navigate("/admin/login");
  }, [authLoading, isAdmin, navigate]);

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    const { data } = await supabase
      .from("term_plans")
      .select("*")
      .order("sort_order");
    if (data) setRows(data as TermPlanRow[]);
  };

  const addRow = () => {
    setRows([...rows, {
      weeks: "",
      area: "",
      description: "",
      is_assessment: false,
      color: "teal",
      sort_order: rows.length,
    }]);
  };

  const updateRow = (index: number, field: keyof TermPlanRow, value: string | boolean | number) => {
    const updated = [...rows];
    (updated[index] as any)[field] = value;
    setRows(updated);
  };

  const removeRow = (index: number) => {
    setRows(rows.filter((_, i) => i !== index));
  };

  const save = async () => {
    setSaving(true);
    // Delete all existing
    await supabase.from("term_plans").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    if (rows.length > 0) {
      const toInsert = rows.map(({ id, ...rest }, i) => ({ ...rest, sort_order: i }));
      const { error } = await supabase.from("term_plans").insert(toInsert);
      if (error) {
        toast.error("Kunde inte spara. Försök igen.");
      } else {
        toast.success("Terminsplaneringen sparad!");
        loadPlans();
      }
    } else {
      toast.success("Terminsplaneringen rensad!");
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
            <h1 className="text-xl font-bold text-foreground">Redigera terminsplanering</h1>
            <p className="text-sm text-muted-foreground">Lägg till och redigera arbetsområden</p>
          </div>
        </div>

        <div className="space-y-3">
          {rows.map((row, i) => (
            <div key={i} className="bg-card border rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GripVertical className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-semibold text-muted-foreground">Block {i + 1}</span>
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={row.is_assessment}
                      onChange={(e) => updateRow(i, "is_assessment", e.target.checked)}
                      className="rounded"
                    />
                    Bedömning
                  </label>
                  <button onClick={() => removeRow(i)} className="p-1.5 text-destructive hover:bg-destructive/10 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  placeholder="Veckor (t.ex. v.3–5)"
                  value={row.weeks}
                  onChange={(e) => updateRow(i, "weeks", e.target.value)}
                  className="px-3 py-2 rounded-lg border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <input
                  placeholder="Område"
                  value={row.area}
                  onChange={(e) => updateRow(i, "area", e.target.value)}
                  className="px-3 py-2 rounded-lg border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <select
                  value={row.color}
                  onChange={(e) => updateRow(i, "color", e.target.value)}
                  className="px-3 py-2 rounded-lg border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {COLORS.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <textarea
                placeholder="Beskrivning"
                value={row.description}
                onChange={(e) => updateRow(i, "description", e.target.value)}
                rows={2}
                className="w-full px-3 py-2 rounded-lg border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </div>
          ))}
        </div>

        <button
          onClick={addRow}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors font-medium text-sm"
        >
          <Plus className="w-4 h-4" />
          Lägg till arbetsområde
        </button>

        <button
          onClick={save}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? "Sparar..." : "Spara planering"}
        </button>
      </div>
    </Layout>
  );
};

export default AdminTermPlan;

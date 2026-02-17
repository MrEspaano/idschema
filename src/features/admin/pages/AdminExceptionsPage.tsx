import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Plus, Save, Trash2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import AppLayout from "@/shared/layout/AppLayout";
import { useAuth } from "@/features/auth/useAuth";
import {
  deleteCalendarException,
  listCalendarExceptions,
  logAdminChange,
  upsertCalendarException,
  type CalendarException,
} from "@/features/admin/lib/adminData";
import { useSchoolConfig } from "@/shared/hooks/useSchoolConfig";

const AdminExceptionsPage = () => {
  const { isAdmin, adminRole, loading: authLoading, user } = useAuth();
  const navigate = useNavigate();
  const { config } = useSchoolConfig();

  const [rows, setRows] = useState<CalendarException[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const canEdit = adminRole === "owner" || adminRole === "editor" || adminRole === "admin";

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      navigate("/admin/login");
    }
  }, [authLoading, isAdmin, navigate]);

  const load = async () => {
    const items = await listCalendarExceptions();
    setRows(items);
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) {
      load();
    }
  }, [isAdmin]);

  const addRow = () => {
    const item: CalendarException = {
      id: crypto.randomUUID(),
      week_number: 1,
      day: config.weekDays[0] ?? "Måndag",
      class_name: null,
      title: "",
      message: "",
      cancel_lesson: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setRows((current) => [item, ...current]);
  };

  const updateRow = (id: string, field: keyof CalendarException, value: string | number | boolean | null) => {
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, [field]: value, updated_at: new Date().toISOString() } : row)),
    );
  };

  const saveRow = async (row: CalendarException) => {
    if (!row.title.trim()) {
      toast.error("Titel krävs.");
      return;
    }

    setSaving(row.id);

    await upsertCalendarException(row);
    await logAdminChange({
      entity: "calendar_exceptions",
      scope: `week-${row.week_number}`,
      action: "save",
      summary: `Avvikelse sparad: ${row.title}`,
      actor_email: user?.email ?? null,
      after_data: row,
    });

    setSaving(null);
    toast.success("Avvikelse sparad.");
    await load();
  };

  const removeRow = async (row: CalendarException) => {
    await deleteCalendarException(row.id);
    await logAdminChange({
      entity: "calendar_exceptions",
      scope: `week-${row.week_number}`,
      action: "delete",
      summary: `Avvikelse borttagen: ${row.title || row.day}`,
      actor_email: user?.email ?? null,
      before_data: row,
    });

    toast.success("Avvikelse borttagen.");
    await load();
  };

  const classOptions = useMemo(() => ["Alla klasser", ...config.classes], [config.classes]);

  if (authLoading || loading) {
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
            <h1 className="text-xl font-bold tracking-tight">Avvikelsekalender</h1>
            <p className="text-sm text-muted-foreground">Skapa lov/studiedagar och andra avvikelser.</p>
          </div>
        </header>

        <button
          onClick={addRow}
          disabled={!canEdit}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border py-3 text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> Lägg till avvikelse
        </button>

        <section className="space-y-3">
          {rows.map((row) => (
            <article key={row.id} className="space-y-3 rounded-xl border bg-card p-4">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
                <input
                  type="number"
                  min={1}
                  max={53}
                  value={row.week_number}
                  onChange={(event) => updateRow(row.id, "week_number", Number(event.target.value))}
                  className="rounded-lg border bg-background px-3 py-2 text-sm"
                  disabled={!canEdit}
                />

                <select
                  value={row.day}
                  onChange={(event) => updateRow(row.id, "day", event.target.value)}
                  className="rounded-lg border bg-background px-3 py-2 text-sm"
                  disabled={!canEdit}
                >
                  {config.weekDays.map((day) => (
                    <option key={day} value={day}>
                      {day}
                    </option>
                  ))}
                </select>

                <select
                  value={row.class_name || "Alla klasser"}
                  onChange={(event) => updateRow(row.id, "class_name", event.target.value === "Alla klasser" ? null : event.target.value)}
                  className="rounded-lg border bg-background px-3 py-2 text-sm"
                  disabled={!canEdit}
                >
                  {classOptions.map((classOption) => (
                    <option key={classOption} value={classOption}>
                      {classOption}
                    </option>
                  ))}
                </select>

                <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={row.cancel_lesson}
                    onChange={(event) => updateRow(row.id, "cancel_lesson", event.target.checked)}
                    disabled={!canEdit}
                  />
                  Ställ in pass
                </label>
              </div>

              <input
                value={row.title}
                onChange={(event) => updateRow(row.id, "title", event.target.value)}
                placeholder="Titel"
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                disabled={!canEdit}
              />

              <textarea
                value={row.message}
                onChange={(event) => updateRow(row.id, "message", event.target.value)}
                placeholder="Meddelande"
                rows={2}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                disabled={!canEdit}
              />

              <div className="flex gap-2">
                <button
                  onClick={() => saveRow(row)}
                  disabled={!canEdit || saving === row.id}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                >
                  <Save className="h-4 w-4" /> {saving === row.id ? "Sparar..." : "Spara"}
                </button>

                <button
                  onClick={() => removeRow(row)}
                  disabled={!canEdit}
                  className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-destructive disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" /> Ta bort
                </button>
              </div>
            </article>
          ))}

          {rows.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">Inga avvikelser skapade.</p>
          )}
        </section>
      </div>
    </AppLayout>
  );
};

export default AdminExceptionsPage;

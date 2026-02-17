import { useEffect, useState } from "react";
import { ArrowLeft, Plus, Save, Trash2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import AppLayout from "@/shared/layout/AppLayout";
import { useAuth } from "@/features/auth/useAuth";
import { listAdminUsers, logAdminChange, saveAdminUsers, type AdminRole, type AdminUser } from "@/features/admin/lib/adminData";

const roleOptions: AdminRole[] = ["owner", "editor", "viewer"];

const AdminUsersPage = () => {
  const { isAdmin, adminRole, loading: authLoading, user } = useAuth();
  const navigate = useNavigate();

  const [rows, setRows] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const canManage = adminRole === "owner" || adminRole === "admin";

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      navigate("/admin/login");
      return;
    }

    if (!authLoading && isAdmin && !canManage) {
      navigate("/admin");
    }
  }, [authLoading, isAdmin, canManage, navigate]);

  useEffect(() => {
    const load = async () => {
      const users = await listAdminUsers();
      setRows(users);
      setLoading(false);
    };

    if (isAdmin) {
      load();
    }
  }, [isAdmin]);

  const updateRow = (index: number, field: keyof AdminUser, value: string | boolean) => {
    setRows((current) => {
      const next = [...current];
      next[index] = {
        ...next[index],
        [field]: value,
      };
      return next;
    });
  };

  const addRow = () => {
    setRows((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        email: "",
        role: "viewer",
        active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]);
  };

  const removeRow = (index: number) => {
    setRows((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const save = async () => {
    setSaving(true);

    const before = await listAdminUsers();
    const cleaned = rows
      .map((row) => ({ ...row, email: row.email.trim().toLowerCase() }))
      .filter((row) => row.email);

    const saved = await saveAdminUsers(cleaned);

    await logAdminChange({
      entity: "admin_users",
      scope: "global",
      action: "save",
      summary: `Roller uppdaterade (${saved.length} användare)`,
      actor_email: user?.email ?? null,
      before_data: before,
      after_data: saved,
    });

    setRows(saved);
    setSaving(false);
    toast.success("Användare och roller sparade.");
  };

  if (authLoading || loading) {
    return (
      <AppLayout>
        <p className="py-16 text-center text-sm text-muted-foreground">Laddar...</p>
      </AppLayout>
    );
  }

  if (!isAdmin || !canManage) {
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
            <h1 className="text-xl font-bold tracking-tight">Användare & roller</h1>
            <p className="text-sm text-muted-foreground">Hantera owner, editor och viewer.</p>
          </div>
        </header>

        <section className="space-y-2">
          {rows.map((row, index) => (
            <article key={row.id} className="grid grid-cols-1 gap-2 rounded-xl border bg-card p-3 sm:grid-cols-[1fr_130px_120px_40px] sm:items-center">
              <input
                value={row.email}
                placeholder="namn@skola.se"
                onChange={(event) => updateRow(index, "email", event.target.value)}
                className="rounded-lg border bg-background px-3 py-2 text-sm"
              />

              <select
                value={row.role}
                onChange={(event) => updateRow(index, "role", event.target.value as AdminRole)}
                className="rounded-lg border bg-background px-3 py-2 text-sm"
              >
                {roleOptions.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>

              <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={row.active}
                  onChange={(event) => updateRow(index, "active", event.target.checked)}
                />
                Aktiv
              </label>

              <button
                onClick={() => removeRow(index)}
                className="rounded-lg p-2 text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </article>
          ))}
        </section>

        <button
          onClick={addRow}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border py-3 text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary"
        >
          <Plus className="h-4 w-4" /> Lägg till användare
        </button>

        <button
          onClick={save}
          disabled={saving}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          <Save className="h-4 w-4" /> {saving ? "Sparar..." : "Spara roller"}
        </button>
      </div>
    </AppLayout>
  );
};

export default AdminUsersPage;

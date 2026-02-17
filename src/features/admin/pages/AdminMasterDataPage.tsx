import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Plus, Save, Trash2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import AppLayout from "@/shared/layout/AppLayout";
import { useAuth } from "@/features/auth/useAuth";
import { useSchoolConfig } from "@/shared/hooks/useSchoolConfig";
import { logAdminChange } from "@/features/admin/lib/adminData";

const sections = [
  { key: "classes", label: "Klasser" },
  { key: "weekDays", label: "Veckodagar" },
  { key: "halls", label: "Salar" },
  { key: "changingRooms", label: "Omklädningsrum" },
] as const;

type SectionKey = (typeof sections)[number]["key"];

const AdminMasterDataPage = () => {
  const { isAdmin, adminRole, loading: authLoading, user } = useAuth();
  const navigate = useNavigate();
  const { config, loading, save } = useSchoolConfig();

  const [draft, setDraft] = useState(config);
  const [saving, setSaving] = useState(false);

  const canEdit = adminRole === "owner" || adminRole === "editor" || adminRole === "admin";

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      navigate("/admin/login");
    }
  }, [authLoading, isAdmin, navigate]);

  useEffect(() => {
    setDraft(config);
  }, [config]);

  const isChanged = useMemo(() => JSON.stringify(draft) !== JSON.stringify(config), [config, draft]);

  const updateValue = (key: SectionKey, index: number, value: string) => {
    setDraft((current) => {
      const nextValues = [...current[key]];
      nextValues[index] = value;
      return { ...current, [key]: nextValues };
    });
  };

  const addValue = (key: SectionKey) => {
    setDraft((current) => ({
      ...current,
      [key]: [...current[key], ""],
    }));
  };

  const removeValue = (key: SectionKey, index: number) => {
    setDraft((current) => ({
      ...current,
      [key]: current[key].filter((_, valueIndex) => valueIndex !== index),
    }));
  };

  const handleSave = async () => {
    setSaving(true);

    const cleaned = {
      classes: draft.classes.map((item) => item.trim()).filter(Boolean),
      weekDays: draft.weekDays.map((item) => item.trim()).filter(Boolean),
      halls: draft.halls.map((item) => item.trim()).filter(Boolean),
      changingRooms: draft.changingRooms.map((item) => item.trim()).filter(Boolean),
    };

    const previous = config;
    const saved = await save(cleaned, user?.email ?? null);

    await logAdminChange({
      entity: "school_settings",
      scope: "global",
      action: "update",
      summary: "Masterdata uppdaterad",
      actor_email: user?.email ?? null,
      before_data: previous,
      after_data: saved,
    });

    toast.success("Masterdata sparad.");
    setSaving(false);
  };

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
            <h1 className="text-xl font-bold tracking-tight">Masterdata</h1>
            <p className="text-sm text-muted-foreground">Hantera klasser, dagar, salar och omklädningsrum.</p>
          </div>
        </header>

        {sections.map((section) => (
          <section key={section.key} className="space-y-3 rounded-xl border bg-card p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">{section.label}</h2>
              <button
                onClick={() => addValue(section.key)}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-primary hover:bg-primary/10"
                disabled={!canEdit}
              >
                <Plus className="h-4 w-4" /> Lägg till
              </button>
            </div>

            <div className="space-y-2">
              {draft[section.key].map((value, index) => (
                <div key={`${section.key}-${index}`} className="flex items-center gap-2">
                  <input
                    value={value}
                    onChange={(event) => updateValue(section.key, index, event.target.value)}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                    disabled={!canEdit}
                  />
                  <button
                    onClick={() => removeValue(section.key, index)}
                    className="rounded-lg p-2 text-destructive hover:bg-destructive/10"
                    disabled={!canEdit}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </section>
        ))}

        <button
          onClick={handleSave}
          disabled={!canEdit || !isChanged || saving}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {saving ? "Sparar..." : "Spara masterdata"}
        </button>
      </div>
    </AppLayout>
  );
};

export default AdminMasterDataPage;

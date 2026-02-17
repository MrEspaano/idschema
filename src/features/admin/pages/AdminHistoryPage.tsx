import { useEffect, useState } from "react";
import { ArrowLeft, Clock3, History } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import AppLayout from "@/shared/layout/AppLayout";
import { useAuth } from "@/features/auth/useAuth";
import { listAdminChanges, listSnapshots, type AdminHistoryEntry, type AdminSnapshot } from "@/features/admin/lib/adminData";

const formatDateTime = (value: string): string => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("sv-SE");
};

const AdminHistoryPage = () => {
  const { isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [history, setHistory] = useState<AdminHistoryEntry[]>([]);
  const [snapshots, setSnapshots] = useState<AdminSnapshot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      navigate("/admin/login");
    }
  }, [authLoading, isAdmin, navigate]);

  useEffect(() => {
    const load = async () => {
      const [changes, snapshotRows] = await Promise.all([listAdminChanges(120), listSnapshots(80)]);
      setHistory(changes);
      setSnapshots(snapshotRows);
      setLoading(false);
    };

    if (isAdmin) {
      load();
    }
  }, [isAdmin]);

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
            <h1 className="text-xl font-bold tracking-tight">Historik</h1>
            <p className="text-sm text-muted-foreground">Alla ändringar och återställningspunkter.</p>
          </div>
        </header>

        <section className="space-y-3 rounded-xl border bg-card p-4">
          <h2 className="flex items-center gap-2 font-semibold">
            <History className="h-4 w-4" /> Ändringslogg
          </h2>

          {history.length === 0 && <p className="text-sm text-muted-foreground">Ingen historik ännu.</p>}

          {history.map((entry) => (
            <article key={entry.id} className="rounded-lg border bg-background p-3">
              <p className="font-medium">{entry.summary}</p>
              <p className="text-xs text-muted-foreground">
                {entry.entity} / {entry.scope} / {entry.action}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatDateTime(entry.created_at)} {entry.actor_email ? `• ${entry.actor_email}` : ""}
              </p>
            </article>
          ))}
        </section>

        <section className="space-y-3 rounded-xl border bg-card p-4">
          <h2 className="flex items-center gap-2 font-semibold">
            <Clock3 className="h-4 w-4" /> Snapshots
          </h2>

          {snapshots.length === 0 && <p className="text-sm text-muted-foreground">Inga snapshots ännu.</p>}

          {snapshots.map((snapshot) => (
            <article key={snapshot.id} className="rounded-lg border bg-background p-3">
              <p className="font-medium">{snapshot.summary}</p>
              <p className="text-xs text-muted-foreground">
                {snapshot.entity} / {snapshot.scope}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatDateTime(snapshot.created_at)} {snapshot.actor_email ? `• ${snapshot.actor_email}` : ""}
              </p>
            </article>
          ))}
        </section>
      </div>
    </AppLayout>
  );
};

export default AdminHistoryPage;

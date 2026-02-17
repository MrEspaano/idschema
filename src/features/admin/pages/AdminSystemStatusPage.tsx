import { useEffect, useState } from "react";
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import AppLayout from "@/shared/layout/AppLayout";
import { useAuth } from "@/features/auth/useAuth";
import { SUPABASE_CONFIG } from "@/integrations/supabase/client";

interface HealthItem {
  id: string;
  name: string;
  status: "ok" | "error" | "loading";
  details: string;
}

const withTimeout = async (url: string, timeoutMs: number, options?: RequestInit) => {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timeout);
  }
};

const AdminSystemStatusPage = () => {
  const { isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [items, setItems] = useState<HealthItem[]>([
    { id: "supabase", name: "Supabase auth health", status: "loading", details: "Kontrollerar..." },
    { id: "proxy", name: "Vercel auth proxy", status: "loading", details: "Kontrollerar..." },
    { id: "client", name: "Klientkonfiguration", status: "loading", details: "Kontrollerar..." },
  ]);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      navigate("/admin/login");
    }
  }, [authLoading, isAdmin, navigate]);

  const runChecks = async () => {
    setChecking(true);

    const next: HealthItem[] = [];

    try {
      const response = await withTimeout(`${SUPABASE_CONFIG.url}/auth/v1/health`, 8000);
      next.push({
        id: "supabase",
        name: "Supabase auth health",
        status: response.ok ? "ok" : "error",
        details: `HTTP ${response.status}`,
      });
    } catch (error) {
      next.push({
        id: "supabase",
        name: "Supabase auth health",
        status: "error",
        details: error instanceof Error ? error.message : "Okänt fel",
      });
    }

    try {
      const response = await withTimeout("/api/auth/password-login", 8000, { method: "OPTIONS" });
      const isOk = response.status === 405 || response.ok;

      next.push({
        id: "proxy",
        name: "Vercel auth proxy",
        status: isOk ? "ok" : "error",
        details: `HTTP ${response.status}`,
      });
    } catch (error) {
      next.push({
        id: "proxy",
        name: "Vercel auth proxy",
        status: "error",
        details: error instanceof Error ? error.message : "Okänt fel",
      });
    }

    const hasConfig = Boolean(SUPABASE_CONFIG.url && SUPABASE_CONFIG.publishableKey);

    next.push({
      id: "client",
      name: "Klientkonfiguration",
      status: hasConfig ? "ok" : "error",
      details: hasConfig ? "Supabase URL och key hittade" : "Saknar konfiguration",
    });

    setItems(next);
    setChecking(false);
  };

  useEffect(() => {
    if (isAdmin) {
      runChecks();
    }
  }, [isAdmin]);

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
            <h1 className="text-xl font-bold tracking-tight">Systemstatus</h1>
            <p className="text-sm text-muted-foreground">Översikt över auth och driftsstatus.</p>
          </div>
        </header>

        <button
          onClick={runChecks}
          disabled={checking}
          className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
        >
          {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Kör ny kontroll
        </button>

        <section className="space-y-3">
          {items.map((item) => (
            <article key={item.id} className="rounded-xl border bg-card p-4">
              <div className="flex items-center gap-2">
                {item.status === "ok" ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : item.status === "loading" ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-destructive" />
                )}
                <h2 className="font-semibold">{item.name}</h2>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{item.details}</p>
            </article>
          ))}
        </section>
      </div>
    </AppLayout>
  );
};

export default AdminSystemStatusPage;

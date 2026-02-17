import { useEffect } from "react";
import {
  Activity,
  Building2,
  Calendar,
  ChevronRight,
  ClipboardList,
  Database,
  History,
  KeyRound,
  LogOut,
  Shield,
  Users,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import AppLayout from "@/shared/layout/AppLayout";
import { useAuth } from "@/features/auth/useAuth";

type LinkColor = "primary" | "accent";

interface AdminLink {
  to: string;
  icon: typeof Calendar;
  label: string;
  description: string;
  color: LinkColor;
  ownerOnly?: boolean;
}

const colorClasses: Record<LinkColor, string> = {
  primary: "bg-primary/10 text-primary",
  accent: "bg-accent/10 text-accent",
};

const adminLinks: AdminLink[] = [
  {
    to: "/admin/veckoschema",
    icon: Calendar,
    label: "Veckoscheman",
    description: "Redigera aktiviteter per klass och vecka.",
    color: "primary",
  },
  {
    to: "/admin/terminsplanering",
    icon: ClipboardList,
    label: "Terminsplanering",
    description: "Uppdatera arbetsområden och bedömningar.",
    color: "accent",
  },
  {
    to: "/admin/koder",
    icon: KeyRound,
    label: "Koddokument",
    description: "Import, förhandsgranska och redigera koder.",
    color: "primary",
  },
  {
    to: "/admin/avvikelser",
    icon: Activity,
    label: "Avvikelsekalender",
    description: "Lov, studiedagar och inställda pass.",
    color: "accent",
  },
  {
    to: "/admin/klassstruktur",
    icon: Building2,
    label: "Klassstruktur",
    description: "Fasta dagar och lokaler per klass.",
    color: "primary",
  },
  {
    to: "/admin/masterdata",
    icon: Database,
    label: "Masterdata",
    description: "Klasser, dagar, hallar och omklädningsrum.",
    color: "accent",
  },
  {
    to: "/admin/historik",
    icon: History,
    label: "Historik",
    description: "Ändringslogg och snapshots för återställning.",
    color: "primary",
  },
  {
    to: "/admin/systemstatus",
    icon: Shield,
    label: "Systemstatus",
    description: "Supabase, auth-proxy och klienthälsa.",
    color: "accent",
  },
  {
    to: "/admin/anvandare",
    icon: Users,
    label: "Användare & roller",
    description: "Hantera owner/editor/viewer.",
    color: "primary",
    ownerOnly: true,
  },
];

const AdminDashboardPage = () => {
  const { isAdmin, adminRole, loading, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !isAdmin) {
      navigate("/admin/login");
    }
  }, [loading, isAdmin, navigate]);

  if (loading) {
    return (
      <AppLayout>
        <p className="py-16 text-center text-sm text-muted-foreground">Laddar...</p>
      </AppLayout>
    );
  }

  if (!isAdmin) {
    return null;
  }

  const isOwner = adminRole === "owner" || adminRole === "admin";

  return (
    <AppLayout>
      <div className="space-y-6">
        <header className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Admin</h1>
            <p className="mt-1 text-sm text-muted-foreground">Hantera schema, planering och system.</p>
            <p className="text-xs text-muted-foreground">Roll: {adminRole}</p>
          </div>

          <button
            onClick={async () => {
              await signOut();
              navigate("/admin/login");
            }}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
            Logga ut
          </button>
        </header>

        <section className="space-y-3">
          {adminLinks
            .filter((item) => !item.ownerOnly || isOwner)
            .map((item) => (
              <Link key={item.to} to={item.to} className="group block">
                <article className="card-hover flex items-center justify-between rounded-2xl border bg-card p-5">
                  <div className="flex items-center gap-4">
                    <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${colorClasses[item.color]}`}>
                      <item.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="font-semibold">{item.label}</h2>
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                    </div>
                  </div>

                  <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </article>
              </Link>
            ))}
        </section>
      </div>
    </AppLayout>
  );
};

export default AdminDashboardPage;

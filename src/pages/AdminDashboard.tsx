import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Calendar, ClipboardList, LogOut, ChevronRight, KeyRound, Building2 } from "lucide-react";
import Layout from "@/components/Layout";
import { useEffect } from "react";

const AdminDashboard = () => {
  const { isAdmin, loading, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !isAdmin) navigate("/admin/login");
  }, [loading, isAdmin, navigate]);

  if (loading) return <Layout><div className="text-center py-16 text-muted-foreground">Laddar...</div></Layout>;
  if (!isAdmin) return null;

  const links = [
    { to: "/admin/veckoschema", icon: Calendar, label: "Veckoscheman", desc: "Redigera aktiviteter per klass och vecka", color: "primary" },
    { to: "/admin/terminsplanering", icon: ClipboardList, label: "Terminsplanering", desc: "Uppdatera arbetsområden och bedömningar", color: "accent" },
    { to: "/admin/klassstruktur", icon: Building2, label: "Klassstruktur", desc: "Fasta dagar och lokaler per klass", color: "primary" },
    { to: "/admin/koder", icon: KeyRound, label: "Koddokument", desc: "Importera och hantera omklädningsrumskoder", color: "accent" },
  ];

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Admin</h1>
            <p className="text-muted-foreground text-sm mt-1">Hantera schemat och planeringen</p>
          </div>
          <button
            onClick={async () => { await signOut(); navigate("/admin/login"); }}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Logga ut
          </button>
        </div>

        <div className="space-y-3">
          {links.map((link) => (
            <Link key={link.to} to={link.to} className="block">
              <div className="bg-card border rounded-2xl p-5 card-hover flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-11 h-11 rounded-xl bg-${link.color}/10 flex items-center justify-center`}>
                    <link.icon className={`w-5 h-5 text-${link.color}`} />
                  </div>
                  <div>
                    <h2 className="font-semibold text-card-foreground">{link.label}</h2>
                    <p className="text-sm text-muted-foreground">{link.desc}</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </Layout>
  );
};

export default AdminDashboard;

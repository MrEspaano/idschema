import { Link } from "react-router-dom";
import { Calendar, ClipboardList, ChevronRight } from "lucide-react";
import Layout from "@/components/Layout";

const Index = () => {
  return (
    <Layout>
      <div className="space-y-8">
        {/* Hero */}
        <div className="text-center space-y-2 pt-4">
          <h1 className="text-3xl font-bold text-foreground tracking-tight">
            Välkommen! 👋
          </h1>
          <p className="text-muted-foreground text-lg">
            Här hittar du allt om dina idrottslektioner.
          </p>
        </div>

        {/* Main navigation cards */}
        <div className="space-y-3">
          <Link to="/veckoschema" className="block">
            <div className="bg-primary text-primary-foreground rounded-2xl p-6 card-hover flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary-foreground/20 flex items-center justify-center">
                  <Calendar className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">Veckoschema</h2>
                  <p className="text-primary-foreground/80 text-sm">
                    Se veckans aktiviteter, sal & omklädningsrum
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 opacity-60" />
            </div>
          </Link>

          <Link to="/terminsplanering" className="block">
            <div className="bg-card border rounded-2xl p-6 card-hover flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center">
                  <ClipboardList className="w-6 h-6 text-accent-foreground" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-card-foreground">Terminsplanering</h2>
                  <p className="text-muted-foreground text-sm">
                    Översikt över terminens arbetsområden
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </div>
          </Link>
        </div>

        {/* Quick info */}
        <div className="bg-card border rounded-2xl p-5 space-y-3">
          <h3 className="font-semibold text-card-foreground">💡 Tips</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>• Välj din klass i veckoschemat för att se dina tider</li>
            <li>• Kolla koden till omklädningsrummet innan lektionen</li>
            <li>• Terminsplaneringen visar vad som kommer härnäst</li>
          </ul>
        </div>
      </div>
    </Layout>
  );
};

export default Index;

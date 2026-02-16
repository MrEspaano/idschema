import { Calendar, ChevronRight, ClipboardList } from "lucide-react";
import { Link } from "react-router-dom";
import AppLayout from "@/shared/layout/AppLayout";

const HomePage = () => {
  return (
    <AppLayout>
      <div className="space-y-8">
        <header className="space-y-2 pt-2 text-center">
          <h1 className="text-3xl font-bold tracking-tight">Välkommen</h1>
          <p className="text-base text-muted-foreground">Allt om dina idrottslektioner pa ett stalle.</p>
        </header>

        <section className="space-y-3">
          <Link to="/veckoschema" className="group block">
            <article className="card-hover flex items-center justify-between rounded-2xl bg-primary p-6 text-primary-foreground">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-foreground/20">
                  <Calendar className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">Veckoschema</h2>
                  <p className="text-sm text-primary-foreground/85">Se aktiviteter, salar och omklädningsrum.</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 opacity-70 transition-transform group-hover:translate-x-0.5" />
            </article>
          </Link>

          <Link to="/terminsplanering" className="group block">
            <article className="card-hover flex items-center justify-between rounded-2xl border bg-card p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                  <ClipboardList className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">Terminsplanering</h2>
                  <p className="text-sm text-muted-foreground">Översikt over terminens arbetsomraden.</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </article>
          </Link>
        </section>

        <section className="rounded-2xl border bg-card p-5">
          <h3 className="font-semibold">Tips</h3>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>Valj klass i veckoschemat for att se tiderna.</li>
            <li>Kontrollera omklädningsrumskoden innan lektionen.</li>
            <li>Terminsplaneringen visar vad som kommer nasta veckor.</li>
          </ul>
        </section>
      </div>
    </AppLayout>
  );
};

export default HomePage;

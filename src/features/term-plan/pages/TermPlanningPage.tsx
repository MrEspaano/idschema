import { useEffect, useState } from "react";
import { AlertTriangle, BookOpen } from "lucide-react";
import AppLayout from "@/shared/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import {
  fallbackTermPlan,
  type FallbackTermPlanBlock,
} from "@/features/term-plan/data/fallbackTermPlan";
import type { Tables } from "@/integrations/supabase/types";

type TermPlanRow = Tables<"term_plans">;

type TermPlanBlock = Pick<
  TermPlanRow,
  "weeks" | "area" | "description" | "is_assessment" | "color"
>;

const colorMap: Record<FallbackTermPlanBlock["color"], string> = {
  teal: "border-l-primary bg-primary/5",
  green: "border-l-accent bg-accent/5",
  blue: "border-l-[hsl(210,60%,50%)] bg-[hsl(210,60%,50%)]/5",
  orange: "border-l-warning bg-warning/5",
  purple: "border-l-assessment bg-assessment/5",
};

const TermPlanningPage = () => {
  const [blocks, setBlocks] = useState<TermPlanBlock[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTermPlan = async () => {
      const { data } = await supabase.from("term_plans").select("*").order("sort_order");

      if (data && data.length > 0) {
        setBlocks(data);
      } else {
        setBlocks(fallbackTermPlan);
      }

      setLoading(false);
    };

    fetchTermPlan();
  }, []);

  return (
    <AppLayout>
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-bold tracking-tight">Terminsplanering</h1>
          <p className="mt-1 text-sm text-muted-foreground">Översikt over terminens arbetsomraden.</p>
        </header>

        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Laddar planering...</p>
        ) : (
          <section className="space-y-3">
            {blocks.map((block, index) => (
              <article
                key={`${block.weeks}-${block.area}-${index}`}
                className={`space-y-2 rounded-xl border border-l-4 bg-card p-5 ${
                  colorMap[block.color as keyof typeof colorMap] || ""
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {block.weeks}
                    </p>
                    <h2 className="text-lg font-bold">{block.area}</h2>
                  </div>

                  {block.is_assessment && (
                    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-assessment/10 px-2.5 py-1 text-xs font-semibold text-assessment">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Bedömning
                    </span>
                  )}
                </div>

                <p className="text-sm leading-relaxed text-muted-foreground">{block.description}</p>
              </article>
            ))}
          </section>
        )}

        <section className="flex items-start gap-3 rounded-xl border bg-card p-4">
          <BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <p className="text-sm text-muted-foreground">
            Planeringen kan ändras under terminens gång. Kontrollera veckoschemat for aktuell information.
          </p>
        </section>
      </div>
    </AppLayout>
  );
};

export default TermPlanningPage;

import { BookOpen, AlertTriangle } from "lucide-react";
import Layout from "@/components/Layout";
import { termPlan } from "@/lib/mockData";

const colorMap: Record<string, string> = {
  teal: "border-l-primary bg-primary/5",
  green: "border-l-accent bg-accent/5",
  blue: "border-l-[hsl(210,60%,50%)] bg-[hsl(210,60%,50%)]/5",
  orange: "border-l-warning bg-warning/5",
  purple: "border-l-assessment bg-assessment/5",
};

const TermPlanning = () => {
  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Terminsplanering</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Översikt över terminens arbetsområden
          </p>
        </div>

        <div className="space-y-3">
          {termPlan.map((block, i) => (
            <div
              key={i}
              className={`bg-card border border-l-4 rounded-xl p-5 space-y-2 ${
                colorMap[block.color] || ""
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {block.weeks}
                  </p>
                  <h3 className="text-lg font-bold text-card-foreground">{block.area}</h3>
                </div>
                {block.isAssessment && (
                  <span className="flex items-center gap-1 text-xs font-semibold text-assessment bg-assessment/10 px-2.5 py-1 rounded-full whitespace-nowrap">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Bedömning
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {block.description}
              </p>
            </div>
          ))}
        </div>

        <div className="bg-card border rounded-xl p-4 flex items-start gap-3">
          <BookOpen className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
          <p className="text-sm text-muted-foreground">
            Planeringen kan ändras under terminens gång. Håll koll på veckoschemat för aktuell information.
          </p>
        </div>
      </div>
    </Layout>
  );
};

export default TermPlanning;

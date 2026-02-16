export interface FallbackTermPlanBlock {
  weeks: string;
  area: string;
  description: string;
  is_assessment: boolean;
  color: "teal" | "green" | "blue" | "orange" | "purple";
}

export const fallbackTermPlan: FallbackTermPlanBlock[] = [
  {
    weeks: "v.3-5",
    area: "Bollspel",
    description: "Fotboll och innebandy. Fokus på samarbete och spelforstaelse.",
    is_assessment: false,
    color: "teal",
  },
  {
    weeks: "v.6-8",
    area: "Gymnastik",
    description: "Matta, hopp och balans. Rörelseförmåga och kroppskontroll.",
    is_assessment: true,
    color: "purple",
  },
  {
    weeks: "v.9-11",
    area: "Kondition och styrka",
    description: "Cirkelträning, löpning och styrkeövningar.",
    is_assessment: false,
    color: "green",
  },
  {
    weeks: "v.12-14",
    area: "Dans och rörelse",
    description: "Pardans och gruppdans. Kreativt skapande med musik.",
    is_assessment: true,
    color: "orange",
  },
  {
    weeks: "v.15-17",
    area: "Simning",
    description: "Simteknik och vattensäkerhet. Livräddning.",
    is_assessment: true,
    color: "blue",
  },
  {
    weeks: "v.18-20",
    area: "Friluftsliv",
    description: "Orientering, allemansrätt och utomhusaktiviteter.",
    is_assessment: false,
    color: "green",
  },
  {
    weeks: "v.21-23",
    area: "Friidrott",
    description: "Lopning, hopp och kast. Bedömning av individuell prestation.",
    is_assessment: true,
    color: "teal",
  },
];

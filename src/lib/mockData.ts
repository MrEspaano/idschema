export type ClassName = "7A" | "7F" | "8B" | "8C" | "8H";

export interface WeekDay {
  day: string;
  activity: string;
  hall: string;
  changingRoom: string;
  code: string;
  cancelled?: boolean;
}

export interface WeekSchedule {
  week: number;
  className: ClassName;
  days: WeekDay[];
}

export interface TermBlock {
  weeks: string;
  area: string;
  description: string;
  isAssessment: boolean;
  color: "teal" | "green" | "blue" | "orange" | "purple";
}

export const classes: ClassName[] = ["7A", "7F", "8B", "8C", "8H"];

const generateWeek = (week: number, className: ClassName): WeekSchedule => {
  const activities = [
    { activity: "Fotboll", hall: "Stora hallen", changingRoom: "OK1", code: "2847" },
    { activity: "Innebandy", hall: "Stora hallen", changingRoom: "OK2", code: "1593" },
    { activity: "Gymnastik", hall: "Gymnastiksalen", changingRoom: "OK1", code: "2847" },
    { activity: "Basket", hall: "Stora hallen", changingRoom: "OK3", code: "7261" },
    { activity: "Kondition & styrka", hall: "Gymmet", changingRoom: "OK2", code: "1593" },
    { activity: "Simning", hall: "Simhallen", changingRoom: "Simhallen", code: "—" },
    { activity: "Orientering", hall: "Utomhus", changingRoom: "OK1", code: "2847" },
    { activity: "Dans", hall: "Gymnastiksalen", changingRoom: "OK2", code: "1593" },
  ];

  const classIndex = classes.indexOf(className);
  const idx = (week + classIndex) % activities.length;

  const days: WeekDay[] = [];
  // Most classes have 2 lessons per week
  const lessonDays = classIndex % 2 === 0 ? ["Tisdag", "Torsdag"] : ["Måndag", "Onsdag"];

  lessonDays.forEach((day, i) => {
    const a = activities[(idx + i) % activities.length];
    days.push({
      day,
      activity: a.activity,
      hall: a.hall,
      changingRoom: a.changingRoom,
      code: a.code,
      cancelled: week === 8 && i === 1, // Example cancelled lesson
    });
  });

  return { week, className, days };
};

export const getWeekSchedule = (week: number, className: ClassName): WeekSchedule => {
  return generateWeek(week, className);
};

export const getCurrentWeek = (): number => {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const diff = now.getTime() - start.getTime();
  const oneWeek = 604800000;
  return Math.ceil((diff / oneWeek) + 1);
};

export const termPlan: TermBlock[] = [
  { weeks: "v.3–5", area: "Bollspel", description: "Fotboll och innebandy. Fokus på samarbete och spelförståelse.", isAssessment: false, color: "teal" },
  { weeks: "v.6–8", area: "Gymnastik", description: "Matta, hopp och balans. Rörelseförmåga och kroppskontroll.", isAssessment: true, color: "purple" },
  { weeks: "v.9–11", area: "Kondition & styrka", description: "Cirkelträning, löpning och styrkeövningar.", isAssessment: false, color: "green" },
  { weeks: "v.12–14", area: "Dans & rörelse", description: "Pardans och gruppdans. Kreativt skapande med musik.", isAssessment: true, color: "orange" },
  { weeks: "v.15–17", area: "Simning", description: "Simteknik och vattensäkerhet. Livräddning.", isAssessment: true, color: "blue" },
  { weeks: "v.18–20", area: "Friluftsliv", description: "Orientering, allemansrätt och utomhusaktiviteter.", isAssessment: false, color: "green" },
  { weeks: "v.21–23", area: "Friidrott", description: "Löpning, hopp och kast. Bedömning av individuell prestation.", isAssessment: true, color: "teal" },
];

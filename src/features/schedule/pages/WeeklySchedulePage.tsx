import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Calendar,
  ChevronLeft,
  ChevronRight,
  DoorOpen,
  KeyRound,
  MapPin,
  XCircle,
} from "lucide-react";
import AppLayout from "@/shared/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentWeek } from "@/shared/lib/date";
import { CLASSES, type ClassName, WEEK_DAYS } from "@/shared/constants/school";
import type { Tables } from "@/integrations/supabase/types";

type ClassDayHallRow = Tables<"class_day_halls">;
type WeeklyScheduleRow = Tables<"weekly_schedules">;
type ChangingCodeRow = Tables<"changing_room_codes">;

interface ScheduleDisplay {
  day: string;
  activity: string;
  hall: string;
  changingRoom: string;
  code: string;
  cancelled: boolean;
  isTheory: boolean;
}

const WeeklySchedulePage = () => {
  const [selectedClass, setSelectedClass] = useState<ClassName | null>(null);
  const [currentWeek, setCurrentWeek] = useState(getCurrentWeek());
  const [lessons, setLessons] = useState<ScheduleDisplay[]>([]);
  const [loading, setLoading] = useState(false);

  const isCurrentWeek = useMemo(() => currentWeek === getCurrentWeek(), [currentWeek]);

  useEffect(() => {
    if (!selectedClass) {
      setLessons([]);
      return;
    }

    const fetchSchedule = async () => {
      setLoading(true);

      const [hallsRes, schedulesRes, codesRes] = await Promise.all([
        supabase
          .from("class_day_halls")
          .select("*")
          .eq("class_name", selectedClass),
        supabase
          .from("weekly_schedules")
          .select("*")
          .eq("class_name", selectedClass)
          .eq("week_number", currentWeek),
        supabase
          .from("changing_room_codes")
          .select("*")
          .eq("week_number", currentWeek),
      ]);

      const halls = hallsRes.data ?? [];
      const schedules = schedulesRes.data ?? [];
      const codes = codesRes.data ?? [];

      const merged = halls
        .map((hallEntry) => mapLesson(hallEntry, schedules, codes))
        .sort((a, b) => WEEK_DAYS.indexOf(a.day as (typeof WEEK_DAYS)[number]) - WEEK_DAYS.indexOf(b.day as (typeof WEEK_DAYS)[number]));

      setLessons(merged);
      setLoading(false);
    };

    fetchSchedule();
  }, [selectedClass, currentWeek]);

  return (
    <AppLayout>
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-bold tracking-tight">Veckoschema</h1>
          <p className="mt-1 text-sm text-muted-foreground">Valj klass for att se schemat.</p>
        </header>

        <section className="flex flex-wrap gap-2">
          {CLASSES.map((className) => (
            <button
              key={className}
              onClick={() => setSelectedClass(className)}
              className={
                selectedClass === className
                  ? "rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm"
                  : "rounded-xl border bg-card px-5 py-3 text-sm font-semibold text-card-foreground transition-colors hover:bg-secondary"
              }
            >
              {className}
            </button>
          ))}
        </section>

        {selectedClass ? (
          <>
            <section className="flex items-center justify-between rounded-xl border bg-card p-3">
              <button
                onClick={() => setCurrentWeek((week) => week - 1)}
                className="rounded-lg p-2 transition-colors hover:bg-secondary"
                aria-label="Föregående vecka"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>

              <div className="text-center">
                <span className="text-lg font-bold">Vecka {currentWeek}</span>
                {isCurrentWeek && (
                  <span className="ml-2 rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-accent-foreground">
                    Nu
                  </span>
                )}
              </div>

              <button
                onClick={() => setCurrentWeek((week) => week + 1)}
                className="rounded-lg p-2 transition-colors hover:bg-secondary"
                aria-label="Nästa vecka"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </section>

            {loading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Laddar schema...</p>
            ) : (
              <section className="space-y-3">
                {lessons.map((lesson) => (
                  <article
                    key={lesson.day}
                    className={
                      lesson.cancelled
                        ? "space-y-3 rounded-2xl border bg-card p-5 opacity-60"
                        : "space-y-3 rounded-2xl border bg-card p-5"
                    }
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="text-lg font-bold">{lesson.day}</h2>

                      <div className="flex items-center gap-2">
                        {lesson.isTheory && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-accent-foreground">
                            <BookOpen className="h-3.5 w-3.5" />
                            Teoripass
                          </span>
                        )}

                        {lesson.cancelled && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-cancelled/10 px-2.5 py-1 text-xs font-semibold text-cancelled">
                            <XCircle className="h-3.5 w-3.5" />
                            Inställd
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="text-xl font-semibold text-primary">
                      {lesson.cancelled ? <s>{lesson.activity}</s> : lesson.activity}
                    </p>

                    <p className="text-sm text-muted-foreground">
                      {lesson.isTheory ? "Ta med dator. Inget ombyte." : "Ombyte och dator med."}
                    </p>

                    <div className="grid grid-cols-3 gap-3 pt-1">
                      <InfoBlock icon={MapPin} label="Sal" value={lesson.hall} />
                      <InfoBlock icon={DoorOpen} label="Omkl." value={lesson.changingRoom} />
                      <InfoBlock icon={KeyRound} label="Kod" value={lesson.code} valueClassName="font-bold text-primary" />
                    </div>
                  </article>
                ))}

                {lessons.length === 0 && (
                  <p className="py-8 text-center text-sm text-muted-foreground">Inget schema for denna vecka.</p>
                )}
              </section>
            )}
          </>
        ) : (
          <div className="py-16 text-center text-muted-foreground">
            <Calendar className="mx-auto mb-3 h-12 w-12 opacity-40" />
            <p className="text-sm font-medium">Valj en klass ovan for att se schemat.</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

const mapLesson = (
  hallEntry: ClassDayHallRow,
  schedules: WeeklyScheduleRow[],
  codes: ChangingCodeRow[],
): ScheduleDisplay => {
  const schedule = schedules.find((item) => item.day === hallEntry.day);

  if (!schedule) {
    return {
      day: hallEntry.day,
      activity: "Ingen aktivitet inlagd",
      hall: hallEntry.hall,
      changingRoom: "-",
      code: "-",
      cancelled: false,
      isTheory: false,
    };
  }

  const matchingCode = codes.find(
    (item) => item.day === hallEntry.day && item.changing_room === schedule.changing_room,
  );

  return {
    day: hallEntry.day,
    activity: schedule.activity,
    hall: hallEntry.hall,
    changingRoom: schedule.changing_room || "-",
    code: matchingCode?.code || "-",
    cancelled: schedule.cancelled,
    isTheory: schedule.is_theory,
  };
};

interface InfoBlockProps {
  icon: typeof MapPin;
  label: string;
  value: string;
  valueClassName?: string;
}

const InfoBlock = ({ icon: Icon, label, value, valueClassName }: InfoBlockProps) => {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={valueClassName || "text-sm font-medium"}>{value}</p>
      </div>
    </div>
  );
};

export default WeeklySchedulePage;

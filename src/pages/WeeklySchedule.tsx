import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, MapPin, DoorOpen, KeyRound, XCircle, Calendar, BookOpen } from "lucide-react";
import Layout from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentWeek } from "@/lib/mockData";

const CLASSES = ["7A", "7F", "8B", "8C", "8H"];

interface ClassDayHall {
  class_name: string;
  day: string;
  hall: string;
}

interface ScheduleDisplay {
  day: string;
  activity: string;
  hall: string;
  changingRoom: string;
  code: string;
  cancelled: boolean;
  isTheory: boolean;
}

const WeeklySchedule = () => {
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [currentWeek, setCurrentWeek] = useState(getCurrentWeek());
  const [lessons, setLessons] = useState<ScheduleDisplay[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedClass) return;

    const fetchSchedule = async () => {
      setLoading(true);

      // Fetch class day halls, weekly schedules, and codes in parallel
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

      const halls: ClassDayHall[] = hallsRes.data || [];
      const schedules = schedulesRes.data || [];
      const codes = codesRes.data || [];

      // Build display: for each class day, merge schedule + hall + code
      const dayOrder = ["Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag"];
      const result: ScheduleDisplay[] = [];

      for (const hallEntry of halls) {
        const schedule = schedules.find((s: any) => s.day === hallEntry.day);
        if (!schedule) {
          // Day exists in structure but no lesson scheduled this week
          result.push({
            day: hallEntry.day,
            activity: "Ingen aktivitet inlagd",
            hall: hallEntry.hall,
            changingRoom: "–",
            code: "–",
            cancelled: false,
            isTheory: false,
          });
          continue;
        }

        // Look up code from changing_room_codes
        let code = "–";
        if (schedule.changing_room && schedule.changing_room !== "–") {
          const codeEntry = codes.find(
            (c: any) => c.day === hallEntry.day && c.changing_room === schedule.changing_room
          );
          code = codeEntry ? codeEntry.code : "–";
        }

        result.push({
          day: hallEntry.day,
          activity: schedule.activity,
          hall: hallEntry.hall,
          changingRoom: schedule.changing_room || "–",
          code,
          cancelled: schedule.cancelled,
          isTheory: schedule.is_theory || false,
        });
      }

      // Sort by day order
      result.sort((a, b) => dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day));
      setLessons(result);
      setLoading(false);
    };

    fetchSchedule();
  }, [selectedClass, currentWeek]);

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Veckoschema</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Välj din klass för att se schemat
          </p>
        </div>

        {/* Class selector */}
        <div className="flex gap-2 flex-wrap">
          {CLASSES.map((cls) => (
            <button
              key={cls}
              onClick={() => setSelectedClass(cls)}
              className={`px-5 py-3 rounded-xl font-semibold text-sm transition-all ${
                selectedClass === cls
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "bg-card border text-card-foreground hover:bg-secondary"
              }`}
            >
              {cls}
            </button>
          ))}
        </div>

        {selectedClass && (
          <>
            {/* Week navigator */}
            <div className="flex items-center justify-between bg-card border rounded-xl p-3">
              <button
                onClick={() => setCurrentWeek((w) => w - 1)}
                className="p-2 rounded-lg hover:bg-secondary transition-colors"
                aria-label="Föregående vecka"
              >
                <ChevronLeft className="w-5 h-5 text-foreground" />
              </button>
              <div className="text-center">
                <span className="text-lg font-bold text-foreground">Vecka {currentWeek}</span>
                {currentWeek === getCurrentWeek() && (
                  <span className="ml-2 text-xs bg-accent text-accent-foreground px-2.5 py-0.5 rounded-full font-medium">
                    Nu
                  </span>
                )}
              </div>
              <button
                onClick={() => setCurrentWeek((w) => w + 1)}
                className="p-2 rounded-lg hover:bg-secondary transition-colors"
                aria-label="Nästa vecka"
              >
                <ChevronRight className="w-5 h-5 text-foreground" />
              </button>
            </div>

            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Laddar schema...</div>
            ) : (
              <div className="space-y-3">
                {lessons.map((lesson, i) => (
                  <div
                    key={i}
                    className={`bg-card border rounded-2xl p-5 space-y-3 ${
                      lesson.cancelled ? "opacity-60" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-lg text-card-foreground">{lesson.day}</h3>
                      <div className="flex items-center gap-2">
                        {lesson.isTheory && (
                          <span className="flex items-center gap-1 text-xs font-semibold text-accent-foreground bg-accent px-2.5 py-1 rounded-full">
                            <BookOpen className="w-3.5 h-3.5" />
                            Teoripass
                          </span>
                        )}
                        {lesson.cancelled && (
                          <span className="flex items-center gap-1 text-xs font-semibold text-cancelled bg-cancelled/10 px-2.5 py-1 rounded-full">
                            <XCircle className="w-3.5 h-3.5" />
                            Inställd
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-xl font-semibold text-primary">
                      {lesson.cancelled ? <s>{lesson.activity}</s> : lesson.activity}
                    </div>

                    {/* Info text based on theory toggle */}
                    <p className="text-sm text-muted-foreground">
                      {lesson.isTheory
                        ? "Dator med. Inget ombyte."
                        : "Ombyte och dator med."}
                    </p>

                    <div className="grid grid-cols-3 gap-3 pt-1">
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">Sal</p>
                          <p className="text-sm font-medium text-card-foreground">{lesson.hall}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <DoorOpen className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">Omkl.</p>
                          <p className="text-sm font-medium text-card-foreground">{lesson.changingRoom}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <KeyRound className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">Kod</p>
                          <p className="text-sm font-bold text-primary">{lesson.code}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {lessons.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    Inget schema för denna vecka
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {!selectedClass && (
          <div className="text-center py-16 text-muted-foreground">
            <Calendar className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p className="font-medium">Välj en klass ovan för att se schemat</p>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default WeeklySchedule;

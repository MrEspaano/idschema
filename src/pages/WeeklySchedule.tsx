import { useState } from "react";
import { ChevronLeft, ChevronRight, MapPin, DoorOpen, KeyRound, XCircle, Calendar } from "lucide-react";
import Layout from "@/components/Layout";
import { classes, getWeekSchedule, getCurrentWeek, type ClassName } from "@/lib/mockData";

const WeeklySchedule = () => {
  const [selectedClass, setSelectedClass] = useState<ClassName | null>(null);
  const [currentWeek, setCurrentWeek] = useState(getCurrentWeek());

  const schedule = selectedClass ? getWeekSchedule(currentWeek, selectedClass) : null;

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
          {classes.map((cls) => (
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

            {/* Schedule cards */}
            <div className="space-y-3">
              {schedule?.days.map((day, i) => (
                <div
                  key={i}
                  className={`bg-card border rounded-2xl p-5 space-y-3 ${
                    day.cancelled ? "opacity-60" : ""
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-lg text-card-foreground">{day.day}</h3>
                    {day.cancelled && (
                      <span className="flex items-center gap-1 text-xs font-semibold text-cancelled bg-cancelled/10 px-2.5 py-1 rounded-full">
                        <XCircle className="w-3.5 h-3.5" />
                        Inställd
                      </span>
                    )}
                  </div>

                  <div className="text-xl font-semibold text-primary">
                    {day.cancelled ? <s>{day.activity}</s> : day.activity}
                  </div>

                  <div className="grid grid-cols-3 gap-3 pt-1">
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">Sal</p>
                        <p className="text-sm font-medium text-card-foreground">{day.hall}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <DoorOpen className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">Omkl.</p>
                        <p className="text-sm font-medium text-card-foreground">{day.changingRoom}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <KeyRound className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">Kod</p>
                        <p className="text-sm font-bold text-primary">{day.code}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
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

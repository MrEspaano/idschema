import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Trash2, Upload } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import AppLayout from "@/shared/layout/AppLayout";
import { useAuth } from "@/features/auth/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { WEEK_DAYS } from "@/shared/constants/school";
import type { Tables } from "@/integrations/supabase/types";

type CodeRow = Tables<"changing_room_codes">;

const AdminCodesPage = () => {
  const { isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [codes, setCodes] = useState<CodeRow[]>([]);
  const [weekFilter, setWeekFilter] = useState<number | "">("");

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      navigate("/admin/login");
    }
  }, [authLoading, isAdmin, navigate]);

  const loadCodes = useCallback(async () => {
    let query = supabase
      .from("changing_room_codes")
      .select("*")
      .order("week_number")
      .order("day");

    if (weekFilter !== "") {
      query = query.eq("week_number", weekFilter);
    }

    const { data } = await query;
    setCodes(data ?? []);
  }, [weekFilter]);

  useEffect(() => {
    loadCodes();
  }, [loadCodes]);

  const handleCsvUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const content = await file.text();
    const lines = content.trim().split("\n");

    if (lines.length < 2) {
      toast.error("CSV-filen ar tom eller saknar data.");
      return;
    }

    const separator = lines[0].includes(";") ? ";" : ",";
    const header = lines[0].split(separator).map((column) => column.trim().toLowerCase());

    const weekIndex = header.findIndex((column) => column.includes("vecka") || column.includes("week"));
    const dayIndex = header.findIndex((column) => column.includes("dag") || column.includes("day"));
    const roomIndex = header.findIndex(
      (column) =>
        column.includes("omkl") || column.includes("room") || column.includes("changing"),
    );
    const codeIndex = header.findIndex((column) => column.includes("kod") || column.includes("code"));

    if (weekIndex < 0 || dayIndex < 0 || roomIndex < 0 || codeIndex < 0) {
      toast.error("CSV maste innehalla vecka, dag, omklädningsrum och kod.");
      return;
    }

    const rows: Omit<CodeRow, "id" | "created_at" | "updated_at">[] = [];

    for (const line of lines.slice(1)) {
      const values = line.split(separator).map((value) => value.trim());
      if (values.length < 4) {
        continue;
      }

      const weekNumber = Number.parseInt(values[weekIndex], 10);
      if (Number.isNaN(weekNumber)) {
        continue;
      }

      rows.push({
        week_number: weekNumber,
        day: values[dayIndex],
        changing_room: values[roomIndex],
        code: values[codeIndex],
      });
    }

    if (rows.length === 0) {
      toast.error("Inga giltiga rader hittades i filen.");
      return;
    }

    const weeks = [...new Set(rows.map((row) => row.week_number))];

    for (const week of weeks) {
      await supabase.from("changing_room_codes").delete().eq("week_number", week);
    }

    const { error } = await supabase.from("changing_room_codes").insert(rows);

    if (error) {
      console.error(error);
      toast.error("Kunde inte importera. Kontrollera formatet.");
    } else {
      toast.success(`${rows.length} koder importerade.`);
      await loadCodes();
    }

    event.target.value = "";
  };

  const deleteWeek = async (weekNumber: number) => {
    await supabase.from("changing_room_codes").delete().eq("week_number", weekNumber);
    toast.success(`Vecka ${weekNumber} borttagen.`);
    await loadCodes();
  };

  const groupedByWeek = useMemo(() => {
    return codes.reduce<Record<number, CodeRow[]>>((groups, row) => {
      if (!groups[row.week_number]) {
        groups[row.week_number] = [];
      }

      groups[row.week_number].push(row);
      return groups;
    }, {});
  }, [codes]);

  if (authLoading) {
    return (
      <AppLayout>
        <p className="py-16 text-center text-sm text-muted-foreground">Laddar...</p>
      </AppLayout>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <AppLayout>
      <div className="space-y-5">
        <header className="flex items-center gap-3">
          <Link to="/admin" className="rounded-lg p-2 transition-colors hover:bg-secondary">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Koddokument</h1>
            <p className="text-sm text-muted-foreground">Importera omklädningsrumskoder via CSV.</p>
          </div>
        </header>

        <section className="space-y-3 rounded-xl border bg-card p-5">
          <h2 className="font-semibold">Importera CSV</h2>
          <p className="text-sm text-muted-foreground">
            Filen ska ha kolumnerna: vecka, dag, omklädningsrum, kod. Separator kan vara semikolon
            eller komma.
          </p>

          <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary">
            <Upload className="h-4 w-4" />
            Valj CSV-fil
            <input type="file" accept=".csv,.txt" onChange={handleCsvUpload} className="hidden" />
          </label>
        </section>

        <section className="flex items-center gap-3">
          <label htmlFor="week-filter" className="text-sm font-medium">
            Filtrera vecka:
          </label>
          <input
            id="week-filter"
            type="number"
            value={weekFilter}
            onChange={(event) =>
              setWeekFilter(event.target.value ? Number(event.target.value) : "")
            }
            placeholder="Alla"
            className="w-20 rounded-xl border bg-card px-3 py-2 text-center text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            min={1}
            max={53}
          />
        </section>

        <section className="space-y-4">
          {Object.entries(groupedByWeek)
            .sort(([weekA], [weekB]) => Number(weekA) - Number(weekB))
            .map(([week, weekCodes]) => (
              <article key={week} className="space-y-2 rounded-xl border bg-card p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold">Vecka {week}</h3>
                  <button
                    onClick={() => deleteWeek(Number(week))}
                    className="rounded-lg p-1.5 text-destructive transition-colors hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid gap-1">
                  {[...weekCodes]
                    .sort(
                      (a, b) =>
                        WEEK_DAYS.indexOf(a.day as (typeof WEEK_DAYS)[number]) -
                        WEEK_DAYS.indexOf(b.day as (typeof WEEK_DAYS)[number]),
                    )
                    .map((codeRow) => (
                      <div
                        key={codeRow.id}
                        className="flex items-center justify-between text-sm text-muted-foreground"
                      >
                        <span>
                          {codeRow.day} - {codeRow.changing_room}
                        </span>
                        <span className="font-mono font-bold text-foreground">{codeRow.code}</span>
                      </div>
                    ))}
                </div>
              </article>
            ))}

          {Object.keys(groupedByWeek).length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">Inga koder importerade ännu.</p>
          )}
        </section>
      </div>
    </AppLayout>
  );
};

export default AdminCodesPage;

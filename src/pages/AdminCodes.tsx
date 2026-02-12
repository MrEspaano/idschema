import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Upload, Trash2, Save } from "lucide-react";
import Layout from "@/components/Layout";
import { Link } from "react-router-dom";
import { toast } from "sonner";

const DAYS = ["Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag"];
const CHANGING_ROOMS = ["1&2", "3&4", "5&6"];

interface CodeRow {
  id?: string;
  week_number: number;
  day: string;
  changing_room: string;
  code: string;
}

const AdminCodes = () => {
  const { isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [codes, setCodes] = useState<CodeRow[]>([]);
  const [weekFilter, setWeekFilter] = useState<number | "">("");

  useEffect(() => {
    if (!authLoading && !isAdmin) navigate("/admin/login");
  }, [authLoading, isAdmin, navigate]);

  useEffect(() => {
    loadCodes();
  }, [weekFilter]);

  const loadCodes = async () => {
    let query = supabase.from("changing_room_codes").select("*").order("week_number").order("day");
    if (weekFilter !== "") {
      query = query.eq("week_number", weekFilter);
    }
    const { data } = await query;
    if (data) setCodes(data as CodeRow[]);
  };

  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const lines = text.trim().split("\n");
    // Expected format: week_number;day;changing_room;code (semicolon or comma separated)
    const separator = lines[0].includes(";") ? ";" : ",";
    const header = lines[0].split(separator).map((h) => h.trim().toLowerCase());

    // Try to detect columns
    const weekIdx = header.findIndex((h) => h.includes("vecka") || h.includes("week"));
    const dayIdx = header.findIndex((h) => h.includes("dag") || h.includes("day"));
    const roomIdx = header.findIndex((h) => h.includes("omkl") || h.includes("room") || h.includes("changing"));
    const codeIdx = header.findIndex((h) => h.includes("kod") || h.includes("code"));

    if (weekIdx === -1 || dayIdx === -1 || roomIdx === -1 || codeIdx === -1) {
      toast.error("CSV-filen måste ha kolumner: vecka, dag, omklädningsrum, kod");
      return;
    }

    const rows: Omit<CodeRow, "id">[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(separator).map((c) => c.trim());
      if (cols.length < 4) continue;
      const wn = parseInt(cols[weekIdx]);
      if (isNaN(wn)) continue;
      rows.push({
        week_number: wn,
        day: cols[dayIdx],
        changing_room: cols[roomIdx],
        code: cols[codeIdx],
      });
    }

    if (rows.length === 0) {
      toast.error("Inga giltiga rader hittades i filen.");
      return;
    }

    // Upsert: delete existing for these weeks, then insert
    const weeks = [...new Set(rows.map((r) => r.week_number))];
    for (const w of weeks) {
      await supabase.from("changing_room_codes").delete().eq("week_number", w);
    }

    const { error } = await supabase.from("changing_room_codes").insert(rows);
    if (error) {
      toast.error("Kunde inte importera. Kontrollera formatet.");
      console.error(error);
    } else {
      toast.success(`${rows.length} koder importerade!`);
      loadCodes();
    }

    // Reset file input
    e.target.value = "";
  };

  const deleteWeek = async (weekNum: number) => {
    await supabase.from("changing_room_codes").delete().eq("week_number", weekNum);
    toast.success(`Vecka ${weekNum} borttagen`);
    loadCodes();
  };

  if (authLoading) return <Layout><div className="text-center py-16 text-muted-foreground">Laddar...</div></Layout>;
  if (!isAdmin) return null;

  // Group codes by week
  const byWeek = codes.reduce<Record<number, CodeRow[]>>((acc, c) => {
    if (!acc[c.week_number]) acc[c.week_number] = [];
    acc[c.week_number].push(c);
    return acc;
  }, {});

  return (
    <Layout>
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <Link to="/admin" className="p-2 rounded-lg hover:bg-secondary transition-colors">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-foreground">Koddokument</h1>
            <p className="text-sm text-muted-foreground">Importera koder via CSV-fil</p>
          </div>
        </div>

        {/* CSV upload */}
        <div className="bg-card border rounded-xl p-5 space-y-3">
          <h2 className="font-semibold text-card-foreground">Importera CSV</h2>
          <p className="text-sm text-muted-foreground">
            Filen ska ha kolumnerna: <strong>vecka</strong>, <strong>dag</strong>, <strong>omklädningsrum</strong>, <strong>kod</strong>
            <br />
            Separera med semikolon (;) eller komma (,).
          </p>
          <label className="flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors font-medium text-sm cursor-pointer">
            <Upload className="w-4 h-4" />
            Välj CSV-fil
            <input
              type="file"
              accept=".csv,.txt"
              onChange={handleCsvUpload}
              className="hidden"
            />
          </label>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-foreground">Filtrera vecka:</label>
          <input
            type="number"
            value={weekFilter}
            onChange={(e) => setWeekFilter(e.target.value ? Number(e.target.value) : "")}
            placeholder="Alla"
            className="w-20 px-3 py-2 rounded-xl border bg-card text-card-foreground text-center focus:outline-none focus:ring-2 focus:ring-ring"
            min={1}
            max={53}
          />
        </div>

        {/* Code listing */}
        <div className="space-y-4">
          {Object.entries(byWeek)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([week, weekCodes]) => (
              <div key={week} className="bg-card border rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-card-foreground">Vecka {week}</h3>
                  <button
                    onClick={() => deleteWeek(Number(week))}
                    className="p-1.5 text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid gap-1">
                  {weekCodes
                    .sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day))
                    .map((c, i) => (
                      <div key={i} className="flex justify-between text-sm text-muted-foreground">
                        <span>{c.day} – {c.changing_room}</span>
                        <span className="font-mono font-bold text-foreground">{c.code}</span>
                      </div>
                    ))}
                </div>
              </div>
            ))}
          {Object.keys(byWeek).length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              Inga koder importerade ännu
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default AdminCodes;

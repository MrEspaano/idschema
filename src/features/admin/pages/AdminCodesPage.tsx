import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Trash2, Upload } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import AppLayout from "@/shared/layout/AppLayout";
import { useAuth } from "@/features/auth/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { CHANGING_ROOMS, WEEK_DAYS } from "@/shared/constants/school";
import type { Tables } from "@/integrations/supabase/types";

type CodeRow = Tables<"changing_room_codes">;
type ImportCodeRow = Omit<CodeRow, "id" | "created_at" | "updated_at">;

interface ParseResult {
  rows: ImportCodeRow[];
  skippedRows: number;
  detectedFormat: string;
}

interface DayRoomColumn {
  index: number;
  day: string;
  room: string;
}

const HEADER_SCAN_ROWS = 6;

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

    const content = await decodeFileContent(file);
    const parsed = parseCodeDocument(content);

    if (!parsed || parsed.rows.length === 0) {
      toast.error(
        "Kunde inte tolka filen. Använd format: vecka;dag;omklädningsrum;kod eller vecka;dag;1&2;3&4;5&6.",
      );
      event.target.value = "";
      return;
    }

    const weeks = [...new Set(parsed.rows.map((row) => row.week_number))];

    for (const week of weeks) {
      await supabase.from("changing_room_codes").delete().eq("week_number", week);
    }

    const { error } = await supabase.from("changing_room_codes").insert(parsed.rows);

    if (error) {
      console.error(error);
      toast.error("Kunde inte importera. Kontrollera formatet och försök igen.");
    } else {
      toast.success(
        `${parsed.rows.length} koder importerade (${parsed.detectedFormat}).`,
      );

      if (parsed.skippedRows > 0) {
        toast.info(`${parsed.skippedRows} rader hoppades över eftersom de saknade vecka, dag, omklädningsrum eller kod.`);
      }

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
            Stödjer flera format, till exempel:
            <br />
            1) vecka;dag;omklädningsrum;kod
            <br />
            2) vecka;dag;1&2;3&4;5&6
            <br />
            3) vecka;Måndag 1&2;Måndag 3&4;...;Fredag 5&6
          </p>

          <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary">
            <Upload className="h-4 w-4" />
            Välj CSV-fil
            <input type="file" accept=".csv,.txt,.tsv" onChange={handleCsvUpload} className="hidden" />
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

const decodeFileContent = async (file: File): Promise<string> => {
  const buffer = await file.arrayBuffer();

  let content = new TextDecoder("utf-8").decode(buffer);
  if (content.includes("\uFFFD")) {
    content = new TextDecoder("latin1").decode(buffer);
  }

  return content;
};

const parseCodeDocument = (content: string): ParseResult | null => {
  const table = parseTable(content);
  if (table.length === 0) {
    return null;
  }

  const parsers = [
    parseLongFormat,
    parseDayWithRoomColumnsFormat,
    parseWeekMatrixFormat,
    parseNoHeaderLongFormat,
  ];

  for (const parser of parsers) {
    const parsed = parser(table);
    if (parsed && parsed.rows.length > 0) {
      return {
        ...parsed,
        rows: dedupeRows(parsed.rows),
      };
    }
  }

  return null;
};

const parseLongFormat = (table: string[][]): ParseResult | null => {
  for (let headerRow = 0; headerRow < Math.min(HEADER_SCAN_ROWS, table.length); headerRow += 1) {
    const header = table[headerRow].map(normalizeText);

    const weekIndex = header.findIndex(isWeekHeader);
    const dayIndex = header.findIndex(isDayHeader);
    const roomIndex = header.findIndex(isRoomHeader);
    const codeIndex = header.findIndex(isCodeHeader);

    if (weekIndex < 0 || dayIndex < 0 || roomIndex < 0 || codeIndex < 0) {
      continue;
    }

    const rows: ImportCodeRow[] = [];
    let skippedRows = 0;

    for (const row of table.slice(headerRow + 1)) {
      const weekNumber = extractWeekNumber(row[weekIndex]);
      const day = normalizeDay(row[dayIndex]);
      const room = normalizeRoom(row[roomIndex]);
      const code = (row[codeIndex] ?? "").trim();

      if (!weekNumber || !day || !room || !code) {
        skippedRows += 1;
        continue;
      }

      rows.push({
        week_number: weekNumber,
        day,
        changing_room: room,
        code,
      });
    }

    if (rows.length > 0) {
      return { rows, skippedRows, detectedFormat: "radformat" };
    }
  }

  return null;
};

const parseDayWithRoomColumnsFormat = (table: string[][]): ParseResult | null => {
  for (let headerRow = 0; headerRow < Math.min(HEADER_SCAN_ROWS, table.length); headerRow += 1) {
    const header = table[headerRow];
    const normalizedHeader = header.map(normalizeText);

    const weekIndex = normalizedHeader.findIndex(isWeekHeader);
    const dayIndex = normalizedHeader.findIndex(isDayHeader);

    if (weekIndex < 0 || dayIndex < 0) {
      continue;
    }

    const roomColumns = header
      .map((cell, index) => ({ index, room: normalizeRoom(cell) }))
      .filter((entry) => entry.room !== null);

    if (roomColumns.length === 0) {
      continue;
    }

    const rows: ImportCodeRow[] = [];
    let skippedRows = 0;

    for (const row of table.slice(headerRow + 1)) {
      const weekNumber = extractWeekNumber(row[weekIndex]);
      const day = normalizeDay(row[dayIndex]);

      if (!weekNumber || !day) {
        skippedRows += 1;
        continue;
      }

      let importedFromCurrentRow = 0;

      for (const entry of roomColumns) {
        const code = (row[entry.index] ?? "").trim();
        if (!code || !entry.room) {
          continue;
        }

        rows.push({
          week_number: weekNumber,
          day,
          changing_room: entry.room,
          code,
        });

        importedFromCurrentRow += 1;
      }

      if (importedFromCurrentRow === 0) {
        skippedRows += 1;
      }
    }

    if (rows.length > 0) {
      return { rows, skippedRows, detectedFormat: "vecka-dag-omklädningsrum-kolumner" };
    }
  }

  return null;
};

const parseWeekMatrixFormat = (table: string[][]): ParseResult | null => {
  for (let headerRow = 0; headerRow < Math.min(HEADER_SCAN_ROWS, table.length); headerRow += 1) {
    const header = table[headerRow];
    const normalizedHeader = header.map(normalizeText);

    const weekIndex = normalizedHeader.findIndex(isWeekHeader);
    if (weekIndex < 0) {
      continue;
    }

    const dayRoomColumns: DayRoomColumn[] = [];

    header.forEach((cell, index) => {
      const day = normalizeDay(cell);
      const room = normalizeRoom(cell);

      if (index !== weekIndex && day && room) {
        dayRoomColumns.push({ index, day, room });
      }
    });

    if (dayRoomColumns.length === 0) {
      continue;
    }

    const rows: ImportCodeRow[] = [];
    let skippedRows = 0;

    for (const row of table.slice(headerRow + 1)) {
      const weekNumber = extractWeekNumber(row[weekIndex]);

      if (!weekNumber) {
        skippedRows += 1;
        continue;
      }

      let importedFromCurrentRow = 0;

      for (const column of dayRoomColumns) {
        const code = (row[column.index] ?? "").trim();
        if (!code) {
          continue;
        }

        rows.push({
          week_number: weekNumber,
          day: column.day,
          changing_room: column.room,
          code,
        });

        importedFromCurrentRow += 1;
      }

      if (importedFromCurrentRow === 0) {
        skippedRows += 1;
      }
    }

    if (rows.length > 0) {
      return { rows, skippedRows, detectedFormat: "veckomatriss" };
    }
  }

  return null;
};

const parseNoHeaderLongFormat = (table: string[][]): ParseResult | null => {
  const rows: ImportCodeRow[] = [];
  let skippedRows = 0;

  for (const row of table) {
    if (row.length < 4) {
      skippedRows += 1;
      continue;
    }

    const weekNumber = extractWeekNumber(row[0]);
    const day = normalizeDay(row[1]);
    const room = normalizeRoom(row[2]);
    const code = (row[3] ?? "").trim();

    if (!weekNumber || !day || !room || !code) {
      skippedRows += 1;
      continue;
    }

    rows.push({
      week_number: weekNumber,
      day,
      changing_room: room,
      code,
    });
  }

  if (rows.length === 0) {
    return null;
  }

  return { rows, skippedRows, detectedFormat: "radformat utan header" };
};

const parseTable = (content: string): string[][] => {
  const lines = content
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return [];
  }

  const delimiter = detectDelimiter(lines[0]);
  return lines.map((line) => splitDelimitedLine(line, delimiter));
};

const detectDelimiter = (line: string): string => {
  const candidates = [";", "\t", ",", "|"] as const;

  let selected = ";";
  let highestCount = -1;

  for (const candidate of candidates) {
    const count = line.split(candidate).length - 1;
    if (count > highestCount) {
      highestCount = count;
      selected = candidate;
    }
  }

  return selected;
};

const splitDelimitedLine = (line: string, delimiter: string): string[] => {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (character === '"') {
      const nextCharacter = line[index + 1];
      if (inQuotes && nextCharacter === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && character === delimiter) {
      result.push(current.trim());
      current = "";
      continue;
    }

    current += character;
  }

  result.push(current.trim());
  return result;
};

const dedupeRows = (rows: ImportCodeRow[]): ImportCodeRow[] => {
  const map = new Map<string, ImportCodeRow>();

  for (const row of rows) {
    const key = `${row.week_number}-${row.day}-${row.changing_room}`;
    map.set(key, row);
  }

  return [...map.values()];
};

const normalizeText = (value: string | undefined): string => {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
};

const isWeekHeader = (value: string): boolean => {
  return (
    value === "v" ||
    value.startsWith("v.") ||
    value.includes("vecka") ||
    value.includes("veckonummer") ||
    value.includes("week")
  );
};

const isDayHeader = (value: string): boolean => {
  return value.includes("dag") || value.includes("day");
};

const isRoomHeader = (value: string): boolean => {
  return value.includes("omkl") || value.includes("omklad") || value.includes("room") || value.includes("changing");
};

const isCodeHeader = (value: string): boolean => {
  return value.includes("kod") || value.includes("code");
};

const extractWeekNumber = (value: string | undefined): number | null => {
  const match = (value ?? "").match(/\d{1,2}/);
  if (!match) {
    return null;
  }

  const week = Number.parseInt(match[0], 10);
  if (week < 1 || week > 53) {
    return null;
  }

  return week;
};

const normalizeDay = (value: string | undefined): string | null => {
  const normalized = normalizeText(value).replace(/\./g, "");

  if (!normalized) {
    return null;
  }

  const aliases: Array<{ day: string; matches: string[] }> = [
    { day: "Måndag", matches: ["man", "mandag", "monday", "mon"] },
    { day: "Tisdag", matches: ["tis", "tisdag", "tuesday", "tue", "tues"] },
    { day: "Onsdag", matches: ["ons", "onsdag", "wednesday", "wed"] },
    { day: "Torsdag", matches: ["tor", "tors", "torsdag", "thursday", "thu", "thurs"] },
    { day: "Fredag", matches: ["fre", "fredag", "friday", "fri"] },
  ];

  for (const alias of aliases) {
    if (alias.matches.some((match) => normalized === match || normalized.includes(`${match} `) || normalized.endsWith(` ${match}`))) {
      return alias.day;
    }
  }

  return null;
};

const normalizeRoom = (value: string | undefined): string | null => {
  const normalized = normalizeText(value);
  if (!normalized) {
    return null;
  }

  const digitsOnly = normalized.replace(/[^0-9]/g, "");

  if (/1\s*(?:&|\/|-|och)\s*2/.test(normalized) || digitsOnly === "12") {
    return CHANGING_ROOMS[0];
  }

  if (/3\s*(?:&|\/|-|och)\s*4/.test(normalized) || digitsOnly === "34") {
    return CHANGING_ROOMS[1];
  }

  if (/5\s*(?:&|\/|-|och)\s*6/.test(normalized) || digitsOnly === "56") {
    return CHANGING_ROOMS[2];
  }

  return null;
};

export default AdminCodesPage;

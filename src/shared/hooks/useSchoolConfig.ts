import { useCallback, useEffect, useState } from "react";
import { getSchoolConfig, saveSchoolConfig } from "@/features/admin/lib/adminData";
import { DEFAULT_SCHOOL_CONFIG, type SchoolConfig } from "@/shared/constants/school";

interface UseSchoolConfigResult {
  config: SchoolConfig;
  loading: boolean;
  refresh: () => Promise<void>;
  save: (nextConfig: Partial<SchoolConfig>, actorEmail?: string | null) => Promise<SchoolConfig>;
}

export const useSchoolConfig = (): UseSchoolConfigResult => {
  const [config, setConfig] = useState<SchoolConfig>(DEFAULT_SCHOOL_CONFIG);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const loaded = await getSchoolConfig();
    setConfig(loaded);
    setLoading(false);
  }, []);

  const save = useCallback(async (nextConfig: Partial<SchoolConfig>, actorEmail?: string | null) => {
    const saved = await saveSchoolConfig(nextConfig, actorEmail);
    setConfig(saved);
    return saved;
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    config,
    loading,
    refresh,
    save,
  };
};

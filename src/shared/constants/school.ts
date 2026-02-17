export const DEFAULT_CLASSES = ["7A", "7F", "8B", "8C", "8H"] as const;
export const DEFAULT_WEEK_DAYS = ["Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag"] as const;
export const DEFAULT_HALLS = ["Gy-sal", "Freja A", "Freja B"] as const;
export const DEFAULT_CHANGING_ROOMS = ["1&2", "3&4", "5&6"] as const;

export interface SchoolConfig {
  classes: string[];
  weekDays: string[];
  halls: string[];
  changingRooms: string[];
  updatedAt: string;
}

export const DEFAULT_SCHOOL_CONFIG: SchoolConfig = {
  classes: [...DEFAULT_CLASSES],
  weekDays: [...DEFAULT_WEEK_DAYS],
  halls: [...DEFAULT_HALLS],
  changingRooms: [...DEFAULT_CHANGING_ROOMS],
  updatedAt: new Date(0).toISOString(),
};

// Legacy exports retained for backwards compatibility.
export const CLASSES = DEFAULT_CLASSES;
export type ClassName = (typeof DEFAULT_CLASSES)[number];

export const WEEK_DAYS = DEFAULT_WEEK_DAYS;
export type WeekDay = (typeof DEFAULT_WEEK_DAYS)[number];

export const HALLS = DEFAULT_HALLS;
export type Hall = (typeof DEFAULT_HALLS)[number];

export const CHANGING_ROOMS = DEFAULT_CHANGING_ROOMS;
export type ChangingRoom = (typeof DEFAULT_CHANGING_ROOMS)[number];

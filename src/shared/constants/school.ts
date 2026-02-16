export const CLASSES = ["7A", "7F", "8B", "8C", "8H"] as const;
export type ClassName = (typeof CLASSES)[number];

export const WEEK_DAYS = ["Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag"] as const;
export type WeekDay = (typeof WEEK_DAYS)[number];

export const HALLS = ["Gy-sal", "Freja A", "Freja B"] as const;
export type Hall = (typeof HALLS)[number];

export const CHANGING_ROOMS = ["1&2", "3&4", "5&6"] as const;
export type ChangingRoom = (typeof CHANGING_ROOMS)[number];

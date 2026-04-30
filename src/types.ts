// plugin global settings including raw and parsed yaml
export interface HabitDashboardSettings {
    yamlConfig: string;
    parsedConfig: any;
}

// global multipliers and factors for xp calculation
export interface XpSettings {
    globalFactor: number;
    treeFactor: number;
    taskMultiplier: number;
    minutesPerXp: number;
    sleepBaseHours: number;
    sleepXpMultiplier: number;
}

// classification for trackers as either habits or metrics
export type StatType = "habit" | "metric";

// logical rules for how streaks are tracked or broken
export type StreakType = "positive" | "negative" | "none";

// format of the recorded data like rating or time
export type DataType = "rating" | "time" | "amount";

// limits and default values for numeric property data
export interface Boundaries {
    min: number;
    default: number;
    max: number;
}

// visual style rules for heatmap cell coloring
export interface ColorConfig {
    type: "absolute" | "relative";
    palette?: string[];
    colors?: string[];
    rgb?: string;
}

// mathematical rules for xp gain per stat
export interface XpConfig {
    type: "multiplier" | "threshold" | "none" | "linear";
    mul?: number;
    base?: number;
    div?: number;
}

// specific user configuration for an individual tracker
export interface StatConfig {
    prop: string;
    title: string;
    type: StatType;
    dataType: DataType;
    streakType: StreakType;
    goal: "up" | "down";
    mastery: number;
    xp: XpConfig;
    unit: string;
    freq: "day" | "week";
    boundaries: Boundaries;
    color: ColorConfig;
}

// calculated progress and xp requirements for a level
export interface LevelData {
    level: number;
    progress: number;
    totalXp: number;
    currentXp: number;
    requiredXp: number;
}

// progress toward the next mastery tier and css classes
export interface RankData {
    name: string;
    cssClass: string;
    progress: number;
    nextRank: string;
}

// data for a single day in the heatmap grid
export interface HeatmapCell {
    date: string;
    value: number | null; 
    isToday: boolean;
    isHidden: boolean;
}

// calculated history, streaks, and mastery for a specific stat
export interface HabitData {
    maxRecorded: number;
    currentToday: number;
    lifetimeSum: number;
    firstLogDate: string | null;
    avg90: number;
    prevAvg90: number;
    lifetimeAvg: number;
    logs90: number;
    streak: number;
    bestStreak: number;
    cheatDays: number;
    daysSinceMiss: number;
    totalXp: number;
    todayXp: number;
    rank?: RankData | null;
    mastery?: LevelData;
    atRisk: boolean;
    isNewPR: boolean;
    trend: number;
    heatmap: HeatmapCell[][]; 
}

// overall user progress, quests, and perfect day status
export interface GlobalData {
    xp: number;
    todayXp: number;
    isPerfectDay: boolean;
    title: string;
    quest: { 
        completed: number; 
        total: number;
    };
    levelData: LevelData;
}

// final payload of all processed data ready for the view
export interface HabitStore {
    habits: Record<string, HabitData>;
    global: GlobalData;
}
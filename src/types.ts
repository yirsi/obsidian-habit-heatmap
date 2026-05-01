// plugin global settings including folder and tracker list
export interface HabitDashboardSettings {
	folder: string;
	stats: StatConfig[];
	xpSettings: XpSettings;
}

// character leveling and habit mastery math factors
export interface XpSettings {
	globalFactor: number;
	treeFactor: number;
}

// limits and default values for numeric property data
export interface Boundaries {
	min: number;
	default: number;
	max: number;
}

// visual style rules for heatmap cell coloring
export interface ColorConfig {
	type: "absolute" | "relative";
	palette?: string[]; // used for absolute
	rgb?: string; // used for relative
}

// specific user configuration for an individual tracker
export interface StatConfig {
	prop: string;
	title: string;
	type: "habit" | "metric";
	unit: string;
	goal: "up" | "down";
	freq: "day" | "week" | "month";
	multiplier: number;
	mastery: number;
	streakEnabled: boolean;
	boundaries: Boundaries;
	color: ColorConfig;
}

// calculated rpg progress including levels and ranks
export interface MasteryData {
	level: number;
	totalXp: number;
	currentXp: number;
	requiredXp: number;
	progress: number;
	rankName?: string;
	rankClass?: string;
	nextRank?: string;
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
	mastery?: MasteryData; // unified rpg stats
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
	quest: { completed: number; total: number };
	levelData: {
		level: number;
		progress: number;
		currentXp: number;
		requiredXp: number;
	};
}

// final payload of all processed data ready for the view
export interface HabitStore {
	habits: Record<string, HabitData>;
	global: GlobalData;
}

// defaults for a fresh installation
export const DEFAULT_XP_SETTINGS: XpSettings = {
	globalFactor: 30,
	treeFactor: 50,
};
export const DEFAULT_STATS: StatConfig[] = [
	{
		prop: "exercise",
		title: "Exercise",
		type: "habit",
		unit: "min",
		goal: "up",
		freq: "day",
		multiplier: 1,
		mastery: 60,
		streakEnabled: true,
		boundaries: { min: 0, default: 0, max: 1440 },
		color: { type: "relative", rgb: "0, 200, 100" },
	},
];

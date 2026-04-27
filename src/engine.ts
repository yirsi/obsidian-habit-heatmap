import { moment } from "obsidian";

// define configuration and data interfaces
export interface XpConfig {
    type: "multiplier" | "threshold" | "none" | "linear";
    mul?: number;
    base?: number;
    div?: number;
}

export type StatType = "habit" | "metric"; 
export type StreakType = "positive" | "negative" | "none";

export interface StatConfig {
    prop: string;
    title: string;
    type: StatType;
    streakType: StreakType;
    goal: "up" | "down";
    mastery: number;
    xp: XpConfig;
    unit: string;
    freq: "day" | "week";
}

export interface XpSettings {
    globalFactor: number;
    treeFactor: number;
    taskMultiplier: number;
    minutesPerXp: number;
    sleepBaseHours: number;
    sleepXpMultiplier: number;
}

export interface LevelData {
    level: number;
    progress: number;
    totalXp: number;
    currentXp: number;
    requiredXp: number;
}

export interface RankData {
    name: string;
    cssClass: string;
    progress: number;
    nextRank: string;
}

export interface HabitStore {
    habits: Record<string, any>;
    global: {
        xp: number;
        todayXp: number;
        isPerfectDay: boolean;
        quest: { completed: number; total: number };
        levelData: LevelData;
        title: string;
    };
}

export class HabitEngine {
    stats: StatConfig[];
    settings: XpSettings;

    constructor(statsConfig: StatConfig[], xpSettings: XpSettings) {
        this.stats = statsConfig;
        this.settings = xpSettings;
    }

    // Static: Calculate level and progress from XP
    static getLevelData(totalXp: number, factor: number = 50): LevelData {
        const level = Math.floor(Math.sqrt(totalXp / factor));
        const xpForCurrentLevel = Math.pow(level, 2) * factor;
        const xpForNextLevel = Math.pow(level + 1, 2) * factor;
        const xpRequiredForNext = Math.floor(xpForNextLevel - xpForCurrentLevel);
        const xpProgressInCurrent = Math.floor(totalXp - xpForCurrentLevel);
        return {
            level,
            progress: Math.min(100, (xpProgressInCurrent / xpRequiredForNext) * 100),
            totalXp: Math.floor(totalXp),
            currentXp: xpProgressInCurrent,
            requiredXp: xpRequiredForNext
        };
    }

    // Static: Calculate competitive rank
    static getRank(average: number, masteryThreshold: number): RankData | null {
        if (!masteryThreshold) return null;
        const tiers = [
            { name: "Iron", threshold: 0.00 }, { name: "Bronze", threshold: 0.15 },
            { name: "Silver", threshold: 0.35 }, { name: "Gold", threshold: 0.50 },
            { name: "Platinum", threshold: 0.65 }, { name: "Emerald", threshold: 0.80 },
            { name: "Diamond", threshold: 0.95 }
        ];
        const ratio = average / masteryThreshold;
        let idx = 0;
        for (let i = 0; i < tiers.length; i++) {
            const t = tiers[i];
            if (t && ratio >= t.threshold) idx = i; else break;
        }
        const curr = tiers[idx] || { name: "Iron", threshold: 0 };
        const next = tiers[idx + 1] || null;
        let prog = 100;
        if (next) prog = Math.min(100, Math.max(0, Math.floor(((ratio - curr.threshold) / (next.threshold - curr.threshold)) * 100)));
        return { name: curr.name, cssClass: "rank-" + curr.name.toLowerCase(), progress: prog, nextRank: next ? next.name : "MAX" };
    }

    // Static: Get title based on level
    static getGlobalTitle(level: number): string {
        if (level >= 100) return "Singularity";
        if (level >= 75) return "Black Hole";
        if (level >= 50) return "Supernova";
        if (level >= 35) return "Star";
        if (level >= 20) return "Planet";
        if (level >= 10) return "Moon";
        if (level >= 5) return "Asteroid";
        return "Space Dust";
    }

    // check if today was a success based on streak type
    private isSuccess(value: number, streakType: StreakType): boolean {
        if (streakType === "positive") return value > 0;
        if (streakType === "negative") return value === 0;
        return true; 
    }

    // calculate xp based on habit type
    static getXP(value: number, config: XpConfig): number {
        if (!config || config.type === "none") return 0;
        switch (config.type) {
            case "multiplier": return value * (config.mul || 1);
            case "threshold":  return Math.max(0, value - (config.base || 0)) * (config.mul || 1);
            default:           return value / (config.div || 5);
        }
    }

    process(dataMap: Record<string, any>, todayStr: string): HabitStore {
        const store: HabitStore = {
            habits: {},
            global: { 
                xp: 0, 
                todayXp: 0, 
                isPerfectDay: false, 
                quest: { completed: 0, total: 0 },
                levelData: HabitEngine.getLevelData(0, this.settings.globalFactor),
                title: "Space Dust"
            }
        };

        // init store
        this.stats.forEach(stat => {
            store.habits[stat.prop] = {
                streak: 0, bestStreak: 0, cheatDays: 0, daysSinceMiss: 0,
                totalXp: 0, todayXp: 0, avg90: 0, prevAvg90: 0,
                maxRecorded: 0, currentToday: 0, lifetimeSum: 0,
                logs90: 0, firstLogDate: null, lifetimeAvg: 0
            };
        });

        const sortedDates = Object.keys(dataMap).sort();

        // calculate records, xp, and streaks
        sortedDates.forEach(dateString => {
            const pageData = dataMap[dateString];
            
            this.stats.forEach(stat => {
                const value = pageData[stat.prop] || 0;
                const habit = store.habits[stat.prop];

                if (dateString === todayStr) habit.currentToday = value;

                // update lifetime records
                if (value > 0) {
                    if (!habit.firstLogDate) habit.firstLogDate = dateString;
                    habit.lifetimeSum += value;
                    if (value > habit.maxRecorded) habit.maxRecorded = value;
                }

                // update xp (only for habits)
                if (stat.type === "habit") {
                    const xpEarned = HabitEngine.getXP(value, stat.xp);
                    habit.totalXp += xpEarned;
                    store.global.xp += xpEarned;
                    if (dateString === todayStr) {
                        habit.todayXp = xpEarned;
                        store.global.todayXp += xpEarned;
                    }
                }

                // update streaks
                if (stat.streakType !== "none") {
                    if (this.isSuccess(value, stat.streakType)) {
                        habit.daysSinceMiss++;
                        habit.streak++;
                        if (habit.daysSinceMiss >= 4) habit.cheatDays = 1;
                        if (habit.streak > habit.bestStreak) habit.bestStreak = habit.streak;
                    } else if (dateString !== todayStr) {
                        if (habit.streak > 0 && habit.cheatDays > 0) {
                            habit.cheatDays = 0; habit.daysSinceMiss = 0;
                        } else {
                            habit.streak = 0; habit.daysSinceMiss = 0;
                        }
                    }
                }
            });
        });

        const dateLookup = this.generateDateLookup(todayStr);
        this.stats.forEach(stat => this.calculateFinalMetrics(stat, store, dataMap, dateLookup, todayStr));
        this.calculateGlobalQuest(store);

        return store;
    }

    private generateDateLookup(todayStr: string): string[] {
        const lookup: string[] = [];
        const cursor = window.moment(todayStr, 'YYYY-MM-DD');
        for (let i = 0; i < 180; i++) {
            lookup.push(cursor.format('YYYY-MM-DD'));
            cursor.subtract(1, 'days');
        }
        return lookup;
    }

    private calculateFinalMetrics(stat: StatConfig, store: HabitStore, dataMap: any, lookup: string[], todayStr: string) {
        const habit = store.habits[stat.prop];
        let sumCurrent90 = 0, sumPrevious90 = 0;
        const fallback = (stat.prop === "mood") ? 4 : (stat.prop === "sleep") ? 6 : 0;

        for (let i = 0; i < 90; i++) {
            const dCur = lookup[i];
            const dPrev = lookup[i + 90];
            if (dCur && dPrev) {
                const valCur = dataMap[dCur]?.[stat.prop];
                if (valCur !== undefined && valCur > 0) habit.logs90++;
                sumCurrent90 += valCur ?? fallback;
                sumPrevious90 += dataMap[dPrev]?.[stat.prop] ?? fallback;
            }
        }

        habit.avg90 = sumCurrent90 / 90;
        habit.prevAvg90 = sumPrevious90 / 90;
        habit.trend = (sumPrevious90 === 0) ? (habit.avg90 > 0 ? 100 : 0) : ((habit.avg90 - habit.prevAvg90) / sumPrevious90) * 100;
        
        const daysLife = habit.firstLogDate ? window.moment().diff(window.moment(habit.firstLogDate), 'days') + 1 : 1;
        habit.lifetimeAvg = habit.lifetimeSum / daysLife;

        // progression logic (Habit only)
        if (stat.type === "habit") {
            habit.rank = HabitEngine.getRank(habit.avg90, stat.mastery);
            habit.mastery = HabitEngine.getLevelData(habit.totalXp, this.settings.treeFactor);
        }

        // status flags
        const successToday = this.isSuccess(habit.currentToday, stat.streakType);
        habit.atRisk = (stat.streakType === "positive" && !successToday && habit.streak > 0 && habit.cheatDays === 0);
        habit.isNewPR = (stat.streakType !== "none" && habit.streak > 1 && habit.streak >= habit.bestStreak);
    }

    private calculateGlobalQuest(store: HabitStore) {
        const questStats = this.stats.filter(s => s.streakType !== "none");
        store.global.quest.total = questStats.length;
        store.global.quest.completed = questStats.filter(s => this.isSuccess(store.habits[s.prop].currentToday, s.streakType)).length;

        if (store.global.quest.total > 0 && store.global.quest.completed === store.global.quest.total) {
            store.global.isPerfectDay = true;
            store.global.xp += 100;
            store.global.todayXp += 100;
        }
        store.global.levelData = HabitEngine.getLevelData(store.global.xp, this.settings.globalFactor);
        store.global.title = HabitEngine.getGlobalTitle(store.global.levelData.level);
    }
}
import {
    StatConfig, XpSettings, LevelData, RankData,
    HabitData, HabitStore, StreakType, XpConfig, Boundaries, HeatmapCell
} from './types';

export class HabitEngine {
    stats: StatConfig[];
    settings: XpSettings;

    /*
    *  init constructor  
    *  takes STATS and XP_SETTINGS aray and saves them to class instance
    */
    constructor(statsConfig: StatConfig[], xpSettings: XpSettings) {
        this.stats = statsConfig;
        this.settings = xpSettings;
    }

    /*
    *  calculate level from raw xp
    *  calculate xp threshold needed for levels
    *  returns calculated values
    *  example of how displayed in view: "Level 17 (80% to Level 18)"
    */
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

    /*
    *  assign rank tier based on average performance
    *  masteryThreshold is 90-day average needed for diamond rank
    *  also calculates how close to rank-up
    */
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

    /* 
    *  get cosmetic title based on global level
    *  made this spacey n shit cuz space is fucking awesome
    */
    static getGlobalTitle(level: number): string {
        switch (true) {
            case level >= 100: return "Singularity";
            case level >= 90: return "Cosmic Entity";
            case level >= 80: return "Event Horizon";
            case level >= 70: return "Void Walker";
            case level >= 60: return "Galactic Guardian";
            case level >= 50: return "Supernova Soul";
            case level >= 40: return "Star Surfer";
            case level >= 30: return "Comet Chaser";
            case level >= 20: return "Planetary Pioneer";
            case level >= 10: return "Moon Wanderer";
            case level >= 5: return "Asteroid Rider";
            default: return "Space Debris";
        }
    }

    // check if value meets the requirement for a specific streak type
    private isSuccess(value: number, streakType: StreakType): boolean {
        if (streakType === "positive") return value > 0;
        if (streakType === "negative") return value === 0;
        return true;
    }

    // calc xp payout for a single logged value
    static getXP(value: number, config: XpConfig): number {
        if (!config || config.type === "none") return 0;
        switch (config.type) {
            case "multiplier": return value * (config.mul || 1);
            case "threshold": return Math.max(0, value - (config.base || 0)) * (config.mul || 1);
            default: return value / (config.div || 5);
        }
    }

    /*
    *  sanitize raw input against configured boundaries and fallbacks
    *  if input is bad replace with default value
    *  clamp input between min/max boundaries
    */
    private sanitizeValue(raw: any, boundaries: Boundaries): number {
        if (raw === undefined || raw === null) return boundaries.default;
        const num = Number(raw);

        if (isNaN(num)) return boundaries.default;
        if (num < boundaries.min) return boundaries.min;
        if (num > boundaries.max) return boundaries.max;

        return num;
    }

    /*
    *  handle streak increments
    *  4 day streaks grant 1 cheat day
    *  negative habits get no cheat day
    */
    private updateStreak(habit: HabitData, isSuccess: boolean, isToday: boolean, streakType: StreakType) {
        if (isSuccess) {
            habit.daysSinceMiss++;
            habit.streak++;
            // positive habits get cheat day grace periods (e.g. gym)
            if (streakType === "positive" && habit.daysSinceMiss >= 4) {
                habit.cheatDays = 1;
            }
            if (habit.streak > habit.bestStreak) habit.bestStreak = habit.streak;
        } else {
            // reset logic
            const shouldResetImmediately = (streakType === "negative" || !isToday);

            if (shouldResetImmediately) {
                // negative streaks break immediately. positive streaks break if not today.
                if (streakType === "positive" && habit.cheatDays > 0) {
                    habit.cheatDays = 0;
                    habit.daysSinceMiss = 0;
                } else {
                    habit.streak = 0;
                    habit.daysSinceMiss = 0;
                    habit.cheatDays = 0;
                }
            }
        }
    }

    /*
    *  primary loop that turns daily notes into structured data
    *  init -> sort -> iterate
    *  returns HabitStore object which gets used in view.ts to display processed data 
    */
    process(dataMap: Record<string, any>, todayStr: string): HabitStore {
        // init default payload
        const store: HabitStore = {
            habits: {},
            global: {
                xp: 0, todayXp: 0, isPerfectDay: false,
                quest: { completed: 0, total: 0 },
                levelData: HabitEngine.getLevelData(0, this.settings.globalFactor),
                title: "Space Dust"
            }
        };

        // populate base zero-states for all configured stats
        this.stats.forEach(stat => {
            store.habits[stat.prop] = {
                streak: 0, bestStreak: 0, cheatDays: 0, daysSinceMiss: 0,
                totalXp: 0, todayXp: 0, avg90: 0, prevAvg90: 0,
                maxRecorded: 0, currentToday: stat.boundaries.default,
                lifetimeSum: 0, logs90: 0, firstLogDate: null, lifetimeAvg: 0,
                atRisk: false, isNewPR: false, trend: 0, heatmap: []
            };
        });

        const sortedDates = Object.keys(dataMap).sort();

        // chronologically process all historical data
        sortedDates.forEach(dateString => {
            const pageData = dataMap[dateString];
            const isToday = dateString === todayStr;

            this.stats.forEach(stat => {
                const rawValue = pageData[stat.prop];
                const value = this.sanitizeValue(rawValue, stat.boundaries);
                const habit = store.habits[stat.prop];

                if (!habit) return;
                if (isToday) habit.currentToday = value;

                // track lifetime records if data actually exists in the file
                if (rawValue !== undefined && rawValue !== null) {
                    if (!habit.firstLogDate) habit.firstLogDate = dateString;
                    habit.lifetimeSum += value;
                    if (value > habit.maxRecorded) habit.maxRecorded = value;
                }

                // calculate xp drops
                if (stat.type === "habit") {
                    const xpEarned = HabitEngine.getXP(value, stat.xp);
                    habit.totalXp += xpEarned;
                    store.global.xp += xpEarned;

                    if (isToday) {
                        habit.todayXp = xpEarned;
                        store.global.todayXp += xpEarned;
                    }
                }

                // process streak conditions
                if (stat.streakType !== "none") {
                    const isSuccess = this.isSuccess(value, stat.streakType);
                    this.updateStreak(habit, isSuccess, isToday, stat.streakType);
                }
            });
        });

        // resolve rolling averages, heatmaps, and final ui flags
        const dateLookup = this.generateDateLookup(todayStr);
        this.stats.forEach(stat => {
            const habit = store.habits[stat.prop];
            if (habit) {
                this.calculateFinalMetrics(stat, store, dataMap, dateLookup, todayStr);
                // pre-calculates the layout matrix for the view's heatmap (months, offsets, and data)
                habit.heatmap = this.generateHeatmapMatrix(stat, dataMap, todayStr);
            }
        });

        this.calculateGlobalQuest(store);

        return store;
    }

    /*
    *  loop through the last 180 days for fast lookups
    *  return string array with dates for previous 90-day comparison
    */
    private generateDateLookup(todayStr: string): string[] {
        const lookup: string[] = [];
        const cursor = window.moment(todayStr, 'YYYY-MM-DD');

        for (let i = 0; i < 180; i++) {
            lookup.push(cursor.format('YYYY-MM-DD'));
            cursor.subtract(1, 'days');
        }

        return lookup;
    }

    /*
    *  calculate 90-day rolling averages, trending percentage change
    *  attach UI status flags (atRisk, isNewPR)
    *  
    */
    private calculateFinalMetrics(stat: StatConfig, store: HabitStore, dataMap: any, lookup: string[], todayStr: string) {
        const habit = store.habits[stat.prop];
        if (!habit) return;

        let sumCurrent90 = 0, sumPrevious90 = 0;

        // aggregate the last 90 days vs the 90 days before that
        for (let i = 0; i < 90; i++) {
            const dCur = lookup[i];
            const dPrev = lookup[i + 90];

            if (dCur && dPrev) {
                const rawCur = dataMap[dCur]?.[stat.prop];
                const rawPrev = dataMap[dPrev]?.[stat.prop];

                if (rawCur !== undefined && rawCur !== null) habit.logs90++;

                sumCurrent90 += this.sanitizeValue(rawCur, stat.boundaries);
                sumPrevious90 += this.sanitizeValue(rawPrev, stat.boundaries);
            }
        }

        habit.avg90 = sumCurrent90 / 90;
        habit.prevAvg90 = sumPrevious90 / 90;

        // resolve percentage trend
        habit.trend = (sumPrevious90 === 0)
            ? (habit.avg90 > 0 ? 100 : 0)
            : ((sumCurrent90 - sumPrevious90) / sumPrevious90) * 100;

        const daysLife = habit.firstLogDate ? window.moment().diff(window.moment(habit.firstLogDate), 'days') + 1 : 1;
        habit.lifetimeAvg = habit.lifetimeSum / daysLife;

        // resolve rpg elements
        if (stat.type === "habit") {
            habit.rank = HabitEngine.getRank(habit.avg90, stat.mastery);
            habit.mastery = HabitEngine.getLevelData(habit.totalXp, this.settings.treeFactor);
        }

        // set ui state flags
        const successToday = this.isSuccess(habit.currentToday, stat.streakType);
        // atRisk only shows for positive habits that haven't been done yet today if the streak would end otherwise
        habit.atRisk = (stat.streakType === "positive" && !successToday && habit.streak > 0 && habit.cheatDays === 0);
        habit.isNewPR = (stat.streakType !== "none" && habit.streak > 1 && habit.streak >= habit.bestStreak);
    }

    /*
    *  pre-calculates the layout matrix for the view's heatmap (months, offsets, and data)
    *  handles weekday alignment offsets and sanitizes historical data
    */
    private generateHeatmapMatrix(stat: StatConfig, dataMap: any, todayStr: string): HeatmapCell[][] {
        const months: HeatmapCell[][] = [];

        for (let i = 0; i < 3; i++) {
            const monthContext = window.moment(todayStr).subtract(2 - i, 'months');
            const daysInMonth = monthContext.daysInMonth();
            const offset = (monthContext.startOf('month').day() + 6) % 7;

            const cells: HeatmapCell[] = [];

            // inject invisible padding cells to align dates with weekdays
            for (let j = 0; j < offset; j++) {
                cells.push({ date: "", value: null, isToday: false, isHidden: true });
            }

            // populate real days with sanitized values
            for (let d = 1; d <= daysInMonth; d++) {
                const dateStr = monthContext.date(d).format('YYYY-MM-DD');
                const raw = dataMap[dateStr]?.[stat.prop];
                const value = (raw !== undefined && raw !== null) ? this.sanitizeValue(raw, stat.boundaries) : null;

                cells.push({
                    date: dateStr,
                    value: value,
                    isToday: dateStr === todayStr,
                    isHidden: false
                });
            }
            months.push(cells);
        }

        return months;
    }

    /*
    *  calculate today's quest/habit completion ratio
    *  check for perfect day bonus (xp boost when all habits succeed)
    */
    private calculateGlobalQuest(store: HabitStore) {
        // quest objectives are explicitly things marked as a 'habit'
        const questStats = this.stats.filter(s => s.type === "habit");

        store.global.quest.total = questStats.length;
        store.global.quest.completed = questStats.filter(s => {
            const habit = store.habits[s.prop];
            // verify habit exists before checking success
            return habit ? this.isSuccess(habit.currentToday, s.streakType) : false;
        }).length;

        // resolve perfect day global xp bonus
        if (store.global.quest.total > 0 && store.global.quest.completed === store.global.quest.total) {
            store.global.isPerfectDay = true;
            store.global.xp += 100;
            store.global.todayXp += 100;
        }

        store.global.levelData = HabitEngine.getLevelData(store.global.xp, this.settings.globalFactor);
        store.global.title = HabitEngine.getGlobalTitle(store.global.levelData.level);
    }
}
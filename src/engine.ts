import { moment } from "obsidian";

export class HabitEngine {
    // set up config and defines which stats ignore standard habit rules
    constructor(statsConfig, xpSettings) {
        this.stats = statsConfig;
        this.settings = xpSettings;
        this.nonHabits =["mood", "sleep", "coffee", "cannabis"];
    }

    // calculate how much xp a single log entry is worth
    static getXP(value, config) {
        if (!config) return value / 5; // default fallback
        
        switch (config.type) {
            case "multiplier": return value * (config.mul || 1);
            case "threshold":  return Math.max(0, value - (config.base || 0)) * (config.mul || 1);
            case "none":       return 0;
            default:           return value / (config.div || 5);
        }
    }

    // convert xp total into level number
    static getLevelData(totalXp, factor = 50) {
        const level = Math.floor(Math.sqrt(totalXp / factor));
        const xpForCurrentLevel = Math.pow(level, 2) * factor;
        const xpForNextLevel = Math.pow(level + 1, 2) * factor;
        
        const xpRequiredForNext = Math.floor(xpForNextLevel - xpForCurrentLevel);
        const xpProgressInCurrent = Math.floor(totalXp - xpForCurrentLevel);
        const progressPercentage = Math.min(100, (xpProgressInCurrent / xpRequiredForNext) * 100);

        return { 
            level: level, 
            progress: progressPercentage, 
            totalXp: Math.floor(totalXp), 
            currentXp: xpProgressInCurrent, 
            requiredXp: xpRequiredForNext 
        };
    }

    // assign title for global level
    static getGlobalTitle(level) {
        if (level >= 100) return "Singularity";
        if (level >= 75)  return "Black Hole";
        if (level >= 50)  return "Supernova";
        if (level >= 35)  return "Star";
        if (level >= 20)  return "Planet";
        if (level >= 10)  return "Moon";
        if (level >= 5)   return "Asteroid";
        return "Space Dust";
    }

    // assign competitive rank based on performance
    static getRank(average, masteryThreshold) {
        if (!masteryThreshold) return null;

        const tiers =[
            { name: "Iron",     threshold: 0.00 },
            { name: "Bronze",   threshold: 0.15 },
            { name: "Silver",   threshold: 0.35 },
            { name: "Gold",     threshold: 0.50 },
            { name: "Platinum", threshold: 0.65 },
            { name: "Emerald",  threshold: 0.80 },
            { name: "Diamond",  threshold: 0.95 }
        ];

        const performanceRatio = average / masteryThreshold;
        let currentTierIndex = 0;

        for (let i = 0; i < tiers.length; i++) { 
            if (performanceRatio >= tiers[i].threshold) currentTierIndex = i; 
            else break;
        }

        const currentTier = tiers[currentTierIndex];
        const nextTier = tiers[currentTierIndex + 1] || null;

        let progressToNext = 100;
        if (nextTier) {
            const ratioOverCurrent = performanceRatio - currentTier.threshold;
            const tierGap = nextTier.threshold - currentTier.threshold;
            progressToNext = Math.floor((ratioOverCurrent / tierGap) * 100);
        }

        return { 
            name: currentTier.name, 
            cssClass: "rank-" + currentTier.name.toLowerCase(), 
            progress: progressToNext, 
            nextRank: nextTier ? nextTier.name : "MAX" 
        };
    }

  // process all daily notes
    process(dataMap, todayStr) {
        const store = { habits: {}, global: { xp: 0, todayXp: 0, isPerfectDay: false, quest: { completed: 0, total: 0 } } };

        // initialize default zero-states for all stats
        this.stats.forEach(stat => {
            store.habits[stat.prop] = { 
                streak: 0, bestStreak: 0, cheatDays: 0, daysSinceMiss: 0, 
                totalXp: 0, todayXp: 0, avg90: 0, prevAvg90: 0, 
                maxRecorded: 0, currentToday: 0, lifetimeSum: 0, 
                logs90: 0, firstLogDate: null, lifetimeAvg: 0
            };
        });

        const sortedDates = Object.keys(dataMap).sort();
        
        // for all daily notes: compute streaks, total xp, and all-time records
        sortedDates.forEach(dateString => {
            const pageData = dataMap[dateString];
            this.stats.forEach(stat => {
                const value = pageData[stat.prop] || 0;
                const habit = store.habits[stat.prop];

                if (dateString === todayStr) habit.currentToday = value;

                if (value > 0) {
                    if (!habit.firstLogDate) habit.firstLogDate = dateString;
                    habit.lifetimeSum += value;
                    if (value > habit.maxRecorded) habit.maxRecorded = value;
                }

                const xpEarned = HabitEngine.getXP(value, stat.xp);
                if (xpEarned > 0) {
                    habit.totalXp += xpEarned;
                    store.global.xp += xpEarned;
                    if (dateString === todayStr) { 
                        habit.todayXp = xpEarned; 
                        store.global.todayXp += xpEarned; 
                    }
                }

                if (stat.hasStreak) {
                    if (value > 0) {
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

        // precompute 180 days needed for quarter averages instead of running moment() in  the loop
        const dateLookup =[];
        const dateCursor = moment(todayStr, 'YYYY-MM-DD'); 
        for (let i = 0; i < 180; i++) {
            dateLookup.push(dateCursor.format('YYYY-MM-DD'));
            dateCursor.subtract(1, 'days');
        }

        // only last 90 daily notes: compute averages, trends, and mastery levels
        this.stats.forEach(stat => {
            const habit = store.habits[stat.prop];
            let sumCurrent90 = 0, sumPrevious90 = 0;
            const fallbackValue = (stat.prop === "mood") ? 4 : (stat.prop === "sleep") ? 6 : 0;
            
            for (let i = 0; i < 90; i++) {
                const dateCurrent = dateLookup[i];
                const datePrevious = dateLookup[i + 90];
                
                const rawCurrent = dataMap[dateCurrent]?.[stat.prop];
                if (rawCurrent !== undefined && rawCurrent > 0) habit.logs90++; 

                const valCurrent = rawCurrent ?? fallbackValue;
                const valPrevious = dataMap[datePrevious]?.[stat.prop] ?? fallbackValue;
                
                sumCurrent90 += valCurrent; 
                sumPrevious90 += valPrevious;
            }
            
            habit.avg90 = sumCurrent90 / 90;
            habit.prevAvg90 = sumPrevious90 / 90;
            habit.trend = (sumPrevious90 === 0) ? ((habit.avg90 > 0) ? 100 : 0) : ((habit.avg90 - habit.prevAvg90) / habit.prevAvg90) * 100;
            
            const daysSinceFirst = habit.firstLogDate ? moment().diff(moment(habit.firstLogDate), 'days') + 1 : 1;
            habit.lifetimeAvg = habit.lifetimeSum / daysSinceFirst;

            habit.rank = this.nonHabits.includes(stat.prop) ? null : HabitEngine.getRank(habit.avg90, stat.mastery);
            habit.mastery = HabitEngine.getLevelData(habit.totalXp, this.settings.treeFactor);
            habit.atRisk = (stat.hasStreak && habit.currentToday === 0 && habit.streak > 0 && habit.cheatDays === 0);
            habit.isNewPR = (stat.hasStreak && habit.streak > 1 && habit.streak >= habit.bestStreak);
        });

        // calculate daily completion ratio and perfect day bonus
        const activeHabits = this.stats.filter(stat => !this.nonHabits.includes(stat.prop));
        store.global.quest.total = activeHabits.length;
        store.global.quest.completed = activeHabits.filter(stat => store.habits[stat.prop].currentToday > 0).length;
        
        if (store.global.quest.total > 0 && store.global.quest.completed === store.global.quest.total) { 
            store.global.isPerfectDay = true; 
            store.global.xp += 100; 
            store.global.todayXp += 100; 
        }

        store.global.levelData = HabitEngine.getLevelData(store.global.xp, this.settings.globalFactor);
        store.global.title = HabitEngine.getGlobalTitle(store.global.levelData.level);

        return store;
    }
}
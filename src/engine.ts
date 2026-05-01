import {
	StatConfig,
	XpSettings,
	MasteryData,
	HabitData,
	HabitStore,
	Boundaries,
	HeatmapCell,
} from "./types";

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
	static getLevelData(totalXp: number, factor: number = 50) {
		const level = Math.floor(Math.sqrt(totalXp / factor));
		const xpForCurrentLevel = Math.pow(level, 2) * factor;
		const xpForNextLevel = Math.pow(level + 1, 2) * factor;
		const xpRequiredForNext = Math.floor(
			xpForNextLevel - xpForCurrentLevel,
		);
		const xpProgressInCurrent = Math.floor(totalXp - xpForCurrentLevel);

		return {
			level,
			progress: Math.min(
				100,
				(xpProgressInCurrent / xpRequiredForNext) * 100,
			),
			currentXp: xpProgressInCurrent,
			requiredXp: xpRequiredForNext,
		};
	}

	/*
	 *  calculate combined level and rank data for individual habits
	 *  masteryThreshold is the 90-day average needed for diamond rank
	 */
	static getMasteryData(
		totalXp: number,
		factor: number,
		average: number,
		masteryThreshold: number,
	): MasteryData {
		const lvl = HabitEngine.getLevelData(totalXp, factor);

		const data: MasteryData = {
			...lvl,
			totalXp: Math.floor(totalXp),
		};

		if (masteryThreshold > 0) {
			const tiers = [
				{ name: "Iron", threshold: 0.0 },
				{ name: "Bronze", threshold: 0.15 },
				{ name: "Silver", threshold: 0.35 },
				{ name: "Gold", threshold: 0.5 },
				{ name: "Platinum", threshold: 0.65 },
				{ name: "Emerald", threshold: 0.8 },
				{ name: "Diamond", threshold: 0.95 },
			];

			const ratio = average / masteryThreshold;
			let idx = 0;

			for (let i = 0; i < tiers.length; i++) {
				const tier = tiers[i];
				// Check that the tier exists before accessing its threshold
				if (tier && ratio >= tier.threshold) {
					idx = i;
				} else {
					break;
				}
			}

			const curr = tiers[idx] || { name: "Iron", threshold: 0 };
			const next = tiers[idx + 1] || null;

			data.rankName = curr.name;
			data.rankClass = "hhm-rank-" + curr.name.toLowerCase();
			data.nextRank = next ? next.name : "MAX";
		}

		return data;
	}

	/*
	 *  get cosmetic title based on global level
	 *  made this spacey n shit cuz space is fucking awesome
	 */
	static getGlobalTitle(level: number): string {
		switch (true) {
			case level >= 100:
				return "Singularity";
			case level >= 90:
				return "Cosmic Entity";
			case level >= 80:
				return "Event Horizon";
			case level >= 70:
				return "Void Walker";
			case level >= 60:
				return "Galactic Guardian";
			case level >= 50:
				return "Supernova Soul";
			case level >= 40:
				return "Star Surfer";
			case level >= 30:
				return "Comet Chaser";
			case level >= 20:
				return "Planetary Pioneer";
			case level >= 10:
				return "Moon Wanderer";
			case level >= 5:
				return "Asteroid Rider";
			default:
				return "Space Debris";
		}
	}

	// check if value meets the requirement for a specific goal
	private isSuccess(value: number, goal: "up" | "down"): boolean {
		return goal === "up" ? value > 0 : value === 0;
	}

	// calculate xp payout based on behavior (achievement vs avoidance)
	private getXP(value: number, stat: StatConfig): number {
		if (stat.type === "metric" || stat.multiplier === 0) return 0;

		// Goal UP: Award per unit (Achievement)
		if (stat.goal === "up") return value * stat.multiplier;

		// Goal DOWN: Award flat multiplier if zero (Avoidance)
		return value === 0 ? stat.multiplier : 0;
	}

	/*
	 *  sanitize raw input against configured boundaries and fallbacks
	 *  if input is bad replace with default value
	 *  clamp input between min/max boundaries
	 */
	private sanitizeValue(raw: unknown, boundaries: Boundaries): number {
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
	private updateStreak(
		habit: HabitData,
		isSuccess: boolean,
		isToday: boolean,
		goal: "up" | "down",
	) {
		if (isSuccess) {
			habit.daysSinceMiss++;
			habit.streak++;
			// positive habits get cheat day grace periods (e.g. gym)
			if (goal === "up" && habit.daysSinceMiss >= 4) {
				habit.cheatDays = 1;
			}
			if (habit.streak > habit.bestStreak)
				habit.bestStreak = habit.streak;
		} else {
			// reset logic
			const shouldResetImmediately = goal === "down" || !isToday;

			if (shouldResetImmediately) {
				// negative streaks break immediately; positive streaks break if not today
				if (goal === "up" && habit.cheatDays > 0) {
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
	process(dataMap: Record<string, unknown>, todayStr: string): HabitStore {
		// init default payload
		const store: HabitStore = {
			habits: {},
			global: {
				xp: 0,
				todayXp: 0,
				isPerfectDay: false,
				quest: { completed: 0, total: 0 },
				levelData: HabitEngine.getLevelData(
					0,
					this.settings.globalFactor,
				),
				title: "Space Dust",
			},
		};

		// populate base zero-states for all configured stats
		this.stats.forEach((stat) => {
			store.habits[stat.prop] = {
				streak: 0,
				bestStreak: 0,
				cheatDays: 0,
				daysSinceMiss: 0,
				totalXp: 0,
				todayXp: 0,
				avg90: 0,
				prevAvg90: 0,
				maxRecorded: 0,
				currentToday: stat.boundaries.default,
				lifetimeSum: 0,
				logs90: 0,
				firstLogDate: null,
				lifetimeAvg: 0,
				atRisk: false,
				isNewPR: false,
				trend: 0,
				heatmap: [],
			};
		});

		const sortedDates = Object.keys(dataMap).sort();

		// chronologically process all historical data
		sortedDates.forEach((dateString) => {
			const pageData = dataMap[dateString];
			const isToday = dateString === todayStr;

			this.stats.forEach((stat) => {
				const rawValue = (pageData as Record<string, unknown>)[
					stat.prop
				];
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
				const xpEarned = this.getXP(value, stat);
				habit.totalXp += xpEarned;
				store.global.xp += xpEarned;

				if (isToday) {
					habit.todayXp = xpEarned;
					store.global.todayXp += xpEarned;
				}

				// process streak conditions
				if (stat.streakEnabled) {
					const isSuccess = this.isSuccess(value, stat.goal);
					this.updateStreak(habit, isSuccess, isToday, stat.goal);
				}
			});
		});

		// resolve rolling averages, heatmaps, and final ui flags
		const dateLookup = this.generateDateLookup(todayStr);
		this.stats.forEach((stat) => {
			const habit = store.habits[stat.prop];
			if (habit) {
				this.calculateFinalMetrics(
					stat,
					store,
					dataMap,
					dateLookup,
					todayStr,
				);
				// pre-calculates the layout matrix for the view's heatmap (months, offsets, and data)
				habit.heatmap = this.generateHeatmapMatrix(
					stat,
					dataMap,
					todayStr,
				);
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
		const cursor = window.moment(todayStr, "YYYY-MM-DD");

		for (let i = 0; i < 180; i++) {
			lookup.push(cursor.format("YYYY-MM-DD"));
			cursor.subtract(1, "days");
		}

		return lookup;
	}

	/*
	 *  calculate 90-day rolling averages, trending percentage change
	 *  attach UI status flags (atRisk, isNewPR)
	 *
	 */
	private calculateFinalMetrics(
		stat: StatConfig,
		store: HabitStore,
		dataMap: Record<string, unknown>,
		lookup: string[],
		todayStr: string,
	) {
		const habit = store.habits[stat.prop];
		if (!habit) return;

		let sumCurrent90 = 0,
			sumPrevious90 = 0;

		// aggregate the last 90 days vs the 90 days before that
		for (let i = 0; i < 90; i++) {
			const dCur = lookup[i];
			const dPrev = lookup[i + 90];

			if (dCur && dPrev) {
				const rawCur = (
					dataMap[dCur] as Record<string, unknown> | undefined
				)?.[stat.prop];
				const rawPrev = (
					dataMap[dPrev] as Record<string, unknown> | undefined
				)?.[stat.prop];

				if (rawCur !== undefined && rawCur !== null) habit.logs90++;

				sumCurrent90 += this.sanitizeValue(rawCur, stat.boundaries);
				sumPrevious90 += this.sanitizeValue(rawPrev, stat.boundaries);
			}
		}

		habit.avg90 = sumCurrent90 / 90;
		habit.prevAvg90 = sumPrevious90 / 90;

		// resolve percentage trend
		habit.trend =
			sumPrevious90 === 0
				? habit.avg90 > 0
					? 100
					: 0
				: ((sumCurrent90 - sumPrevious90) / sumPrevious90) * 100;

		const daysLife = habit.firstLogDate
			? window.moment().diff(window.moment(habit.firstLogDate), "days") +
				1
			: 1;
		habit.lifetimeAvg = habit.lifetimeSum / daysLife;

		// resolve rpg elements using the unified mastery structure
		if (stat.type === "habit") {
			habit.mastery = HabitEngine.getMasteryData(
				habit.totalXp,
				this.settings.treeFactor,
				habit.avg90,
				stat.mastery,
			);
		}

		// set ui state flags
		if (stat.streakEnabled) {
			const successToday = this.isSuccess(habit.currentToday, stat.goal);
			// atRisk only shows for positive habits that haven't been done yet today if the streak would end otherwise
			habit.atRisk =
				stat.goal === "up" &&
				!successToday &&
				habit.streak > 0 &&
				habit.cheatDays === 0;
			habit.isNewPR =
				habit.streak > 1 && habit.streak >= habit.bestStreak;
		}
	}

	/*
	 *  pre-calculates the layout matrix for the view's heatmap (months, offsets, and data)
	 *  handles weekday alignment offsets and sanitizes historical data
	 */
	private generateHeatmapMatrix(
		stat: StatConfig,
		dataMap: Record<string, unknown>,
		todayStr: string,
	): HeatmapCell[][] {
		const months: HeatmapCell[][] = [];

		for (let i = 0; i < 3; i++) {
			const monthContext = window
				.moment(todayStr)
				.subtract(2 - i, "months");
			const daysInMonth = monthContext.daysInMonth();
			const offset = (monthContext.startOf("month").day() + 6) % 7;

			const cells: HeatmapCell[] = [];

			// inject invisible padding cells to align dates with weekdays
			for (let j = 0; j < offset; j++) {
				cells.push({
					date: "",
					value: null,
					isToday: false,
					isHidden: true,
				});
			}

			// populate real days with sanitized values
			for (let d = 1; d <= daysInMonth; d++) {
				const dateStr = monthContext.date(d).format("YYYY-MM-DD");

				const dateEntry = dataMap[dateStr] as
					| Record<string, unknown>
					| undefined;
				const raw = dateEntry?.[stat.prop];
				const value =
					raw !== undefined && raw !== null
						? this.sanitizeValue(raw, stat.boundaries)
						: null;

				cells.push({
					date: dateStr,
					value: value,
					isToday: dateStr === todayStr,
					isHidden: false,
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
		const questStats = this.stats.filter((s) => s.type === "habit");

		store.global.quest.total = questStats.length;
		store.global.quest.completed = questStats.filter((s) => {
			const habit = store.habits[s.prop];
			// verify habit exists before checking success
			return habit ? this.isSuccess(habit.currentToday, s.goal) : false;
		}).length;

		// resolve perfect day global xp bonus
		if (
			store.global.quest.total > 0 &&
			store.global.quest.completed === store.global.quest.total
		) {
			store.global.isPerfectDay = true;
			store.global.xp += 100;
			store.global.todayXp += 100;
		}

		store.global.levelData = HabitEngine.getLevelData(
			store.global.xp,
			this.settings.globalFactor,
		);
		store.global.title = HabitEngine.getGlobalTitle(
			store.global.levelData.level,
		);
	}
}

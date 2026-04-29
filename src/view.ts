import { moment } from "obsidian";

type Boundaries = {
    min: number;
    default: number;
    max: number;
};

type ColorConfig = {
    type: "absolute" | "relative";
    palette?: string[];
    colors?: string[];
    rgb?: string;
};

type StatConfig = {
    prop: string;
    title: string;
    type: string;
    dataType: string;
    streakType: string;
    goal: string;
    unit: string;
    freq: string;
    boundaries: Boundaries;
    color: ColorConfig;
};

type HabitData = {
    maxRecorded: number;
    currentToday: number;
    avg90: number;
    prevAvg90: number;
    lifetimeAvg: number;
    logs90: number;
    streak: number;
    bestStreak: number;
    atRisk: boolean;
    isNewPR: boolean;
    trend: number;
    mastery?: {
        level: number;
        totalXp: number;
        currentXp: number;
        requiredXp: number;
        progress: number;
    };
    rank?: {
        name: string;
        cssClass: string;
        progress: number;
        nextRank: string;
    };
};

type GlobalData = {
    quest: {
        completed: number;
        total: number;
    };
    levelData: {
        level: number;
        progress: number;
        currentXp: number;
        requiredXp: number;
    };
    todayXp: number;
    title: string;
    isPerfectDay: boolean;
};

export class DashboardView {
    // init view
    constructor() { }

    /* 
    *  coordinates assembly of UI by calling component methods
    *  outputs an html string, which is ready to be rendered
    */
    renderDashboard(store: any, stats: StatConfig[], dataMap: any): string {
        return `
            ${this.renderQuestBar(store.global)}
            ${this.renderGlobalXP(store.global)}
            <div class="dashboard-wrapper">
                ${stats.map(stat => this.renderCard(stat, store.habits[stat.prop], dataMap)).join("")}
            </div>
        `;
    }

    /* 
    *  build the daily quest progress bar
    *  displays raw number of today's completed habits (3/7 Completed)
    *  calculates completion bar css width percentage
    */
    private renderQuestBar(globalData: GlobalData): string {
        const completionPercentage = globalData.quest.total > 0
            ? (globalData.quest.completed / globalData.quest.total) * 100
            : 0;

        return `
            <div class="quest-container">
                <div class="quest-label">
                    <span>🎯 DAILY QUEST</span>
                    <span>${globalData.quest.completed}/${globalData.quest.total}</span>
                </div>
                <div class="quest-bar-outer">
                    <div class="quest-bar-inner" style="width:${completionPercentage}%"></div>
                </div>
            </div>
        `;
    }

    /*
    *  build the global xp and level bar
    *  shows level title (e.g., "Asteroid Rider"),
    *  xp amount in numbers (e.g., 1804/2010 XP),
    *  xp progress bar with highlight layer of today's xp gained
    *  makes xp bar glow on a perfect day (all habits completed)
    */
    private renderGlobalXP(globalData: GlobalData): string {
        const { levelData, todayXp, title, isPerfectDay } = globalData;

        // total progress percentage (includes today)
        const totalPercentage = levelData.progress;

        // previous progress percentage (before today's gain)
        const prevXpInLevel = Math.max(0, levelData.currentXp - todayXp);
        const prevPercentage = (prevXpInLevel / levelData.requiredXp) * 100;

        const glowClass = isPerfectDay ? 'perfect-day-glow' : '';
        const xpBonus = todayXp > 0
            ? `<span style="color:var(--text-accent)">+${Math.floor(todayXp)}</span>`
            : '';

        return `
            <div class="global-xp-wrapper ${glowClass}">
                <div class="global-xp-label">
                    <span>🌍 ${title}</span>
                    <span>Lvl ${levelData.level}</span>
                </div>
                <div class="xp-bar-outer" style="height:12px; position: relative;">
                    <!-- white bar (underneath, shows total width) -->
                    <div class="xp-bar-inner today-highlight" style="width:${totalPercentage}%; position: absolute; z-index: 1;"></div>
                    <!-- purple bar (on top, covers previous progress) -->
                    <div class="xp-bar-inner" style="width:${prevPercentage}%; background:var(--text-accent); position: absolute; z-index: 2;"></div>
                </div>
                <div class="xp-label" style="margin-top:5px;font-size:0.8em;opacity:0.8">
                    <span>${levelData.currentXp}/${levelData.requiredXp} XP</span>
                    ${xpBonus}
                </div>
            </div>
        `;
    }

    /*
    *  build individual stat card container (e.g., "Mood")
    *  returns error if no data exists for stat
    *  checks if good habit is done (or bad habit is avoided)
    *  gives colored border to card container on habit success
    */
    private renderCard(stat: StatConfig, habit: HabitData, dataMap: any): string {
        if (!habit) return `<div class="hm-card">No data: ${stat.prop}</div>`;

        const isPositive = stat.streakType === "positive";
        const isDone = isPositive ? habit.currentToday > 0 : habit.currentToday === 0;
        const cardClass = `hm-card ${isPositive && isDone ? 'hm-card-done' : ''} ${habit.isNewPR ? 'hm-pr-enchanted' : ''}`;

        return `
            <div class="${cardClass}" data-prop="${stat.prop}">
                ${this.renderBadges(stat, habit)}
                <h3><span class="hm-title-text">${stat.title}</span></h3>
                ${this.renderHeatmap(stat, habit, dataMap)}
                ${this.renderFooter(stat, habit)}
                
                <!-- interactive logging overlay and trigger -->
                <div class="hm-log-trigger" title="Log today">+</div>
                ${this.renderLogOverlay(stat, habit.currentToday)}
            </div>
        `;
    }


    /*
    *  generate interactive overlay with input based on datatypes and boundaries
    *  enables editing of current daily note (today) through the dashboard
    */
    private renderLogOverlay(stat: StatConfig, currentVal: number): string {
        let uiHtml = "";
        const isRating = stat.dataType === "rating";

        if (isRating) {
            let buttons = "";
            for (let i = stat.boundaries.min; i <= stat.boundaries.max; i++) {
                buttons += `<button class="hm-log-btn rating-btn" data-val="${i}">${i}</button>`;
            }
            uiHtml = `<div class="hm-log-strip">${buttons}</div>`;
        } else {
            const isMacro = stat.dataType === "time" && stat.boundaries.max > 24;
            const min = stat.boundaries.min;
            const max = stat.boundaries.max;

            // helper to check if a step would exceed boundaries
            const isDisabled = (step: number) => (currentVal + step < min || currentVal + step > max) ? "disabled" : "";

            const stepperBtns = isMacro
                ? `<button class="hm-log-btn step-btn" data-step="-30" ${isDisabled(-30)}>-30</button>
                   <button class="hm-log-btn step-btn" data-step="-10" ${isDisabled(-10)}>-10</button>
                   <div class="hm-log-value">${currentVal}</div>
                   <button class="hm-log-btn step-btn" data-step="10" ${isDisabled(10)}>+10</button>
                   <button class="hm-log-btn step-btn" data-step="30" ${isDisabled(30)}>+30</button>`
                : `<button class="hm-log-btn step-btn" data-step="-1" ${isDisabled(-1)}>-1</button>
                   <div class="hm-log-value">${currentVal}</div>
                   <button class="hm-log-btn step-btn" data-step="1" ${isDisabled(1)}>+1</button>`;

            uiHtml = `<div class="hm-log-stepper">${stepperBtns}</div>`;
        }

        const saveClass = isRating ? "hm-log-save rating-save" : "hm-log-save stepper-save";

        return `
            <div class="hm-log-overlay" data-min="${stat.boundaries.min}" data-max="${stat.boundaries.max}">
                <div class="hm-log-header">${stat.title}</div>
                ${uiHtml}
                <div class="hm-log-reset" data-val="${stat.boundaries.default}" title="Reset to default">↺</div>
                <div class="${saveClass}" title="Confirm">✓</div>
            </div>
        `;
    }

    /*
    *  displays current level in top left and ranked tier in top right of card container
    *  also renders detailed tooltips for more info on stat xp level and rank
    *  only habits get badges, metrics get nothing (poor metrics T-T)
    */
    private renderBadges(stat: StatConfig, habit: HabitData): string {
        if (stat.type !== "habit" || !habit.mastery) return "";

        const masteryTooltip = `Level ${habit.mastery.level}\nLifetime XP: ${habit.mastery.totalXp}\nProgress: ${habit.mastery.currentXp}/${habit.mastery.requiredXp} XP`;
        const rankTooltip = habit.rank
            ? `${habit.rank.name} Rank\n${habit.rank.progress}% toward ${habit.rank.nextRank}`
            : "";

        return `
            <div class="mastery-container" title="${masteryTooltip}">
                <div class="mastery-badge">Lvl ${habit.mastery.level}</div>
                <div class="rank-progress-outer">
                    <div class="rank-progress-inner" style="width:${habit.mastery.progress}%"></div>
                </div>
            </div>
            ${habit.rank ? `
                <div class="rank-container" title="${rankTooltip}">
                    <div class="rank-badge ${habit.rank.cssClass}">${habit.rank.name}</div>
                </div>
            ` : ''}
        `;
    }

    /*
    *  render current average, progress trend, and streak info at bottom of each stat card
    *  trend colors are based on goal parameter (either up/down)
    *  also builds tooltips with extra data summary (e.g., previous 90-days performance average)
    */
    private renderFooter(stat: StatConfig, habit: HabitData): string {
        const goal = stat.goal || "up";
        const trendIsGood = goal === "up" ? habit.trend > 0 : habit.trend < 0;
        const trendClass = habit.trend !== 0 ? (trendIsGood ? 'trend-good' : 'trend-bad') : '';
        const freqSuffix = stat.dataType === "rating" ? "" : ` / ${stat.freq}`;

        const statsTooltip = `
            Current: ${this.formatValue(stat, habit.avg90)}
            Previous: ${this.formatValue(stat, habit.prevAvg90)}
            Lifetime: ${this.formatValue(stat, habit.lifetimeAvg)}
            Consistency: ${habit.logs90}/90 days
        `;

        const streakIcon = habit.atRisk ? "⚠️" : (habit.isNewPR ? "🌟" : "🔥");
        const streakTooltip = `All-time best: ${habit.bestStreak}`;
        const streakHtml = habit.streak > 0
            ? ` | <span class="${habit.atRisk ? 'streak-warning' : 'streak-active'}" title="${streakTooltip}">${streakIcon} ${habit.streak}</span>`
            : "";

        return `
            <div class="hm-footer">
                <span title="${statsTooltip.trim()}" class="hm-stat-details" style="cursor: help;">
                    ${this.formatValue(stat, habit.avg90)}${freqSuffix} |
                    <span class="${trendClass}">${habit.trend > 0 ? "+" : ""}${habit.trend.toFixed(0)}%</span>
                </span>
                ${streakHtml}
            </div>
        `;
    }

    /*
    *  build 90-day github-style heatmap grid
    *  calculate weekday offset and injects invis cells for date alignment
    *  maps data from daily notes to cells of heatmap
    *  outlines current day 
    */
    private renderHeatmap(stat: StatConfig, habitData: HabitData, dataMap: any): string {
        const monthsHtml = Array.from({ length: 3 }, (_, i) => {
            const monthContext = window.moment().subtract(2 - i, 'months');
            const daysInMonth = monthContext.daysInMonth();
            const offset = (monthContext.startOf('month').day() + 6) % 7;

            const cellsHtml = [
                ...Array(offset).fill('<div class="hm-cell hm-hidden"></div>'),
                ...Array.from({ length: daysInMonth }, (_, d) => {
                    const dateStr = monthContext.date(d + 1).format('YYYY-MM-DD');
                    const raw = dataMap[dateStr]?.[stat.prop];

                    const val = (raw !== undefined && raw !== null)
                        ? this.sanitize(raw, stat.boundaries)
                        : undefined;

                    const color = this.renderCellColor(val, habitData.maxRecorded, stat.color, stat.boundaries);
                    const isToday = dateStr === window.moment().format('YYYY-MM-DD');

                    return `
                        <div class="hm-cell ${isToday ? 'hm-today' : ''}"
                             style="background-color: ${color}"
                             title="${dateStr}: ${raw ?? 'No data'}">
                        </div>
                    `;
                })
            ].join("");

            return `<div class="hm-month">${cellsHtml}</div>`;
        }).join("");

        return `<div class="hm-months-wrapper">${monthsHtml}</div>`;
    }

    /*
    *  format raw values based on data type and frequency for the card footer
    *  if dataType is rating, offset min and max around default
    *  (e.g., mood is stored as 1 to 7 but gets displayed as -3 to +3) 
    */
    private formatValue(stat: StatConfig, val: number): string {
        const displayNum = stat.freq === "week" && stat.dataType !== "rating" ? val * 7 : val;
        const isWhole = stat.unit === "min" || stat.unit === "tasks";
        const formatted = isWhole ? Math.round(displayNum) : parseFloat(displayNum.toFixed(1));

        if (stat.dataType === "rating") return `${formatted}`;
        return `${formatted} ${stat.unit}`;
    }


    /*
    *  calculate dynamic background color for a single cell
    *  if data for day is missing returns default gray
    *  has logic for absolute color palletes (3 different colors)
    *  or relative color pallete (1 color with variying opacity)
    */
    private renderCellColor(
        value: number | undefined,
        maxRecorded: number,
        colorConfig: ColorConfig,
        boundaries: Boundaries
    ): string {
        if (value === undefined || value === null || (value <= 0 && boundaries.min === 0)) {
            return `var(--background-modifier-hover)`;
        }

        if (!colorConfig) return `rgba(128, 128, 128, 0.5)`;

        if (colorConfig.type === "absolute") {
            const palette = colorConfig.palette || colorConfig.colors || ["#ff2222", "#eeee44", "#33ff44"];
            const mid = boundaries.default;
            const isLow = value <= mid;
            const percentage = Math.min(1, isLow
                ? (value - boundaries.min) / (mid - boundaries.min || 1)
                : (value - mid) / (boundaries.max - mid || 1));

            const extractRgb = (hex: string): [number, number, number] => {
                const clean = hex.replace('#', '');
                const match = clean.length === 3 ? clean.split('').map(c => c + c) : clean.match(/.{1,2}/g);
                const parts = match ? match.map(x => parseInt(x, 16)) : [];
                return [parts[0] ?? 128, parts[1] ?? 128, parts[2] ?? 128];
            };

            const rgbColors = palette.map(extractRgb);

            const c0 = rgbColors[0] ?? [255, 34, 34];
            const c1 = rgbColors[1] ?? [238, 238, 68];
            const c2 = rgbColors[2] ?? [51, 255, 68];

            const [sr, sg, sb] = isLow ? c0 : c1;
            const [er, eg, eb] = isLow ? c1 : c2;

            const r = Math.floor(sr + (er - sr) * percentage);
            const g = Math.floor(sg + (eg - sg) * percentage);
            const b = Math.floor(sb + (eb - sb) * percentage);

            return `rgb(${r}, ${g}, ${b})`;
        }

        const denominator = maxRecorded > 0 ? maxRecorded : 1;
        return `rgba(${colorConfig.rgb || "128, 128, 128"}, ${Math.max(0.2, Math.min(value / denominator, 1))})`;
    }

    /*
    *  safely parse data, apply default and enforce boundaries
    *  ensure data is valid number before reaching logic engine
    */
    private sanitize(value: any, boundaries: Boundaries): number {
        const numericValue = Number(value);
        return (isNaN(numericValue) || value === undefined || value === null)
            ? boundaries.default
            : Math.min(Math.max(numericValue, boundaries.min), boundaries.max);
    }
}
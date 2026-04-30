import { StatConfig, HabitData, GlobalData, Boundaries, ColorConfig, HabitStore, HeatmapCell } from './types';

export class DashboardRenderer {
    // init view
    constructor() { }

    /* 
    *  coordinates assembly of UI by calling component methods
    *  outputs an html string, which is ready to be rendered
    */
    renderDashboard(store: HabitStore, stats: StatConfig[]): string {
        const questHtml = this.renderQuestBar(store.global);
        const globalXpHtml = this.renderGlobalXP(store.global);
        const cardsHtml = stats.map(stat => this.renderCard(stat, store.habits[stat.prop])).join("");

        return `
            ${questHtml}
            ${globalXpHtml}
            <div class="hhm-wrapper">
                ${cardsHtml}
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

        const progressLabel = `${globalData.quest.completed}/${globalData.quest.total}`;
        const barStyle = `width:${completionPercentage}%`;

        return `
            <div class="hhm-quest-container">
                <div class="hhm-quest-label">
                    <span>🎯 DAILY QUEST</span>
                    <span>${progressLabel}</span>
                </div>
                <div class="hhm-quest-bar-outer">
                    <div class="hhm-quest-bar-inner" style="${barStyle}"></div>
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

        const glowClass = isPerfectDay ? 'hhm-perfect-day-glow' : '';
        const xpBonusHtml = todayXp > 0 
            ? `<span style="color:var(--text-accent)">+${Math.floor(todayXp)}</span>` 
            : '';
            
        const xpText = `${levelData.currentXp}/${levelData.requiredXp} XP`;
        const totalStyle = `width:${totalPercentage}%; position: absolute; z-index: 1;`;
        const prevStyle = `width:${prevPercentage}%; background:var(--text-accent); position: absolute; z-index: 2;`;

        return `
            <div class="hhm-xp-wrapper ${glowClass}">
                <div class="hhm-xp-label">
                    <span>🌍 ${title}</span>
                    <span>Lvl ${levelData.level}</span>
                </div>
                <div class="hhm-xp-bar-outer" style="height:12px; position: relative;">
                    <!-- white bar (underneath, shows total width) -->
                    <div class="hhm-xp-bar-inner hhm-today-highlight" style="${totalStyle}"></div>
                    <!-- purple bar (on top, covers previous progress) -->
                    <div class="hhm-xp-bar-inner" style="${prevStyle}"></div>
                </div>
                <div class="hhm-xp-stats-label" style="margin-top:5px;font-size:0.8em;opacity:0.8">
                    <span>${xpText}</span>
                    ${xpBonusHtml}
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
    private renderCard(stat: StatConfig, habit: HabitData | undefined): string {
        if (!habit) return `<div class="hhm-card">No data: ${stat.prop}</div>`;

        const isPositive = stat.streakType === "positive";
        const isDone = isPositive ? habit.currentToday > 0 : habit.currentToday === 0;
        
        const statusClass = (isPositive && isDone) ? 'hhm-card-done' : '';
        const prClass = habit.isNewPR ? 'hhm-pr-enchanted' : '';
        const cardClass = `hhm-card ${statusClass} ${prClass}`;

        const badgesHtml = this.renderBadges(stat, habit);
        const heatmapHtml = this.renderHeatmap(stat, habit);
        const footerHtml = this.renderFooter(stat, habit);
        const overlayHtml = this.renderLogOverlay(stat, habit.currentToday);

        return `
            <div class="${cardClass}" data-prop="${stat.prop}">
                ${badgesHtml}
                <h3><span class="hhm-title-text">${stat.title}</span></h3>
                ${heatmapHtml}
                ${footerHtml}
                
                <!-- interactive logging overlay and trigger -->
                <div class="hhm-log-trigger" title="Log today">+</div>
                ${overlayHtml}
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
                buttons += `<button class="hhm-log-btn rating-btn" data-val="${i}">${i}</button>`;
            }
            uiHtml = `<div class="hhm-log-strip">${buttons}</div>`;
        } else {
            const isMacro = stat.dataType === "time" && stat.boundaries.max > 24;
            const min = stat.boundaries.min;
            const max = stat.boundaries.max;

            // helper to check if a step would exceed boundaries
            const isDisabled = (step: number) => (currentVal + step < min || currentVal + step > max) ? "disabled" : "";

            const stepperBtns = isMacro
                ? `<button class="hhm-log-btn step-btn" data-step="-30" ${isDisabled(-30)}>-30</button>
                   <button class="hhm-log-btn step-btn" data-step="-10" ${isDisabled(-10)}>-10</button>
                   <div class="hhm-log-value">${currentVal}</div>
                   <button class="hhm-log-btn step-btn" data-step="10" ${isDisabled(10)}>+10</button>
                   <button class="hhm-log-btn step-btn" data-step="30" ${isDisabled(30)}>+30</button>`
                : `<button class="hhm-log-btn step-btn" data-step="-1" ${isDisabled(-1)}>-1</button>
                   <div class="hhm-log-value">${currentVal}</div>
                   <button class="hhm-log-btn step-btn" data-step="1" ${isDisabled(1)}>+1</button>`;

            uiHtml = `<div class="hhm-log-stepper">${stepperBtns}</div>`;
        }

        const saveClass = isRating ? "hhm-log-save rating-save" : "hhm-log-save stepper-save";

        return `
            <div class="hhm-log-overlay" data-min="${stat.boundaries.min}" data-max="${stat.boundaries.max}">
                <div class="hhm-log-header">${stat.title}</div>
                ${uiHtml}
                <div class="hhm-log-reset" data-val="${stat.boundaries.default}" title="Reset to default">↺</div>
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
        const progressStyle = `width:${habit.mastery.progress}%`;
        
        let rankHtml = "";
        if (habit.rank) {
            const rankTooltip = `${habit.rank.name} Rank\n${habit.rank.progress}% toward ${habit.rank.nextRank}`;
            rankHtml = `
                <div class="hhm-rank-container" title="${rankTooltip}">
                    <div class="hhm-rank-badge hhm-rank-${habit.rank.name.toLowerCase()}">${habit.rank.name}</div>
                </div>
            `;
        }

        return `
            <div class="hhm-mastery-container" title="${masteryTooltip}">
                <div class="hhm-mastery-badge">Lvl ${habit.mastery.level}</div>
                <div class="hhm-rank-progress-outer">
                    <div class="hhm-rank-progress-inner" style="${progressStyle}"></div>
                </div>
            </div>
            ${rankHtml}
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
        const trendClass = habit.trend !== 0 ? (trendIsGood ? 'hhm-trend-good' : 'hhm-trend-bad') : '';
        const freqSuffix = stat.dataType === "rating" ? "" : ` / ${stat.freq}`;

        const currentValStr = this.formatValue(stat, habit.avg90);
        const prevValStr = this.formatValue(stat, habit.prevAvg90);
        const lifetimeValStr = this.formatValue(stat, habit.lifetimeAvg);

        const statsTooltip = `
            Current: ${currentValStr}
            Previous: ${prevValStr}
            Lifetime: ${lifetimeValStr}
            Consistency: ${habit.logs90}/90 days
        `;

        const streakIcon = habit.atRisk ? "⚠️" : (habit.isNewPR ? "🌟" : "🔥");
        const streakTooltip = `All-time best: ${habit.bestStreak}`;
        
        let streakHtml = "";
        if (habit.streak > 0) {
            const streakClass = habit.atRisk ? 'hhm-streak-warning' : 'hhm-streak-active';
            streakHtml = ` | <span class="${streakClass}" title="${streakTooltip}">${streakIcon} ${habit.streak}</span>`;
        }

        const trendSign = habit.trend > 0 ? "+" : "";
        const trendText = `${trendSign}${habit.trend.toFixed(0)}%`;

        return `
            <div class="hhm-footer">
                <span title="${statsTooltip.trim()}" class="hhm-stat-details" style="cursor: help;">
                    ${currentValStr}${freqSuffix} |
                    <span class="${trendClass}">${trendText}</span>
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
    private renderHeatmap(stat: StatConfig, habitData: HabitData): string {
        const monthsHtml = habitData.heatmap.map((month: HeatmapCell[]) => {
            const cellsHtml = month.map((cell: HeatmapCell) => {
                // inject invisible padding cells to align dates with weekdays
                if (cell.isHidden) {
                    return `<div class="hhm-cell hhm-hidden"></div>`;
                }

                const color = this.renderCellColor(cell.value, habitData.maxRecorded, stat.color, stat.boundaries);
                const isTodayClass = cell.isToday ? 'hhm-today' : '';
                const titleText = `${cell.date}: ${cell.value !== null ? cell.value : 'No data'}`;
                const cellStyle = `background-color: ${color}`;

                return `
                    <div class="hhm-cell ${isTodayClass}"
                         style="${cellStyle}"
                         title="${titleText}">
                    </div>
                `;
            }).join("");

            return `<div class="hhm-month">${cellsHtml}</div>`;
        }).join("");

        return `<div class="hhm-months-wrapper">${monthsHtml}</div>`;
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
        value: number | null,
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

}
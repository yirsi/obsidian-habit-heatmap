import { moment } from "obsidian";

export class DashboardView {
    constructor() { }

    private sanitize(value: any, boundaries: any): number {
        if (value === undefined || value === null) return boundaries?.default ?? 0;
        const val = Number(value);
        if (isNaN(val)) return boundaries?.default ?? 0;
        if (boundaries && val < boundaries.min) return boundaries.min;
        if (boundaries && val > boundaries.max) return boundaries.max;
        return val;
    }

    private formatValue(stat: any, val: number): string {
        if (stat.dataType === "rating") {
            const min = stat.boundaries?.min ?? 0;
            const max = stat.boundaries?.max ?? 10;
            const mid = min + (max - min) / 2;
            const adjusted = val - mid;
            return (adjusted >= 0 ? "+" : "") + adjusted.toFixed(1);
        }

        const multipliedVal = (stat.freq === "week") ? (val * 7) : val;
        const isWhole = stat.unit === "min" || stat.unit === "tasks";
        return isWhole
            ? `${Math.floor(multipliedVal)} ${stat.unit}`
            : `${multipliedVal.toFixed(1)} ${stat.unit}`;
    }

    renderCellColor(value: number | undefined, maxRecorded: number, color: any, boundaries: any) {
        if (value === undefined || value === null) {
            return `var(--background-modifier-hover)`;
        }

        if (value <= 0 && boundaries.min === 0) {
            return `var(--background-modifier-hover)`;
        }

        if (!color) return `rgba(128, 128, 128, 0.5)`;

        if (color.type === "absolute") {
            const palette = color.palette || color.colors || ["#ff2222", "#eeee44", "#33ff44"];
            const extractRgb = (hex: string) => {
                const clean = hex.replace('#', '');
                const match = clean.length === 3 ? clean.split('').map(c => c + c) : clean.match(/.{1,2}/g);
                return match ? match.map(x => parseInt(x, 16)) : [128, 128, 128];
            };
            const [colorStart, colorMid, colorEnd] = palette.map(extractRgb);
            const min = boundaries?.min ?? 0;
            const max = boundaries?.max ?? 10;
            const mid = min + (max - min) / 2;
            const isLowerHalf = value <= mid;
            const percentage = Math.min(1, isLowerHalf ? (value - min) / (mid - min || 1) : (value - mid) / (max - mid || 1));
            const [startRgb, endRgb] = isLowerHalf ? [colorStart, colorMid] : [colorMid, colorEnd];
            return `rgb(${Math.floor(startRgb[0] + (endRgb[0] - startRgb[0]) * percentage)}, ${Math.floor(startRgb[1] + (endRgb[1] - startRgb[1]) * percentage)}, ${Math.floor(startRgb[2] + (endRgb[2] - startRgb[2]) * percentage)})`;
        }

        const rgbString = color.rgb || "128, 128, 128";
        const denom = (maxRecorded && maxRecorded > 0) ? maxRecorded : 1;
        return `rgba(${rgbString}, ${Math.max(0.2, Math.min(value / denom, 1))})`;
    }


    renderHeatmap(stat: any, habitData: any, dataMap: any) {
        let html = `<div class="hm-months-wrapper">`;
        for (let i = 2; i >= 0; i--) {
            const monthContext = window.moment().subtract(i, 'months');
            const daysInMonth = monthContext.daysInMonth();
            const offset = (monthContext.startOf('month').day() + 6) % 7;

            html += `<div class="hm-month">`;
            for (let j = 0; j < offset; j++) html += `<div class="hm-cell hm-hidden"></div>`;

            for (let d = 1; d <= daysInMonth; d++) {
                const dateString = monthContext.date(d).format('YYYY-MM-DD');

                const rawValue = dataMap[dateString]?.[stat.prop];

                const value: number | undefined = (rawValue !== undefined && rawValue !== null)
                    ? this.sanitize(rawValue, stat.boundaries)
                    : undefined;

                const bgColor = this.renderCellColor(value, habitData.maxRecorded, stat.color, stat.boundaries);
                const isToday = dateString === window.moment().format('YYYY-MM-DD');

                html += `<div class="hm-cell ${isToday ? 'hm-today' : ''}" style="background-color: ${bgColor}" title="${dateString}: ${rawValue ?? 'No data'}"></div>`;
            }
            html += `</div>`;
        }
        return html + `</div>`;
    }

    renderCard(stat: any, habitData: any, dataMap: any) {
        if (!habitData) return `<div class="hm-card">No data: ${stat.prop}</div>`;

        const isPositive = stat.streakType === "positive";
        const isSuccessToday = isPositive ? habitData.currentToday > 0 : habitData.currentToday === 0;
        const cardClass = `hm-card ${(isPositive && isSuccessToday) ? 'hm-card-done' : ''} ${habitData.isNewPR ? 'hm-pr-enchanted' : ''}`;

        let progressHtml = "";
        if (stat.type === "habit") {
            const m = habitData.mastery;
            const r = habitData.rank;

            const masteryTooltip = `Level ${m.level}\nLifetime XP: ${m.totalXp}\nProgress: ${m.currentXp} / ${m.requiredXp} XP`;
            const rankTooltip = r ? `${r.name} Rank\n${r.progress}% toward ${r.nextRank}` : "";

            progressHtml = `
                <div class="mastery-container" title="${masteryTooltip}">
                    <div class="mastery-badge">Lvl ${m.level}</div>
                    <div class="rank-progress-outer">
                        <div class="rank-progress-inner" style="width: ${m.progress}%"></div>
                    </div>
                </div>
                ${r ? `
                <div class="rank-container" title="${rankTooltip}">
                    <div class="rank-badge ${r.cssClass}">${r.name}</div>
                </div>` : ''}
            `;
        }

        const goal = stat.goal || "up";
        const trendIsGood = goal === "up" ? habitData.trend > 0 : habitData.trend < 0;

        const streakTooltip = `All-time best: ${habitData.bestStreak}`;
        const streakIcon = habitData.atRisk ? "⚠️" : (habitData.isNewPR ? "🌟" : "🔥");
        const streakHtml = habitData.streak > 0
            ? ` | <span class="${habitData.atRisk ? 'streak-warning' : 'streak-active'}" title="${streakTooltip}">${streakIcon} ${habitData.streak}</span>`
            : "";

        const statsTooltip = `Current: ${this.formatValue(stat, habitData.avg90)}\nPrevious: ${this.formatValue(stat, habitData.prevAvg90)}\nLifetime: ${this.formatValue(stat, habitData.lifetimeAvg)}\nConsistency: ${habitData.logs90}/90 days`;

        const freqSuffix = stat.dataType === "rating" ? "" : ` / ${stat.freq}`;

        return `
    <div class="${cardClass}">
        ${progressHtml}
        <h3><span class="hm-title-text">${stat.title}</span></h3>
        ${this.renderHeatmap(stat, habitData, dataMap)}
        <div class="hm-footer">
            <span title="${statsTooltip}" class="hm-stat-details">
                ${this.formatValue(stat, habitData.avg90)}${freqSuffix} | 
                <span class="${habitData.trend !== 0 ? (trendIsGood ? 'trend-good' : 'trend-bad') : ''}">
                    ${habitData.trend > 0 ? "+" : ""}${habitData.trend.toFixed(0)}%
                </span>
            </span>
            ${streakHtml}
        </div>
    </div>`;

    }

    renderDashboard(store: any, stats: any[], dataMap: any): string {
        const { global: glob, habits } = store;
        const html: string[] = [];
        const questPerc = glob.quest.total > 0 ? (glob.quest.completed / glob.quest.total) * 100 : 0;
        html.push(`<div class="quest-container"><div class="quest-label"><span>🎯 DAILY QUEST</span><span>${glob.quest.completed}/${glob.quest.total}</span></div><div class="quest-bar-outer"><div class="quest-bar-inner" style="width:${questPerc}%"></div></div></div>`);
        const todayXpPerc = (glob.todayXp / glob.levelData.requiredXp) * 100;
        html.push(`<div class="global-xp-wrapper ${glob.isPerfectDay ? 'perfect-day-glow' : ''}"><div class="global-xp-label"><span>🌍 ${glob.title}</span><span>Lvl ${glob.levelData.level}</span></div><div class="xp-bar-outer" style="height:12px"><div class="xp-bar-inner" style="width:${glob.levelData.progress}%; background:var(--text-accent)"></div><div class="xp-bar-inner today-highlight" style="width:${todayXpPerc}%"></div></div><div class="xp-label" style="margin-top:5px;font-size:0.8em;opacity:0.8"><span>${glob.levelData.currentXp}/${glob.levelData.requiredXp} XP</span> ${glob.todayXp > 0 ? `<span style="color:var(--text-accent)">+${Math.floor(glob.todayXp)}</span>` : ''}</div></div>`);
        html.push(`<div class="dashboard-wrapper" style="margin-top:20px;">`);
        stats.forEach((stat: any) => html.push(this.renderCard(stat, habits[stat.prop], dataMap)));
        html.push(`</div>`);
        return html.join("");
    }
}
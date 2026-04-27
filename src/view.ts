import { moment } from "obsidian";

export class DashboardView {
    colors: any;

    constructor(colorsConfig: any) {
        this.colors = colorsConfig;
    }

    renderCellColor(value: number, maxRecorded: number, property: string) {
        if (value <= 0) return `var(--background-modifier-hover)`;
        const config = this.colors[property];
        
        if (!config) return `rgba(128, 128, 128, 0.5)`;

        if (config.type === "absolute") {
            const hex2rgb = (hex: string) => hex.match(/\w\w/g)?.map(x => parseInt(x, 16)) || [128, 128, 128];
            const [colorStart, colorMid, colorEnd] = config.colors.map(hex2rgb);
            const isLowerHalf = value <= config.mid;
            
            const percentage = Math.min(1, isLowerHalf 
                ? (value - config.min) / (config.mid - config.min) 
                : (value - config.mid) / (config.max - config.mid));
                
            const [startRgb, endRgb] = isLowerHalf ? [colorStart, colorMid] : [colorMid, colorEnd];
            
            const r = Math.floor(startRgb[0] + (endRgb[0] - startRgb[0]) * percentage);
            const g = Math.floor(startRgb[1] + (endRgb[1] - startRgb[1]) * percentage);
            const b = Math.floor(startRgb[2] + (endRgb[2] - startRgb[2]) * percentage);
            
            return `rgb(${r}, ${g}, ${b})`;
        }
        
        const rgb = config.rgb || "128, 128, 128";
        const opacity = Math.max(0.2, Math.min(value / maxRecorded, 1));
        return `rgba(${rgb}, ${opacity})`;
    }

    formatUnits(stat: any, average: number) {
        if (stat.prop === "mood") return (average - 4).toFixed(1);
        const value = (stat.freq === "week") ? (average * 7) : average;
        const isWholeNumber = stat.unit === "min" || stat.unit === "tasks";
        return isWholeNumber ? `${Math.floor(value)} ${stat.unit}/${stat.freq}` : `${value.toFixed(1)} ${stat.unit}/${stat.freq}`;
    }

    renderHeatmap(property: string, maxRecorded: number, dataMap: any) {
        let html = `<div class="hm-months-wrapper">`;
        for (let i = 2; i >= 0; i--) {
            const monthContext = window.moment().subtract(i, 'months');
            const daysInMonth = monthContext.daysInMonth();
            const offset = (monthContext.startOf('month').day() + 6) % 7;
            
            html += `<div class="hm-month">`;
            for (let j = 0; j < offset; j++) html += `<div class="hm-cell hm-hidden"></div>`;
            
            for (let d = 1; d <= daysInMonth; d++) {
                const dateString = monthContext.date(d).format('YYYY-MM-DD');
                const isToday = dateString === window.moment().format('YYYY-MM-DD');
                const value = dataMap[dateString]?.[property] || 0;
                const bgColor = this.renderCellColor(value, maxRecorded, property);
                html += `<div class="hm-cell ${isToday ? 'hm-today' : ''}" style="background: ${bgColor}" title="${dateString}: ${value}"></div>`;
            }
            html += `</div>`;
        }
        return html + `</div>`;
    }

   renderCard(stat: any, habitData: any, dataMap: any) {
        if (!habitData) return `<div class="hm-card">Error: No data for ${stat.prop}</div>`;

        // 1. Identify types
        const isPositive = stat.streakType === "positive";
        const isNegative = stat.streakType === "negative";
        const isSuccessToday = isPositive ? habitData.currentToday > 0 : habitData.currentToday === 0;

        // 2. Handle Outline (Only for Positive habits)
        const showOutline = isPositive && isSuccessToday;
        const cardClass = `hm-card ${showOutline ? 'hm-card-done' : ''} ${habitData.isNewPR ? 'hm-pr-enchanted' : ''}`;
        
        // 3. Handle Progress/Level (Only for Positive habits)
        let progressHtml = "";
        if (isPositive) {
            const mastery = habitData.mastery;
            const rank = habitData.rank;
            progressHtml = `
                <div class="mastery-container" title="Lifetime XP: ${mastery.totalXp}">
                    <div class="mastery-badge">Lvl ${mastery.level}</div>
                    <div class="rank-progress-outer"><div class="rank-progress-inner" style="width: ${mastery.progress}%"></div></div>
                </div>
                ${rank ? `<div class="rank-container" title="${rank.progress}% to ${rank.nextRank}"><div class="rank-badge ${rank.cssClass}">${rank.name}</div></div>` : ''}
            `;
        }
        
        // 4. Streak Icon Logic
        const trendIsPositive = stat.goal === "up" ? habitData.trend > 0 : habitData.trend < 0;
        const trendClass = habitData.trend !== 0 ? (trendIsPositive ? "trend-good" : "trend-bad") : "";
        
        const streakIcon = habitData.atRisk ? "⚠️" : (habitData.isNewPR ? "🌟" : "🔥");
        const streakHtml = habitData.streak > 0 
            ? ` | <span class="${habitData.atRisk ? 'streak-warning' : 'streak-active'}">${streakIcon} ${habitData.streak}</span>` 
            : ""; 
        
        const statsTooltip = `Consistency: ${habitData.logs90}/90 days\nMax: ${habitData.maxRecorded} ${stat.unit}`;
        const trendVal = `${habitData.trend > 0 ? "+" : ""}${habitData.trend.toFixed(0)}%`;

        return `
            <div class="${cardClass}">
                ${progressHtml}
                <h3><span class="hm-title-text">${stat.title}</span></h3>
                ${this.renderHeatmap(stat.prop, habitData.maxRecorded, dataMap)}
                <div class="hm-footer">
                    <span title="${statsTooltip}" style="cursor:help;">
                        ${this.formatUnits(stat, habitData.avg90)} | <span class="${trendClass}">${trendVal}</span>
                    </span>
                    ${streakHtml}
                </div>
            </div>`;
    }
}
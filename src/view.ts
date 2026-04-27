import { moment } from "obsidian";

export class DashboardView {
    // stores the color palette config
    constructor(colorsConfig) {
        this.colors = colorsConfig;
    }

    // calculate dynamic background color for a single heatmap square
    renderCellColor(value, maxRecorded, property) {
        if (value <= 0) return `var(--background-modifier-hover)`;
        const config = this.colors[property];
        
        if (config?.type === "absolute") {
            const hex2rgb = (hex) => hex.match(/\w\w/g).map(x => parseInt(x, 16));
            const[colorStart, colorMid, colorEnd] = config.colors.map(hex2rgb);
            const isLowerHalf = value <= config.mid;
            
            const percentage = Math.min(1, isLowerHalf 
                ? (value - config.min) / (config.mid - config.min) 
                : (value - config.mid) / (config.max - config.mid));
                
            const[startRgb, endRgb] = isLowerHalf ? [colorStart, colorMid] :[colorMid, colorEnd];
            
            const r = Math.floor(startRgb[0] + (endRgb[0] - startRgb[0]) * percentage);
            const g = Math.floor(startRgb[1] + (endRgb[1] - startRgb[1]) * percentage);
            const b = Math.floor(startRgb[2] + (endRgb[2] - startRgb[2]) * percentage);
            
            return `rgb(${r}, ${g}, ${b})`;
        }
        
        const opacity = Math.max(0.2, Math.min(value / maxRecorded, 1));
        return `rgba(${config.rgb}, ${opacity})`;
    }

    // clean up numbers
    formatUnits(stat, average) {
        if (stat.prop === "mood") return (average - 4).toFixed(1);
        
        const value = (stat.freq === "week") ? (average * 7) : average;
        const isWholeNumber = stat.unit === "min" || stat.unit === "tasks";
        return isWholeNumber ? `${Math.floor(value)} ${stat.unit}/${stat.freq}` : `${value.toFixed(1)} ${stat.unit}/${stat.freq}`;
    }

    // build the 90-day github-style heatmap graph for a stat
    renderHeatmap(property, maxRecorded, dataMap) {
        let html = `<div class="hm-months-wrapper">`;
        
        for (let i = 2; i >= 0; i--) {
            const monthContext = moment().subtract(i, 'months');
            const daysInMonth = monthContext.daysInMonth();
            const offset = (monthContext.startOf('month').day() + 6) % 7;
            
            html += `<div class="hm-month">`;
            for (let j = 0; j < offset; j++) html += `<div class="hm-cell hm-hidden"></div>`;
            
            for (let d = 1; d <= daysInMonth; d++) {
                const dateString = monthContext.date(d).format('YYYY-MM-DD');
                const isToday = dateString === moment().format('YYYY-MM-DD');
                const value = dataMap[dateString]?.[property] || 0;
                
                const bgColor = this.renderCellColor(value, maxRecorded, property);
                const classList = `hm-cell ${isToday ? 'hm-today' : ''}`;
                
                html += `<div class="${classList}" style="background: ${bgColor}" title="${dateString}: ${value}"></div>`;
            }
            html += `</div>`;
        }
        return html + `</div>`;
    }

    // build UI card for specific habit
    renderCard(stat, habitData, dataMap) {
        const isHabit = !["coffee", "mood", "sleep", "cannabis"].includes(stat.prop);
        const isDoneToday = habitData.currentToday > 0 && isHabit;
        const trendIsPositive = stat.goal === "up" ? habitData.trend > 0 : habitData.trend < 0;
        
        const trendClass = habitData.trend !== 0 ? (trendIsPositive ? "trend-good" : "trend-bad") : "";
        const cardClass = `hm-card ${isDoneToday ? 'hm-card-done' : ''} ${habitData.isNewPR ? 'hm-pr-enchanted' : ''}`;
        
        let masteryHtml = "";
        let rankHtml = "";
        
        if (isHabit) {
            const mastery = habitData.mastery;
            const masteryTooltip = `Lifetime XP: ${mastery.totalXp}\nLevel XP: ${mastery.currentXp} / ${mastery.requiredXp}`;
            
            masteryHtml = 
                `<div class="mastery-container" title="${masteryTooltip}">` +
                    `<div class="mastery-badge">Lvl ${mastery.level}</div>` +
                    `<div class="rank-progress-outer">` +
                        `<div class="rank-progress-inner" style="width: ${mastery.progress}%"></div>` +
                    `</div>` +
                `</div>`;
            
            if (habitData.rank) {
                rankHtml = 
                    `<div class="rank-container" title="${habitData.rank.progress}% to ${habitData.rank.nextRank}">` +
                        `<div class="rank-badge ${habitData.rank.cssClass}">${habitData.rank.name}</div>` +
                    `</div>`;
            }
        }
        
        const streakIcon = habitData.atRisk ? "⚠️" : (habitData.isNewPR ? "🌟" : "🔥");
        const streakClass = habitData.atRisk ? "streak-warning" : "streak-active";
        const streakHtml = habitData.streak > 0 
            ? ` | <span class="${streakClass}" title="All-time best: ${habitData.bestStreak}">${streakIcon} ${habitData.streak}</span>` 
            : "";
        
        const tipCurrent = this.formatUnits(stat, habitData.avg90);
        const tipPrev = this.formatUnits(stat, habitData.prevAvg90);
        const tipLife = this.formatUnits(stat, habitData.lifetimeAvg);
        const isWholeUnit = stat.unit === "min" || stat.unit === "tasks";
        const tipMax = isWholeUnit ? Math.floor(habitData.maxRecorded) : habitData.maxRecorded.toFixed(1);
        const tipMaxLabel = stat.unit === "score" ? "Best Score" : "All-Time Best";
        
        const statsTooltip = `Current 90d:\t${tipCurrent}\nPrevious 90d:\t${tipPrev}\nLifetime Avg:\t${tipLife}\nConsistency:\t${habitData.logs90}/90 days (${Math.floor((habitData.logs90/90)*100)}%)\n${tipMaxLabel}:\t${tipMax} ${stat.unit}`;
        const trendValueString = `${habitData.trend > 0 ? "+" : ""}${habitData.trend.toFixed(0)}%`;

        return `<div class="${cardClass}">` +
            masteryHtml +
            rankHtml +
            `<h3><span class="hm-title-text">${stat.title}</span></h3>` +
            this.renderHeatmap(stat.prop, habitData.maxRecorded, dataMap) +
            `<div class="hm-footer">` +
                `<span title="${statsTooltip}" style="cursor:help;">` +
                    `${this.formatUnits(stat, habitData.avg90)} | ` +
                    `<span class="${trendClass}">${trendValueString}</span>` +
                `</span>` +
                streakHtml +
            `</div>` +
        `</div>`;
    }
}
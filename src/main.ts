import { Plugin, parseYaml } from 'obsidian';
import { HabitEngine } from './engine';
import { DashboardView } from './view';

export default class HabitDashboardPlugin extends Plugin {
    async onload() {
        this.registerMarkdownCodeBlockProcessor("habit-dashboard", (source, el, ctx) => {
            
            // 1. Parse YAML Input
            let config;
            try {
                config = parseYaml(source);
            } catch (e) {
                el.createEl("pre", { text: "Invalid YAML Configuration" });
                return;
            }

            const { STATS = [], COLORS = {}, XP_SETTINGS = {}, FOLDER = '""' } = config;

            // 2. Check Dataview Dependency
            const dv = (this.app as any).plugins.plugins["dataview"]?.api;
            if (!dv) {
                el.createEl("h3", { text: "Dataview plugin required" });
                return;
            }

            try {
                // 3. Data Collection - Use window.moment to fix call signature error
                const todayStr = window.moment().format('YYYY-MM-DD');
                const dataMap: Record<string, any> = {};

                dv.pages(FOLDER)
                    .where((page: any) => page.file.day)
                    .forEach((page: any) => {
                        const date = window.moment(page.file.day.toJSDate()).format('YYYY-MM-DD');
                        dataMap[date] = page;
                    });

                // 4. Processing
                const engine = new HabitEngine(STATS, XP_SETTINGS);
                const view = new DashboardView(COLORS);
                const store = engine.process(dataMap, todayStr);

                // 5. Build HTML
                const htmlOutput: string[] = [];
                const { global: glob, habits } = store;

                // --- Daily Quest Bar ---
                const questPerc = glob.quest.total > 0 ? (glob.quest.completed / glob.quest.total) * 100 : 0;
                htmlOutput.push(`
                    <div class="quest-container">
                        <div class="quest-label">
                            <span>🎯 DAILY QUEST</span>
                            <span>${glob.quest.completed} / ${glob.quest.total} COMPLETED</span>
                        </div>
                        <div class="quest-bar-outer"><div class="quest-bar-inner" style="width: ${questPerc}%"></div></div>
                    </div>`);

                // --- Global Level Bar ---
                const globWrap = glob.isPerfectDay ? 'global-xp-wrapper perfect-day-glow' : 'global-xp-wrapper';
                const todayXpText = glob.todayXp > 0 ? `<span style="color:var(--text-accent)">+${Math.floor(glob.todayXp)}</span>` : '';
                const todayXpPerc = glob.levelData.requiredXp > 0 ? (glob.todayXp / glob.levelData.requiredXp) * 100 : 0;

                htmlOutput.push(`
                    <div class="${globWrap}">
                        <div class="global-xp-label">
                            <span>🌍 ${glob.title}${glob.isPerfectDay ? ' 🌟' : ''}</span>
                            <span>Lvl ${glob.levelData.level}</span>
                        </div>
                        <div class="xp-bar-outer" style="height:12px">
                            <div class="xp-bar-inner" style="width:${glob.levelData.progress}%; background:var(--text-accent)"></div>
                            <div class="xp-bar-inner today-highlight" style="width:${todayXpPerc}%"></div>
                        </div>
                        <div class="xp-label" style="margin-top:5px;font-size:0.8em;opacity:0.8">
                            <span>${glob.levelData.currentXp} / ${glob.levelData.requiredXp} XP</span>
                            ${todayXpText}
                        </div>
                    </div>`);

                // --- Habit Cards Grid ---
                htmlOutput.push(`<div class="dashboard-wrapper" style="margin-top:20px;">`);
                STATS.forEach((stat: any) => {
                    htmlOutput.push(view.renderCard(stat, habits[stat.prop], dataMap));
                });
                htmlOutput.push(`</div>`);

                // 6. Final Render
                const container = el.createDiv();
                container.innerHTML = htmlOutput.join("");

            } catch (error) {
                // Fix: Handle 'unknown' type error
                const message = error instanceof Error ? error.message : String(error);
                console.error("Habit Dashboard Error:", error);
                el.createDiv({ text: `Error rendering dashboard: ${message}` });
            }
        });
    }
}
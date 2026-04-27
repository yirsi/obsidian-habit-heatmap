import { Plugin, parseYaml } from 'obsidian';
import { HabitEngine } from './engine';
import { DashboardView } from './view';

export default class HabitDashboardPlugin extends Plugin {
    async onload() {
        this.registerMarkdownCodeBlockProcessor("habit-dashboard", async (source, el, ctx) => {
            let config;
            try {
                config = parseYaml(source);
            } catch (e) {
                el.createEl("pre", { text: "❌ Invalid YAML Configuration" });
                return;
            }

            const { STATS = [], XP_SETTINGS = {}, FOLDER = '""' } = config;

            let retries = 0;
            const maxRetries = 5;

            const render = () => {
                const dv = (this.app as any).plugins.plugins["dataview"]?.api;
                if (!dv) {
                    el.createEl("h3", { text: "⚠️ Dataview plugin required" });
                    return;
                }

                const pages = dv.pages(FOLDER);

                if (pages.length === 0 && retries < maxRetries) {
                    retries++;
                    setTimeout(render, 500);
                    return;
                }

                try {
                    const todayStr = window.moment().format('YYYY-MM-DD');
                    const dataMap: Record<string, any> = {};

                    pages.where((page: any) => page.file.day)
                        .forEach((page: any) => {
                            const date = window.moment(page.file.day.toJSDate()).format('YYYY-MM-DD');
                            dataMap[date] = page;
                        });

                    const engine = new HabitEngine(STATS, XP_SETTINGS);
                    const view = new DashboardView();
                    const store = engine.process(dataMap, todayStr);

                    el.empty();
                    const container = el.createDiv();
                    container.innerHTML = view.renderDashboard(store, STATS, dataMap);

                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    el.empty();
                    el.createDiv({ text: `⚠️ Error: ${message}` });
                }
            };

            render();
        });

    }
}
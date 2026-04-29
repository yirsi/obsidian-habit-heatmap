import { Plugin, parseYaml, TFile } from 'obsidian';
import { HabitEngine } from './engine';
import { DashboardView } from './view';

export default class HabitDashboardPlugin extends Plugin {
    /*
    *  registers the markdown processor for the plugin
    *  handles dataview fetching and initializes the render loop
    */
    async onload() {
        this.registerMarkdownCodeBlockProcessor("habit-heatmap", async (source, el, ctx) => {
            
            // parse user config from yaml input
            let config;
            try {
                config = parseYaml(source);
                if (!config) throw new Error("YAML is empty");
            } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                el.createEl("pre", { text: `YAML Error: ${msg}` });
                return;
            }

            const { STATS =[], XP_SETTINGS = {}, FOLDER = '""' } = config;
            const cleanFolder = FOLDER.replace(/"/g, '');
            const todayStr = window.moment().format('YYYY-MM-DD');
            
            // local state memory for optimistic ui updates
            const dataMap: Record<string, any> = {};
            const container = el.createDiv();

            /*
            *  compiles data through engine.ts 
            *  refreshes the inner html of the dashboard container
            */
            const refreshUI = () => {
                const engine = new HabitEngine(STATS, XP_SETTINGS);
                const store = engine.process(dataMap, todayStr);
                container.innerHTML = new DashboardView().renderDashboard(store, STATS, dataMap);
            };

            // setup retry logic to handle dataview indexing lag
            let retries = 0;
            const maxRetries = 5;

            /*
            *  fetches data from dataview cache
            *  re-runs itself if the index is not yet fully loaded
            */
            const loadAndRender = () => {
                const dv = (this.app as any).plugins.plugins["dataview"]?.api;
                if (!dv) {
                    el.createEl("h3", { text: "Dataview plugin required" });
                    return;
                }

                const pages = dv.pages(FOLDER);

                if (pages.length === 0 && retries < maxRetries) {
                    retries++;
                    setTimeout(loadAndRender, 500);
                    return;
                }

                try {
                    // map daily notes to date keys for fast engine lookup
                    pages.where((p: any) => p.file.day)
                        .forEach((p: any) => {
                            const date = window.moment(p.file.day.toJSDate()).format('YYYY-MM-DD');
                            dataMap[date] = p;
                        });

                    refreshUI();

                    // delegate all click events inside the dashboard container
                    container.addEventListener('click', (e) => {
                        this.handleInteraction(e, dataMap, todayStr, cleanFolder, refreshUI);
                    });

                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    console.error("Dashboard Render Error:", error);
                    el.empty();
                    el.createDiv({ text: `️Render Error: ${message}` });
                }
            };

            loadAndRender();
        });
    }

    /*
    *  manages all user interactions within the dashboard
    *  handles overlay toggles, stepper calculations, and save events
    */
    private async handleInteraction(e: Event, dataMap: Record<string, any>, todayStr: string, folder: string, refreshUI: () => void) {
        const target = e.target as HTMLElement;
        const card = target.closest('.hm-card') as HTMLElement;
        if (!card) return;

        const prop = card.getAttribute('data-prop');
        if (!prop) return;

        // open overlay trigger
        if (target.matches('.hm-log-trigger')) {
            // close any previously opened overlays first
            target.closest('.dashboard-wrapper')?.querySelectorAll('.hm-log-overlay.is-active')
                .forEach(ov => ov.classList.remove('is-active'));
            card.querySelector('.hm-log-overlay')?.classList.add('is-active');
            return;
        }

        // cancel overlay action
        if (target.classList.contains('hm-log-overlay') || target.matches('.cancel')) {
            target.classList.remove('is-active');
            return;
        }

        // stepper increment and boundary enforcement
        if (target.matches('.step-btn')) {
            const valEl = card.querySelector('.hm-log-value');
            if (valEl) {
                const step = parseInt(target.getAttribute('data-step') || '0', 10);
                const current = parseFloat(valEl.textContent || '0');
                const newVal = current + step;
                valEl.textContent = String(newVal);

                const overlay = target.closest('.hm-log-overlay') as HTMLElement;
                const min = parseFloat(overlay.getAttribute('data-min') || '0');
                const max = parseFloat(overlay.getAttribute('data-max') || '999');
                
                // disable buttons that would push value out of bounds
                overlay.querySelectorAll<HTMLButtonElement>('.step-btn').forEach(btn => {
                    const bStep = parseInt(btn.getAttribute('data-step') || '0', 10);
                    btn.disabled = (newVal + bStep < min || newVal + bStep > max);
                });
            }
            return;
        }

        // reset value to config defaults
        if (target.matches('.hm-log-reset')) {
            const valEl = card.querySelector('.hm-log-value');
            if (valEl) {
                const defaultVal = target.getAttribute('data-val') || '0';
                valEl.textContent = defaultVal;

                const overlay = target.closest('.hm-log-overlay') as HTMLElement;
                const min = parseFloat(overlay.getAttribute('data-min') || '0');
                const max = parseFloat(overlay.getAttribute('data-max') || '999');
                
                // reset disabled states
                overlay.querySelectorAll<HTMLButtonElement>('.step-btn').forEach(btn => {
                    const bStep = parseInt(btn.getAttribute('data-step') || '0', 10);
                    btn.disabled = (parseFloat(defaultVal) + bStep < min || parseFloat(defaultVal) + bStep > max);
                });
            }
            return;
        }

        // save logic for both stepper confirm and direct rating taps
        if (target.matches('.stepper-save') || target.matches('.rating-btn')) {
            const overlay = card.querySelector('.hm-log-overlay');
            let finalVal = 0;

            if (target.matches('.rating-btn')) {
                finalVal = parseFloat(target.getAttribute('data-val') || '0');
            } else {
                finalVal = parseFloat(overlay?.querySelector('.hm-log-value')?.textContent || '0');
            }

            // visually close the overlay
            overlay?.classList.remove('is-active');

            // optimistically update memory and re-render instantly
            if (!dataMap[todayStr]) dataMap[todayStr] = {};
            dataMap[todayStr][prop] = finalVal;
            refreshUI();

            // commit data to file in background
            await this.saveValue(prop, finalVal, folder, todayStr);
            return;
        }

        // close rating overlay if checkmark is tapped (no-op)
        if (target.matches('.rating-save')) {
            card.querySelector('.hm-log-overlay')?.classList.remove('is-active');
        }
    }

    /*
    *  writes updated numeric values to the daily note frontmatter
    *  creates the file automatically if it does not already exist
    */
    private async saveValue(prop: string, value: number, folder: string, todayStr: string) {
        const todayPath = `${folder}/${todayStr}.md`;
        const file = this.app.vault.getAbstractFileByPath(todayPath);

        if (!file) {
            await this.app.vault.create(todayPath, `---\n${prop}: ${value}\n---`);
        } else if (file instanceof TFile) {
            await this.app.fileManager.processFrontMatter(file, (fm) => {
                fm[prop] = value;
            });
        }
    }
}
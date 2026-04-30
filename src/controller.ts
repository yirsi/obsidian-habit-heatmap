import { App, TFile } from 'obsidian';
import { HabitEngine } from './engine';
import { DashboardRenderer } from './view'; // Renamed from view.ts
import { StatConfig, HabitStore } from './types';

export class DashboardController {
    app: App;
    renderer: DashboardRenderer;

    constructor(app: App) {
        this.app = app;
        this.renderer = new DashboardRenderer();
    }

    /*
    *  compiles data, renders html, and attaches listeners
    */
    public mountDashboard(el: HTMLElement, config: any) {
        const { STATS = [], XP_SETTINGS = {}, FOLDER = '""' } = config;
        const cleanFolder = FOLDER.replace(/"/g, '');
        const todayStr = window.moment().format('YYYY-MM-DD');
        
        // local state memory for optimistic ui updates
        const dataMap: Record<string, any> = {};
        const container = el.createDiv();

        /*
        *  refreshes the dashboard container using the renderer
        */
        const refreshUI = () => {
            const engine = new HabitEngine(STATS, XP_SETTINGS);
            const store = engine.process(dataMap, todayStr);
            container.innerHTML = this.renderer.renderDashboard(store, STATS);
        };

        // setup retry logic for dataview index lag
        let retries = 0;
        const maxRetries = 5;

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
    }

    /*
    *  manages all user interactions within the dashboard
    */
    private async handleInteraction(e: Event, dataMap: Record<string, any>, todayStr: string, folder: string, refreshUI: () => void) {
        const target = e.target as HTMLElement;
        const card = target.closest('.hhm-card') as HTMLElement;
        if (!card) return;

        const prop = card.getAttribute('data-prop');
        if (!prop) return;

        // open overlay trigger
        if (target.matches('.hhm-log-trigger')) {
            target.closest('.hhm-wrapper')?.querySelectorAll('.hhm-log-overlay.is-active')
                .forEach(ov => ov.classList.remove('is-active'));
            card.querySelector('.hhm-log-overlay')?.classList.add('is-active');
            return;
        }

        // cancel overlay action
        if (target.classList.contains('hhm-log-overlay') || target.matches('.cancel')) {
            target.classList.remove('is-active');
            return;
        }

        // stepper logic
        if (target.matches('.step-btn')) {
            const valEl = card.querySelector('.hhm-log-value');
            if (valEl) {
                const step = parseInt(target.getAttribute('data-step') || '0', 10);
                const current = parseFloat(valEl.textContent || '0');
                const newVal = current + step;
                valEl.textContent = String(newVal);

                const overlay = target.closest('.hhm-log-overlay') as HTMLElement;
                const min = parseFloat(overlay.getAttribute('data-min') || '0');
                const max = parseFloat(overlay.getAttribute('data-max') || '999');
                
                overlay.querySelectorAll<HTMLButtonElement>('.hhm-log-btn').forEach(btn => {
                    const bStep = parseInt(btn.getAttribute('data-step') || '0', 10);
                    btn.disabled = (newVal + bStep < min || newVal + bStep > max);
                });
            }
            return;
        }

        // reset logic
        if (target.matches('.hhm-log-reset')) {
            const valEl = card.querySelector('.hhm-log-value');
            if (valEl) {
                const defaultVal = target.getAttribute('data-val') || '0';
                valEl.textContent = defaultVal;

                const overlay = target.closest('.hhm-log-overlay') as HTMLElement;
                const min = parseFloat(overlay.getAttribute('data-min') || '0');
                const max = parseFloat(overlay.getAttribute('data-max') || '999');
                
                overlay.querySelectorAll<HTMLButtonElement>('.hhm-log-btn').forEach(btn => {
                    const bStep = parseInt(btn.getAttribute('data-step') || '0', 10);
                    btn.disabled = (parseFloat(defaultVal) + bStep < min || parseFloat(defaultVal) + bStep > max);
                });
            }
            return;
        }

        // save logic
        if (target.matches('.stepper-save') || target.matches('.rating-btn')) {
            const overlay = card.querySelector('.hhm-log-overlay');
            let finalVal = 0;

            if (target.matches('.rating-btn')) {
                finalVal = parseFloat(target.getAttribute('data-val') || '0');
            } else {
                finalVal = parseFloat(overlay?.querySelector('.hhm-log-value')?.textContent || '0');
            }

            overlay?.classList.remove('is-active');

            if (!dataMap[todayStr]) dataMap[todayStr] = {};
            dataMap[todayStr][prop] = finalVal;
            refreshUI();

            await this.saveValue(prop, finalVal, folder, todayStr);
            return;
        }

        if (target.matches('.rating-save')) {
            card.querySelector('.hhm-log-overlay')?.classList.remove('is-active');
        }
    }

    /*
    *  writes updated numeric values to the daily note frontmatter
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
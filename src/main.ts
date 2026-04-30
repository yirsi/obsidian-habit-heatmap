// main.ts
import { Plugin, parseYaml, WorkspaceLeaf } from 'obsidian';
import { HabitDashboardView, VIEW_TYPE_HABIT_DASHBOARD } from './dashboard-leaf';
import { DashboardController } from './controller';
import { HabitDashboardSettingTab } from './settings';

export interface HabitDashboardSettings {
    yamlConfig: string;
    parsedConfig: any;
}

const DEFAULT_YAML = `FOLDER: "Daily Notes"
STATS:
  - prop: "mood"
    title: "Mood"
    type: "habit"
    dataType: "rating"
    streakType: "none"
    boundaries: { min: 1, default: 4, max: 7 }
    color: { type: "absolute" }
`;

const DEFAULT_SETTINGS: HabitDashboardSettings = {
    yamlConfig: DEFAULT_YAML,
    parsedConfig: parseYaml(DEFAULT_YAML)
};

export default class HabitDashboardPlugin extends Plugin {
    settings!: HabitDashboardSettings;
    controller!: DashboardController;

    async onload() {
        await this.loadSettings();
        this.controller = new DashboardController(this.app);

        // register view
        this.registerView(
            VIEW_TYPE_HABIT_DASHBOARD,
            (leaf) => new HabitDashboardView(leaf, this)
        );

        // register Settings Tab
        this.addSettingTab(new HabitDashboardSettingTab(this.app, this));

        // add Ribbon Icon
        this.addRibbonIcon('flame', 'Open Habit Dashboard', () => {
            this.activateView();
        });

        // code Block Processor
        this.registerMarkdownCodeBlockProcessor("habit-heatmap", async (source, el, ctx) => {
            let config;
            try {
                const input = source.trim() ? source : this.settings.yamlConfig;
                config = parseYaml(input);
            } catch (e) {
                const message = e instanceof Error ? e.message : String(e);
                el.createEl("pre", { text: `YAML Error: ${message}` });
                return;
            }
            this.controller.mountDashboard(el, config);
        });
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    async activateView() {
        const { workspace } = this.app;

        let leaf: WorkspaceLeaf | null | undefined = null;
        const leaves = workspace.getLeavesOfType(VIEW_TYPE_HABIT_DASHBOARD);

        if (leaves.length > 0) {
            leaf = leaves[0];
        } else {
            leaf = workspace.getLeaf('tab');
            await leaf.setViewState({
                type: VIEW_TYPE_HABIT_DASHBOARD,
                active: true,
            });
        }

        if (leaf) workspace.revealLeaf(leaf);
    }
}
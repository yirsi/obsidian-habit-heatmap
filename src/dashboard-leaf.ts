import { ItemView, WorkspaceLeaf } from 'obsidian';
import HabitDashboardPlugin from './main';

export const VIEW_TYPE_HABIT_DASHBOARD = "habit-dashboard-view";

export class HabitDashboardView extends ItemView {
    plugin: HabitDashboardPlugin;

    constructor(leaf: WorkspaceLeaf, plugin: HabitDashboardPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType(): string {
        return VIEW_TYPE_HABIT_DASHBOARD;
    }

    getDisplayText(): string {
        return "Habit Heatmap Dashboard";
    }

    getIcon(): string {
        return "flame";
    }

    /*
    *  renders the dashboard into the main workspace tab
    */
    async onOpen() {
        const container = this.contentEl;
        container.empty();
        
        // add classes for styling
        container.addClass('hhm-main-view');

        // force a re-parse of settings in case they weren't ready
        let config;
        try {
            config = this.plugin.settings.parsedConfig;
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            console.error("Dashboard View: Failed to load config", message);
        }

        if (!config) {
            container.createEl("h3", { text: "Dashboard Configuration Error" });
            container.createEl("p", { text: "Please check your YAML in the plugin settings." });
            return;
        }

        // mount the dashboard logic through the controller
        this.plugin.controller.mountDashboard(container, config);
    }
}
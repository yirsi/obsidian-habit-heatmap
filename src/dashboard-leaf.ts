// dashboard-view.ts
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
        return "Habit Dashboard";
    }

    getIcon(): string {
        return "flame";
    }

    async onOpen() {
        const container = this.contentEl;
        container.empty();
        
        // Add classes for styling
        container.addClass('habit-dashboard-main-view');

        // Force a re-parse of settings in case they weren't ready
        let config;
        try {
            config = this.plugin.settings.parsedConfig;
        } catch (e) {
            console.error("Dashboard View: Failed to load config", e);
        }

        if (!config) {
            container.createEl("h3", { text: "Dashboard Configuration Error" });
            container.createEl("p", { text: "Please check your YAML in the plugin settings." });
            return;
        }

        // Mount the dashboard logic
        this.plugin.controller.mountDashboard(container, config);
    }
}
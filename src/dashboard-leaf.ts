import { ItemView, WorkspaceLeaf } from "obsidian";
import HabitDashboardPlugin from "./main";

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
		return "Habit heatmap dashboard";
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
		container.addClass("hhm-main-view");

		const config = {
			STATS: this.plugin.settings.stats,
			FOLDER: this.plugin.settings.folder,
			XP_SETTINGS: this.plugin.settings.xpSettings,
		};

		this.plugin.controller.mountDashboard(container, config);
	}
}

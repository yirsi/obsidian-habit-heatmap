import { Plugin, parseYaml, WorkspaceLeaf } from "obsidian";
import {
	HabitDashboardView,
	VIEW_TYPE_HABIT_DASHBOARD,
} from "./dashboard-leaf";
import { DashboardController } from "./controller";
import { HabitDashboardSettingTab } from "./settings";
import {
	HabitDashboardSettings,
	DEFAULT_STATS,
	DEFAULT_XP_SETTINGS,
} from "./types";

export default class HabitDashboardPlugin extends Plugin {
	settings!: HabitDashboardSettings;
	controller!: DashboardController;

	async onload() {
		await this.loadSettings();
		this.controller = new DashboardController(this.app);

		// register view
		this.registerView(
			VIEW_TYPE_HABIT_DASHBOARD,
			(leaf) => new HabitDashboardView(leaf, this),
		);

		// register settings Tab
		this.addSettingTab(new HabitDashboardSettingTab(this.app, this));

		// add ribbon icon
		this.addRibbonIcon("flame", "Open habit dashboard", () => {
			void this.activateView();
		});

		// code-block processor
		this.registerMarkdownCodeBlockProcessor(
			"habit-heatmap",
			(source, el) => {
				const configSource = source.trim();
				let config: Record<string, unknown>;

				try {
					if (configSource) {
						const parsed = parseYaml(configSource) as unknown;
						if (
							parsed &&
							typeof parsed === "object" &&
							!Array.isArray(parsed)
						) {
							config = parsed as Record<string, unknown>;
						} else {
							throw new Error(
								"Configuration must be a valid YAML object",
							);
						}
					} else {
						config = {
							STATS: this.settings.stats,
							FOLDER: this.settings.folder,
							XP_SETTINGS: this.settings.xpSettings,
						};
					}
				} catch (err: unknown) {
					const msg =
						err instanceof Error ? err.message : String(err);
					el.createEl("pre", { text: `YAML Error: ${msg}` });
					return;
				}
				this.controller.mountDashboard(el, config);
			},
		);
	}

	async loadSettings() {
		const loadedData =
			(await this.loadData()) as Partial<HabitDashboardSettings> | null;

		this.settings = {
			folder: loadedData?.folder ?? "Daily Notes",
			stats:
				loadedData?.stats ??
				(JSON.parse(
					JSON.stringify(DEFAULT_STATS),
				) as typeof DEFAULT_STATS),
			xpSettings: loadedData?.xpSettings ?? { ...DEFAULT_XP_SETTINGS },
		};
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
			leaf = workspace.getLeaf("tab");
			await leaf.setViewState({
				type: VIEW_TYPE_HABIT_DASHBOARD,
				active: true,
			});
		}

		if (leaf) await workspace.revealLeaf(leaf);
	}
}

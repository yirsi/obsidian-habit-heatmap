import {
	App,
	PluginSettingTab,
	Setting,
	parseYaml,
	stringifyYaml,
} from "obsidian";
import HabitDashboardPlugin from "./main";
import { DEFAULT_XP_SETTINGS, StatConfig } from "./types";

export class HabitDashboardSettingTab extends PluginSettingTab {
	plugin: HabitDashboardPlugin;
	private expandedIndices: Set<number> = new Set();

	constructor(app: App, plugin: HabitDashboardPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl).setName("Dashboard").setHeading();

		// --- 1. GENERAL SETTINGS ---
		new Setting(containerEl)
			.setName("Daily notes folder")
			.setDesc("Target folder for your daily notes")
			.addText((text) =>
				text
					.setPlaceholder("Daily notes")
					.setValue(this.plugin.settings.folder)
					.onChange(async (val) => {
						this.plugin.settings.folder = val || "Daily Notes";
						await this.plugin.saveSettings();
					}),
			);

		// --- 2. GLOBAL XP SETTINGS ---
		new Setting(containerEl).setName("Global xp").setHeading();
		const xpGroup = containerEl.createDiv({ cls: "hhm-setting-group" });

		new Setting(xpGroup)
			.setName("Character leveling factor")
			.setDesc(
				"Controls how much xp is needed to level up your main character",
			)
			.addText((text) =>
				text
					.setPlaceholder(String(DEFAULT_XP_SETTINGS.globalFactor))
					.setValue(
						String(this.plugin.settings.xpSettings.globalFactor),
					)
					.onChange(async (val) => {
						const num = Number(val);
						this.plugin.settings.xpSettings.globalFactor =
							val === "" || isNaN(num)
								? DEFAULT_XP_SETTINGS.globalFactor
								: num;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(xpGroup)
			.setName("Habit mastery factor")
			.setDesc(
				"Controls how much xp is needed to level up individual habit mastery levels",
			)
			.addText((text) =>
				text
					.setPlaceholder(String(DEFAULT_XP_SETTINGS.treeFactor))
					.setValue(
						String(this.plugin.settings.xpSettings.treeFactor),
					)
					.onChange(async (val) => {
						const num = Number(val);
						this.plugin.settings.xpSettings.treeFactor =
							val === "" || isNaN(num)
								? DEFAULT_XP_SETTINGS.treeFactor
								: num;
						await this.plugin.saveSettings();
					}),
			);

		// --- 3. TRACKER CONFIGURATION ---
		new Setting(containerEl).setName("Trackers").setHeading();

		this.plugin.settings.stats.forEach((stat, index) => {
			// Self-Healing Logic for older configs
			if (stat.multiplier === undefined) stat.multiplier = 1;
			if (stat.streakEnabled === undefined) stat.streakEnabled = true;
			if (!stat.boundaries)
				stat.boundaries = { min: 0, default: 0, max: 100 };
			if (!stat.color)
				stat.color = { type: "relative", rgb: "128, 128, 128" };

			const isExpanded = this.expandedIndices.has(index);
			const groupEl = containerEl.createDiv({ cls: "hhm-setting-group" });
			const isHabit = stat.type === "habit";

			// --- HEADER ROW ---
			const header = new Setting(groupEl)
				.setName(stat.title || "Untitled Tracker")
				.setDesc(
					isExpanded
						? ""
						: `Prop: ${stat.prop || "none"} | Type: ${stat.type || "metric"}`,
				);

			header.addExtraButton((btn) => {
				btn.setIcon(
					isExpanded ? "chevron-down" : "chevron-right",
				).setTooltip(isExpanded ? "Collapse" : "Expand");
				header.infoEl.prepend(btn.extraSettingsEl);
			});

			header.settingEl.addClass("hhm-setting-header");
			header.settingEl.onClickEvent(() => {
				if (isExpanded) this.expandedIndices.delete(index);
				else this.expandedIndices.add(index);
				this.display();
			});

			// MOVE UP
			header.addExtraButton((btn) => {
				btn.setIcon("arrow-up")
					.setTooltip("Move up")
					.setDisabled(index === 0)
					.onClick(async () => {
						if (index === 0) return;
						const stats = this.plugin.settings.stats;
						const currentItem = stats[index];
						const prevItem = stats[index - 1];
						if (currentItem && prevItem) {
							stats[index] = prevItem;
							stats[index - 1] = currentItem;
							const wasExpanded = this.expandedIndices.has(index);
							const prevExpanded = this.expandedIndices.has(
								index - 1,
							);
							if (wasExpanded)
								this.expandedIndices.add(index - 1);
							else this.expandedIndices.delete(index - 1);
							if (prevExpanded) this.expandedIndices.add(index);
							else this.expandedIndices.delete(index);
							await this.plugin.saveSettings();
							this.display();
						}
					});
				btn.extraSettingsEl.addEventListener("click", (e: MouseEvent) =>
					e.stopPropagation(),
				);
			});

			// MOVE DOWN
			header.addExtraButton((btn) => {
				btn.setIcon("arrow-down")
					.setTooltip("Move down")
					.setDisabled(
						index === this.plugin.settings.stats.length - 1,
					)
					.onClick(async () => {
						if (index >= this.plugin.settings.stats.length - 1)
							return;
						const stats = this.plugin.settings.stats;
						const currentItem = stats[index];
						const nextItem = stats[index + 1];
						if (currentItem && nextItem) {
							stats[index] = nextItem;
							stats[index + 1] = currentItem;
							const wasExpanded = this.expandedIndices.has(index);
							const nextExpanded = this.expandedIndices.has(
								index + 1,
							);
							if (wasExpanded)
								this.expandedIndices.add(index + 1);
							else this.expandedIndices.delete(index + 1);
							if (nextExpanded) this.expandedIndices.add(index);
							else this.expandedIndices.delete(index);
							await this.plugin.saveSettings();
							this.display();
						}
					});
				btn.extraSettingsEl.addEventListener("click", (e: MouseEvent) =>
					e.stopPropagation(),
				);
			});

			// DUPLICATE
			header.addExtraButton((btn) => {
				btn.setIcon("copy")
					.setTooltip("Duplicate tracker")
					.onClick(async () => {
						const copy = JSON.parse(
							JSON.stringify(stat),
						) as typeof stat;
						copy.prop += "_copy";
						copy.title += "Copy";
						this.plugin.settings.stats.splice(index + 1, 0, copy);
						this.expandedIndices.add(index + 1);
						await this.plugin.saveSettings();
						this.display();
					});
				btn.extraSettingsEl.addEventListener("click", (e: MouseEvent) =>
					e.stopPropagation(),
				);
			});

			// DELETE
			header.addExtraButton((btn) => {
				btn.setIcon("trash")
					.setTooltip("Delete tracker")
					.onClick(async () => {
						this.plugin.settings.stats.splice(index, 1);
						this.expandedIndices.delete(index);
						await this.plugin.saveSettings();
						this.display();
					});
				btn.extraSettingsEl.addEventListener("click", (e: MouseEvent) =>
					e.stopPropagation(),
				);
				btn.extraSettingsEl.addClass("hhm-danger-icon");
			});

			// --- EXPANDED BODY ---
			if (isExpanded) {
				let yamlEditor: HTMLTextAreaElement;
				const saveAndSync = async () => {
					await this.plugin.saveSettings();
					if (yamlEditor) yamlEditor.value = stringifyYaml(stat);
				};

				// --- 1. IDENTITY ---
				new Setting(groupEl)
					.setName("Property key")
					.setDesc('Frontmatter key (e.g. "exercise").')
					.addText((t) =>
						t.setValue(stat.prop).onChange(async (v) => {
							stat.prop = v;
							await saveAndSync();
						}),
					);
				new Setting(groupEl)
					.setName("Display title")
					.setDesc("Name shown on the card.")
					.addText((t) =>
						t.setValue(stat.title).onChange(async (v) => {
							stat.title = v;
							await saveAndSync();
						}),
					);

				// --- 2. BEHAVIOR ---
				new Setting(groupEl)
					.setName("Tracker type")
					.setDesc(
						"Habits earn xp; metrics are for data tracking only.",
					)
					.addDropdown((d) =>
						d
							.addOptions({ habit: "Habit", metric: "Metric" })
							.setValue(stat.type || "metric")
							.onChange(async (v) => {
								stat.type = v as "habit" | "metric";
								if (v === "metric") {
									stat.multiplier = 0;
									stat.streakEnabled = false;
								} else {
									if (stat.multiplier === 0)
										stat.multiplier = 1;
									stat.streakEnabled = true;
								}
								await saveAndSync();
								this.display();
							}),
					);

				new Setting(groupEl)
					.setName("Frequency")
					.setDesc(
						"How often is this tracked? (affects displayed averages)",
					)
					.addDropdown((d) =>
						d
							.addOptions({
								day: "Daily",
								week: "Weekly",
								month: "Monthly",
							})
							.setValue(stat.freq || "day")
							.onChange(async (v) => {
								stat.freq = v as typeof stat.freq;
								await saveAndSync();
							}),
					);

				new Setting(groupEl)
					.setName("Goal direction")
					.setDesc("Up or down improvement; affects streaks")
					.addDropdown((d) =>
						d
							.addOptions({ up: "Up", down: "Down" })
							.setValue(stat.goal)
							.onChange(async (v) => {
								stat.goal = v as "up" | "down";
								await saveAndSync();
							}),
					);
				new Setting(groupEl)
					.setName("Unit label")
					.setDesc("Text shown next to values.")
					.addText((t) =>
						t
							.setPlaceholder("E.g., min, cups")
							.setValue(stat.unit)
							.onChange(async (v) => {
								stat.unit = v;
								await saveAndSync();
							}),
					);

				// --- 3. REWARDS (Habits Only) ---
				if (isHabit) {
					new Setting(groupEl)
						.setName("Streak tracker")
						.setDesc("Display a 🔥 streak if the goal is met.")
						.addToggle((toggle) =>
							toggle
								.setValue(stat.streakEnabled)
								.onChange(async (v) => {
									stat.streakEnabled = v;
									await saveAndSync();
								}),
						);

					new Setting(groupEl)
						.setName("Mastery threshold")
						.setDesc("Average needed for diamond rank.")
						.addText((t) =>
							t
								.setValue(String(stat.mastery))
								.onChange(async (v) => {
									stat.mastery = Number(v) || 0;
									await saveAndSync();
								}),
						);

					new Setting(groupEl)
						.setName("Xp reward factor")
						.setDesc(
							stat.goal === "up"
								? "XP earned per 1 unit logged."
								: "Flat XP awarded for logging 0.",
						)
						.addText((t) =>
							t
								.setValue(String(stat.multiplier))
								.onChange(async (v) => {
									stat.multiplier = Number(v) || 0;
									await saveAndSync();
								}),
						);
				}

				// --- 4. BOUNDARIES ---
				new Setting(groupEl)
					.setName("Minimum value")
					.setDesc("Lowest possible input.")
					.addText((t) =>
						t
							.setValue(String(stat.boundaries.min))
							.onChange(async (v) => {
								stat.boundaries.min = Number(v) || 0;
								await saveAndSync();
							}),
					);
				new Setting(groupEl)
					.setName("Default value")
					.setDesc("Starting value for today.")
					.addText((t) =>
						t
							.setValue(String(stat.boundaries.default))
							.onChange(async (v) => {
								stat.boundaries.default = Number(v) || 0;
								await saveAndSync();
							}),
					);
				new Setting(groupEl)
					.setName("Maximum value")
					.setDesc("Highest possible input.")
					.addText((t) =>
						t
							.setValue(String(stat.boundaries.max))
							.onChange(async (v) => {
								stat.boundaries.max = Number(v) || 0;
								await saveAndSync();
							}),
					);

				// --- 5. VISUALS ---
				new Setting(groupEl)
					.setName("Coloring style")
					.setDesc("Heatmap intensity logic.")
					.addDropdown((d) =>
						d
							.addOptions({
								relative: "Relative (Single Color)",
								absolute: "Absolute (3-Color)",
							})
							.setValue(stat.color.type)
							.onChange(async (v) => {
								stat.color.type = v as typeof stat.color.type;
								this.display();
								await saveAndSync();
							}),
					);

				if (stat.color.type === "relative") {
					new Setting(groupEl)
						.setName("Base color")
						.setDesc("Pick a hex color.")
						.addText((t) =>
							t
								.setPlaceholder("#hex")
								.setValue(
									this.rgbToHex(
										stat.color.rgb || "128, 128, 128",
									),
								)
								.onChange(async (v) => {
									stat.color.rgb = this.hexToRgb(v);
									await saveAndSync();
								}),
						);
				} else {
					const palette = stat.color.palette || [
						"#ff2222",
						"#eeee44",
						"#33ff44",
					];
					new Setting(groupEl).setName("Low color").addText((t) =>
						t.setValue(palette[0] || "").onChange(async (v) => {
							stat.color.palette![0] = v;
							await saveAndSync();
						}),
					);
					new Setting(groupEl).setName("Mid color").addText((t) =>
						t.setValue(palette[1] || "").onChange(async (v) => {
							stat.color.palette![1] = v;
							await saveAndSync();
						}),
					);
					new Setting(groupEl).setName("High color").addText((t) =>
						t.setValue(palette[2] || "").onChange(async (v) => {
							stat.color.palette![2] = v;
							await saveAndSync();
						}),
					);
				}

				// --- 6. ADVANCED ---
				new Setting(groupEl)
					.setName("Advanced configuration")
					.setDesc("Manual YAML override.")
					.addToggle((toggle) =>
						toggle.onChange((value) => {
							if (yamlEditor) {
								yamlEditor.toggleClass("is-hidden", !value);
								if (value)
									yamlEditor.value = stringifyYaml(stat);
							}
						}),
					);

				// Creating it here ensures it appends BELOW the toggle setting
				yamlEditor = groupEl.createEl("textarea", {
					cls: "hhm-settings-textarea is-hidden", // Added is-hidden on creation
					attr: { spellcheck: "false" },
				});

				yamlEditor.addEventListener("blur", () => {
					void (async () => {
						try {
							const yamlValue: string = yamlEditor.value;
							const parsed = parseYaml(
								yamlValue,
							) as unknown as StatConfig | null;

							if (parsed && "prop" in parsed && parsed.prop) {
								this.plugin.settings.stats[index] = parsed;
								await this.plugin.saveSettings();
								this.display();
							}
						} catch (err: unknown) {
							const message: string =
								err instanceof Error
									? err.message
									: String(err);
							console.error("HHM: Invalid YAML", message);
						}
					})();
				});
			}
		});

		// Add Button
		new Setting(containerEl).addButton((btn) =>
			btn
				.setButtonText("Add tracker")
				.setCta()
				.onClick(async () => {
					const newIndex = this.plugin.settings.stats.length;
					this.plugin.settings.stats.push({
						prop: "new-prop",
						title: "New Tracker",
						type: "habit",
						goal: "up",
						mastery: 10,
						unit: "pts",
						freq: "day",
						multiplier: 1,
						streakEnabled: true,
						boundaries: { min: 0, default: 0, max: 100 },
						color: { type: "relative", rgb: "128, 128, 128" },
					});
					this.expandedIndices.add(newIndex);
					await this.plugin.saveSettings();
					this.display();
				}),
		);
	}

	private hexToRgb(hex: string): string {
		const clean = hex.replace("#", "");
		const bigint = parseInt(clean, 16);
		const r = (bigint >> 16) & 255;
		const g = (bigint >> 8) & 255;
		const b = bigint & 255;
		return isNaN(r) ? "128, 128, 128" : `${r}, ${g}, ${b}`;
	}

	private rgbToHex(rgb: string): string {
		const [r, g, b] =
			(rgb
				.split(",")
				.map((n) => Number(n.trim()))
				.filter((n) => !isNaN(n) && n >= 0 && n <= 255) as [
				number,
				number,
				number,
			]) ?? [];

		return [r, g, b].length === 3
			? `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).padStart(6, "0")}`
			: "#808080";
	}
}

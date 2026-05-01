import { App, TFile } from "obsidian";
import { HabitEngine } from "./engine";
import { DashboardRenderer } from "./view";
import { StatConfig, XpSettings, DEFAULT_XP_SETTINGS } from "./types";

export class DashboardController {
	app: App;
	renderer: DashboardRenderer;

	constructor(app: App) {
		this.app = app;
		this.renderer = new DashboardRenderer();
	}

	/*
	 *  registers the markdown processor for the plugin
	 *  handles dataview fetching and initializes the render loop
	 */
	public mountDashboard(el: HTMLElement, config: unknown) {
		const cfg = (config ?? {}) as Record<string, unknown>;
		const STATS = (cfg.STATS as StatConfig[]) ?? [];
		const XP_SETTINGS =
			(cfg.XP_SETTINGS as XpSettings) ?? DEFAULT_XP_SETTINGS;
		const FOLDER = (cfg.FOLDER as string) ?? '""';

		const cleanFolder = FOLDER.replace(/"/g, "").replace(/'/g, "");
		const todayStr = window.moment().format("YYYY-MM-DD");

		// local state memory for optimistic ui updates
		const dataMap: Record<string, unknown> = {};
		const container = el.createDiv();

		/*
		 *  compiles data through engine.ts
		 *  refreshes the inner html of the dashboard container
		 */
		const refreshUI = () => {
			const engine = new HabitEngine(STATS, XP_SETTINGS);
			const store = engine.process(dataMap, todayStr);
			container.empty();
			const html = this.renderer.renderDashboard(store, STATS);
			const fragment = document
				.createRange()
				.createContextualFragment(html);
			container.appendChild(fragment);
		};

		// setup retry logic to handle dataview indexing lag
		let retries = 0;
		const maxRetries = 5;

		/*
		 *  fetches data from dataview cache
		 *  re-runs itself if the index is not yet fully loaded
		 */
		const loadAndRender = () => {
			try {
				const dv = (
					this.app as unknown as {
						plugins: {
							plugins: Record<
								string,
								{ api?: Record<string, unknown> }
							>;
						};
					}
				).plugins.plugins["dataview"]?.api;
				if (!dv) {
					el.createEl("h3", { text: "Dataview plugin required" });
					return;
				}

				const queryFolder = cleanFolder ? `"${cleanFolder}"` : '""';
				const pages = (
					dv as unknown as {
						pages: (q: string) => { length: number };
					}
				).pages(queryFolder);

				if (pages.length === 0 && retries < maxRetries) {
					retries++;
					setTimeout(loadAndRender, 500);
					return;
				}

				(
					pages as unknown as {
						where: (
							fn: (p: {
								file?: { day?: { toJSDate: () => Date } };
							}) => boolean,
						) => {
							forEach: (
								fn: (p: {
									file?: { day?: { toJSDate: () => Date } };
								}) => void,
							) => void;
						};
					}
				)
					.where((p) => !!p.file?.day)
					.forEach((p) => {
						const day = p.file?.day;
						if (day) {
							const date = window
								.moment(day.toJSDate())
								.format("YYYY-MM-DD");
							dataMap[date] = p as unknown as Record<
								string,
								unknown
							>;
						}
					});

				refreshUI();

				container.addEventListener("click", (e) => {
					void this.handleInteraction(
						e,
						dataMap,
						todayStr,
						cleanFolder,
						refreshUI,
						STATS,
					);
				});
			} catch (err: unknown) {
				const message =
					err instanceof Error ? err.message : String(err);
				console.error("Dashboard Render Error:", err);
				el.empty();
				el.createDiv({ text: `️Render Error: ${message}` });
			}
		};

		loadAndRender();
	}

	/*
	 *  manages all user interactions within the dashboard
	 *  handles overlay toggles, stepper calculations, and save events
	 */
	private async handleInteraction(
		e: Event,
		dataMap: Record<string, unknown>,
		todayStr: string,
		folder: string,
		refreshUI: () => void,
		stats: StatConfig[],
	) {
		const target = e.target as HTMLElement;
		const card = target.closest(".hhm-card") as HTMLElement;
		if (!card) return;

		const prop = card.getAttribute("data-prop");
		const stat = stats.find((s) => s.prop === prop);
		if (!prop || !stat) return;

		// open overlay trigger
		if (target.matches(".hhm-log-trigger")) {
			target
				.closest(".hhm-wrapper")
				?.querySelectorAll(".hhm-log-overlay.is-active")
				.forEach((ov) => ov.classList.remove("is-active"));
			card.querySelector(".hhm-log-overlay")?.classList.add("is-active");
			return;
		}

		// cancel overlay action
		if (
			target.classList.contains("hhm-log-overlay") ||
			target.matches(".cancel")
		) {
			target.classList.remove("is-active");
			return;
		}

		// stepper increment and boundary enforcement
		if (target.matches(".step-btn")) {
			const valEl = card.querySelector(".hhm-log-value");
			if (valEl) {
				const step = parseInt(
					target.getAttribute("data-step") ?? "0",
					10,
				);
				const current = parseFloat(valEl.textContent ?? "0");
				const newVal = current + step;
				valEl.textContent = String(newVal);

				const overlay = target.closest(
					".hhm-log-overlay",
				) as HTMLElement;
				const min = stat.boundaries.min;
				const max = stat.boundaries.max;

				overlay
					.querySelectorAll<HTMLButtonElement>(".hhm-log-btn")
					.forEach((btn) => {
						const bStep = parseInt(
							btn.getAttribute("data-step") ?? "0",
							10,
						);
						btn.disabled =
							newVal + bStep < min || newVal + bStep > max;
					});
			}
			return;
		}

		// reset value to config defaults
		if (target.matches(".hhm-log-reset")) {
			const valEl = card.querySelector(".hhm-log-value");
			if (valEl) {
				const defaultVal = stat.boundaries.default;
				valEl.textContent = String(defaultVal);

				const overlay = target.closest(
					".hhm-log-overlay",
				) as HTMLElement;
				const min = stat.boundaries.min;
				const max = stat.boundaries.max;

				overlay
					.querySelectorAll<HTMLButtonElement>(".hhm-log-btn")
					.forEach((btn) => {
						const bStep = parseInt(
							btn.getAttribute("data-step") ?? "0",
							10,
						);
						btn.disabled =
							defaultVal + bStep < min ||
							defaultVal + bStep > max;
					});
			}
			return;
		}

		// save logic for both stepper confirm and direct rating taps
		if (target.matches(".stepper-save") || target.matches(".rating-btn")) {
			const overlay = card.querySelector(".hhm-log-overlay");
			let finalVal = 0;

			if (target.matches(".rating-btn")) {
				finalVal = parseFloat(target.getAttribute("data-val") ?? "0");
			} else {
				finalVal = parseFloat(
					overlay?.querySelector(".hhm-log-value")?.textContent ??
						"0",
				);
			}

			overlay?.classList.remove("is-active");

			const dayEntry =
				(dataMap[todayStr] as Record<string, unknown>) ?? {};
			dayEntry[prop] = finalVal;
			dataMap[todayStr] = dayEntry;

			refreshUI();

			await this.saveValue(prop, finalVal, folder, todayStr);
			return;
		}

		// close rating overlay if checkmark is tapped (no-op)
		if (target.matches(".rating-save")) {
			card.querySelector(".hhm-log-overlay")?.classList.remove(
				"is-active",
			);
		}
	}

	/*
	 *  writes updated numeric values to the daily note frontmatter
	 *  creates the file automatically if it does not already exist
	 */
	private async saveValue(
		prop: string,
		value: number,
		folder: string,
		todayStr: string,
	) {
		const todayPath = `${folder}/${todayStr}.md`;
		const file = this.app.vault.getAbstractFileByPath(todayPath);

		if (!file) {
			await this.app.vault.create(
				todayPath,
				`---\n${prop}: ${value}\n---`,
			);
		} else if (file instanceof TFile) {
			await this.app.fileManager.processFrontMatter(
				file,
				(fm: Record<string, unknown>) => {
					fm[prop] = value;
				},
			);
		}
	}
}

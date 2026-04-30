import { App, PluginSettingTab, Setting } from 'obsidian';
import HabitDashboardPlugin from './main';
import { parseYaml } from 'obsidian';

export class HabitDashboardSettingTab extends PluginSettingTab {
    plugin: HabitDashboardPlugin;

    constructor(app: App, plugin: HabitDashboardPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'Habit Dashboard Settings' });

new Setting(containerEl)
    .setName('Dashboard Configuration')
    .setDesc('Paste your YAML configuration here.')
    .setClass('habit-settings-area')
    .addTextArea(text => text
        .setPlaceholder('FOLDER: "..." \nSTATS: ...')
        .setValue(this.plugin.settings.yamlConfig)
        .onChange(async (value) => {
            try {
                const parsed = parseYaml(value);
                if (parsed) {
                    this.plugin.settings.yamlConfig = value;
                    this.plugin.settings.parsedConfig = parsed;
                    await this.plugin.saveSettings();
                }
            } catch (e) {
            // wait for yaml
            }
        }));

        // add a helper note
        containerEl.createEl('p', { 
            text: 'Note: Changes will take effect the next time the Dashboard is opened or refreshed.',
            cls: 'setting-item-description'
        });
    }
}
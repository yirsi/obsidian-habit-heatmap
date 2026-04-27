Here is your updated, ADHD-friendly `README.md`. It reflects the latest unified YAML structure and the 0.2.0 features.

***

# Obsidian Habit Heatmap

A visual, gamified dashboard for tracking habits and life stats directly from your Daily Notes.

## Features
- **GitHub-Style Heatmaps**: Visual 90-day history for every stat.
- **Gamified Progression**: Earn XP and level up your habits.
- **Competitive Ranks**: Tiered ranking system (Iron to Diamond) based on 90-day performance.
- **Daily Quests**: Visual progress bar for your daily habit completion.
- **Smart Data**: Automatic sanitization and default values for missing logs.

## Planned
- **Settings UI**: Configuration menu (no more YAML).
- **Standalone**: Remove Dataview dependency.
- **Interactive**: Click cards to log data instantly.
- **Achievements**: Unlock badges for milestones.

## Prerequisites
- **Dataview Plugin**: Must be installed and enabled.

## Installation
1. Create a folder: `YourVault/.obsidian/plugins/habit-heatmap/`
2. Copy `main.js`, `manifest.json`, and `styles.css` into that folder.
3. Enable the plugin in Obsidian settings.

## Usage
Insert this code block into any note. 

### Minimal Example
```habit-dashboard
FOLDER: '"100 Journal"'
XP_SETTINGS: { globalFactor: 30, treeFactor: 50 }

STATS:
  - { prop: "mood", type: "metric", dataType: "rating", title: "🧠 Mood", streakType: "none", boundaries: { min: 1, default: 4, max: 7 }, color: { type: "absolute", palette: ["#ff2222", "#eeee44", "#33ff44"] } }
  - { prop: "exercise", type: "habit", dataType: "time", title: "🏋️ Exercise", streakType: "positive", unit: "min", freq: "day", boundaries: { min: 0, default: 0, max: 1440 }, mastery: 60, xp: { type: "linear", div: 1 }, color: { type: "relative", rgb: "255, 140, 0" } }
  - { prop: "cannabis", type: "metric", dataType: "amount", title: "🌿 Sober", streakType: "negative", goal: "down", unit: "use", freq: "week", boundaries: { min: 0, default: 0, max: 99 }, color: { type: "relative", rgb: "107, 142, 35" } }
```

### Data Setup
The plugin reads from the frontmatter of your daily notes:
```markdown
---
mood: 5
exercise: 45
daily_task: 3
---
```

### Configuration Breakdown
- **type**: `habit` (Level/Rank/XP) or `metric` (Data only).
- **dataType**: `rating` (Centered at midpoint), `time` (Minutes/Hours), or `amount` (Counts).
- **streakType**: `positive` (Log > 0), `negative` (Log is 0), or `none`.
- **boundaries**: Sets the min, max, and default value used if a day is left blank.
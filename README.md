# Obsidian Habit Heatmap

A visual, gamified dashboard for tracking habits and life stats.

## Features
- GitHub-style heatmaps for habits
- Gamified XP and Leveling system
- Habit ranks (Bronze to Diamond)
- "Daily Quest" completion tracking.

## Planned
- Settings menu
- Remove dependency on dataview
- Achievements
- Interactive frontmatter editing for current day
- Code cleanup

## Prerequisites
- **Dataview Plugin**: This version requires Dataview to fetch data from your daily notes.

## How to use

- Clone this repo.
- Make sure your NodeJS is at least v16 (`node --version`).
- `npm i` or `yarn` to install dependencies.
- `npm run dev` to start compilation in watch mode.

## Manually installing the plugin

- Copy over `main.js`, `styles.css`, `manifest.json` to your vault `VaultFolder/.obsidian/plugins/habit-heatmap/`.

## Usage
Insert a code block into any note:
```habit-dashboard
FOLDER: '"100 Journal"'

XP_SETTINGS:
  globalFactor: 30
  treeFactor: 50
  taskMultiplier: 15
  minutesPerXp: 1
  sleepBaseHours: 6
  sleepXpMultiplier: 2

STATS:
  - { prop: "mood", type: "metric", title: "🧠 Mood", goal: "up", streakType: "none", mastery: 7, xp: { type: "none" }, unit: "score", freq: "day" }
  - { prop: "sleep", type: "metric", title: "💤 Sleep", goal: "up", streakType: "none", mastery: 8, xp: { type: "none" }, unit: "h", freq: "day" }
  - { prop: "coffee", type: "metric", title: "☕ Coffee", goal: "down", streakType: "none", mastery: 2, xp: { type: "none" }, unit: "cups", freq: "day" }
  - { prop: "cannabis", type: "metric", title: "🌿 Cannabis", goal: "down", streakType: "negative", mastery: 0, xp: { type: "none" }, unit: "use", freq: "week" }
  - { prop: "exercise", type: "habit", title: "🏋️ Exercise", goal: "up", streakType: "positive", mastery: 60, xp: { type: "linear", div: 1 }, unit: "min", freq: "day" }
  - { prop: "meditation", type: "habit", title: "🧘 Meditation", goal: "up", streakType: "positive", mastery: 90, xp: { type: "linear", div: 1 }, unit: "min", freq: "day" }
  - { prop: "uni_study", type: "habit", title: "🎓 Academic", goal: "up", streakType: "positive", mastery: 120, xp: { type: "linear", div: 1 }, unit: "min", freq: "day" }
  - { prop: "daily_task", type: "habit", title: "✅ Daily Task", goal: "up", streakType: "positive", mastery: 3, xp: { type: "multiplier", mul: 20 }, unit: "tasks", freq: "day" }
  - { prop: "research", type: "habit", title: "🧠 Research", goal: "up", streakType: "positive", mastery: 120, xp: { type: "linear", div: 1 }, unit: "min", freq: "day" }
  - { prop: "language", type: "habit", title: "🗣️ Language", goal: "up", streakType: "positive", mastery: 20, xp: { type: "linear", div: 1 }, unit: "min", freq: "day" }

COLORS:
  mood: { type: "absolute", colors: ["#ff2222", "#eeee44", "#33ff44"], min: 1, mid: 4, max: 7 }
  sleep: { type: "absolute", colors: ["#aa2222", "#6644ff", "#2277ff"], min: 4, mid: 6, max: 10 }
  coffee: { type: "relative", rgb: "160, 82, 45" }
  exercise: { type: "relative", rgb: "255, 140, 0" }
  meditation: { type: "relative", rgb: "0, 191, 255" }
  uni_study: { type: "relative", rgb: "147, 112, 219" }
  language: { type: "relative", rgb: "0, 206, 209" }
  cannabis: { type: "relative", rgb: "107, 142, 35" }
  daily_task: { type: "relative", rgb: "46, 160, 67" }
  research: { type: "relative", rgb: "200, 200, 200" }
```

Your stats should be saved within the frontmatter of your daily notes in a number format
```md
---
mood: 4
exercise: 20
daily_task: 2
---
```

The mood stat goes from 1-7 (1: awful; 7: amazing)
All other stats are either measured in minutes (xp type linear)
# Architecture

## Project Structure
- `types.ts`: central type definitions
- `engine.ts`: data processing and math logic
- `view.ts`: html templates and ui components
- `controller.ts`: event handling and file i/o
- `dashboard-leaf.ts`: main tab view registration
- `settings.ts`: plugin settings ui
- `main.ts`: plugin entry point

## Data Flow
1. `main.ts` (codeblocks) or `dashboard-leaf.ts` (main view) calls `controller.ts`
2. `controller.ts` fetches raw data from dataview
3. `engine.ts` processes data into `HabitStore`
4. `view.ts` renders an html string based on `HabitStore`
5. `controller.ts` mounts the html and handles interactions
# Architecture

## Project Structure
- `engine.ts`: XP and streak calculations
- `view.ts`: HTML templates and UI components
- `controller.ts`: Event listeners, and file I/O
- `sidebar.ts`: Sidebar view registration
- `main.ts`: Entry point

## Data Flow
1. `main.ts` or `sidebar.ts` passes config to `controller.ts`
2. `controller.ts` fetches data from Dataview (change later probably)
3. `engine.ts` processes raw data into `HabitStore`
4. `view.ts` renders HTML based on `HabitStore`
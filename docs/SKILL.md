---
name: Stream Deck Plugin Development
description: How to develop, debug, and configure Stream Deck SDK (Node.js) plugins, focusing on common pitfalls, UI/Manifest issues, and hardware data querying.
---

# Stream Deck Plugin Development Skill

This document summarizes the essential know-how, workflow, and critical pitfalls for developing Elgato Stream Deck plugins (specifically using the official TypeScript/Node.js SDK and Rollup).

## 1. Project Initialization & Architecture

- **Tools**: Use `@elgato/cli` (`npm install -g @elgato/cli`) to generate project templates.
- **SDK**: Use `@elgato/streamdeck` for the main runtime.
- **Structure**: A `.sdPlugin` folder is required. It contains `manifest.json`, compiled JS (`bin/plugin.js`), images (`imgs`), and layout definitions (`layouts`).

## 2. Manifest Configuration (`manifest.json`)

Stream Deck applications are exceptionally strict about `manifest.json` schemas.

- **CRITICAL PITFALL - Actions MUST have States**: Even if your action is exclusively controlled via a dial (Encoder) and touch display, you **MUST** define at least one `State` in the `Actions` array. If the `States` array is missing, the Stream Deck desktop app will silently drop the action with an error log `missing at least one state`, and it won't appear in the action list.
  ```json
  "States": [
    {
      "Image": "imgs/action",
      "TitleAlignment": "middle",
      "FontSize": "10"
    }
  ]
  ```

## 3. Touchscreen Layouts (`layouts/*.json`)

For the Stream Deck+, you define touchscreen UI using custom JSON layouts.

- **CRITICAL PITFALL - Overlapping Elements**: Stream Deck's layout composer engine will violently reject any layout if two elements overlap by even a single pixel in their bounding boxes (`rect`). If you see `element overlaps with element` in the `StreamDeck.json` logs, the entire layout will fail to render, crashing the plugin display. **Always calculate your X, Y, Width, and Height correctly so no rects overlap.**
- **Text / Value Properties**: When defining a `text` type item in the layout JSON, the default text content is set using the `"value"` key, not `"text"`. Using the incorrect key name (such as `"text"`) will result in a `cannot set property 'text' ... nonsense value` error.

## 4. TypeScript & SDK API Mapping Errors

- **Event Naming Differences**:
  - Dial press events are triggered via `onDialDown` and `onDialUp` with the `DialDownEvent` / `DialUpEvent` types. `onDialPress` does NOT exist on the modern `SingletonAction` base class.
- **Custom Settings**: When receiving or pulling settings (e.g. `DidReceiveSettingsEvent<JsonObject>`), custom interfaces must either extend `JsonObject` or include an index signature (`[key: string]: unknown`) to satisfy TypeScript constraints.

## 5. Rollup Bundling & Module Resolution

- **Native Modules**: When importing third-party CJS packages or packages using JSON (like `systeminformation`), ensure both `@rollup/plugin-commonjs` and `@rollup/plugin-json` are added to your `rollup.config.mjs`.
- **External Native Libraries**: Libraries that depend on C/C++ bindings (like `ws` or `bufferutil`) often cannot be safely bundled. Add them to the `external` array in your Rollup config so the Node.js runtime searches for them in `node_modules` instead.

## 6. Querying OS System Information (macOS/Windows)

- **CPU Usage**: Can be reasonably calculated using the `node:os` module's `os.cpus()` by measuring the delta of `idle` times versus total cycles over an interval.
- **RAM Usage on macOS**:
  - **Avoid `os.freemem()`**: macOS (and Linux) uses unused RAM for file caching, meaning "free memory" will appear astronomically low (making used RAM seem constantly >95%).
  - **Use `systeminformation` (`si.mem()`)**: Rely on `mem.total - mem.available` to calculate actual active/used memory, which accurately aligns with the OS's Activity Monitor.

## 7. Stream Deck Logs

Whenever a layout fails to load or an action doesn't appear, ALWAYS check the main application logs.

- **macOS**: `~/Library/Logs/ElgatoStreamDeck/StreamDeck.json`
- **Restarting**: Use the CLI strictly to test updates: `streamdeck restart com.developer.plugin`

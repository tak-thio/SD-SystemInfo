import streamDeck, { action, DialRotateEvent, DialDownEvent, TouchTapEvent, WillAppearEvent, WillDisappearEvent, SingletonAction, DidReceiveSettingsEvent, type JsonObject } from "@elgato/streamdeck";
import os from "node:os";
import si from "systeminformation";
import { exec } from "node:child_process";

/** Display mode enum */
enum DisplayMode {
	Combined = 0,
	CpuOnly = 1,
	RamOnly = 2,
}

/** Layout file paths */
const LAYOUTS = {
	[DisplayMode.Combined]: "layouts/layout-combined.json",
	[DisplayMode.CpuOnly]: "layouts/layout-cpu.json",
	[DisplayMode.RamOnly]: "layouts/layout-ram.json",
};

const MODE_COUNT = 3;
const DEFAULT_INTERVAL = 3;

/** Previous CPU measurement for delta calculation */
interface CpuSnapshot {
	idle: number;
	total: number;
}

/**
 * System Monitor action for Stream Deck+ encoder (dial).
 * Displays CPU and RAM usage on the touchscreen.
 *
 * Settings (JsonObject):
 *   updateInterval: number (seconds, default 3)
 */
@action({ UUID: "com.tak.system-monitor.monitor" })
export class SystemMonitorAction extends SingletonAction {
	/** Polling timer handle per action context */
	private timers = new Map<string, ReturnType<typeof setInterval>>();

	/** Current display mode per action context */
	private modes = new Map<string, DisplayMode>();

	/** Previous CPU snapshot for delta calculation */
	private prevCpu = new Map<string, CpuSnapshot>();

	// ─── Lifecycle ──────────────────────────────────────

	override async onWillAppear(ev: WillAppearEvent<JsonObject>): Promise<void> {
		const ctx = ev.action.id;
		const interval = this.getInterval(ev.payload.settings);

		this.modes.set(ctx, DisplayMode.Combined);
		this.prevCpu.set(ctx, this.takeCpuSnapshot());

		// Initial update after a short delay so the layout is ready
		setTimeout(() => this.doUpdate(ev.action), 500);

		// Start polling
		const timer = setInterval(() => this.doUpdate(ev.action), interval * 1000);
		this.timers.set(ctx, timer);
	}

	override async onWillDisappear(ev: WillDisappearEvent<JsonObject>): Promise<void> {
		const ctx = ev.action.id;
		const timer = this.timers.get(ctx);
		if (timer) {
			clearInterval(timer);
			this.timers.delete(ctx);
		}
		this.modes.delete(ctx);
		this.prevCpu.delete(ctx);
	}

	// ─── Dial Events ────────────────────────────────────

	override async onDialRotate(ev: DialRotateEvent<JsonObject>): Promise<void> {
		const ctx = ev.action.id;
		const current = this.modes.get(ctx) ?? DisplayMode.Combined;

		// Rotate through modes
		const direction = ev.payload.ticks > 0 ? 1 : -1;
		const next = ((current + direction + MODE_COUNT) % MODE_COUNT) as DisplayMode;
		this.modes.set(ctx, next);

		// Switch layout
		await ev.action.setFeedbackLayout(LAYOUTS[next]);

		// Immediate update with new layout
		setTimeout(() => this.doUpdate(ev.action), 100);
	}

	override async onDialDown(ev: DialDownEvent<JsonObject>): Promise<void> {
		this.openActivityMonitor();
	}

	override async onTouchTap(ev: TouchTapEvent<JsonObject>): Promise<void> {
		this.openActivityMonitor();
	}

	// ─── Settings ───────────────────────────────────────

	override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<JsonObject>): Promise<void> {
		const ctx = ev.action.id;
		const interval = this.getInterval(ev.payload.settings);

		// Restart timer with new interval
		const timer = this.timers.get(ctx);
		if (timer) {
			clearInterval(timer);
		}
		const newTimer = setInterval(() => this.doUpdate(ev.action), interval * 1000);
		this.timers.set(ctx, newTimer);
	}

	// ─── Display Update ─────────────────────────────────

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private async doUpdate(actionObj: any): Promise<void> {
		const ctx = actionObj.id as string;
		const mode = this.modes.get(ctx) ?? DisplayMode.Combined;

		const cpuPercent = this.getCpuUsage(ctx);
		const ramInfo = await this.getRamInfo();

		try {
			switch (mode) {
				case DisplayMode.Combined:
					await actionObj.setFeedback({
						"cpu-value": `${cpuPercent}%`,
						"cpu-bar": { value: cpuPercent },
						"ram-value": `${ramInfo.usedPercent}%`,
						"ram-free": `${ramInfo.freeGB} free`,
						"ram-bar": { value: ramInfo.usedPercent },
					});
					break;

				case DisplayMode.CpuOnly:
					await actionObj.setFeedback({
						"cpu-value": `${cpuPercent}%`,
						"cpu-bar": { value: cpuPercent },
					});
					break;

				case DisplayMode.RamOnly:
					await actionObj.setFeedback({
						"ram-value": `${ramInfo.usedPercent}%`,
						"ram-free": `${ramInfo.freeGB} free`,
						"ram-bar": { value: ramInfo.usedPercent },
					});
					break;
			}
		} catch (error) {
			streamDeck.logger.error(`Failed to update display: ${error}`);
		}
	}

	// ─── System Info ────────────────────────────────────

	private takeCpuSnapshot(): CpuSnapshot {
		const cpus = os.cpus();
		let idle = 0;
		let total = 0;
		for (const cpu of cpus) {
			idle += cpu.times.idle;
			total += cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.irq + cpu.times.idle;
		}
		return { idle, total };
	}

	private getCpuUsage(ctx: string): number {
		const prev = this.prevCpu.get(ctx);
		const current = this.takeCpuSnapshot();
		this.prevCpu.set(ctx, current);

		if (!prev) return 0;

		const idleDelta = current.idle - prev.idle;
		const totalDelta = current.total - prev.total;

		if (totalDelta === 0) return 0;

		return Math.round(((totalDelta - idleDelta) / totalDelta) * 100);
	}

	private async getRamInfo(): Promise<{ usedPercent: number; freeGB: string }> {
		if (os.platform() === "darwin") {
			try {
				const { stdout } = await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
					exec("/usr/bin/vm_stat", (error, stdout, stderr) => {
						if (error) reject(error);
						else resolve({ stdout, stderr });
					});
				});

				const pageSizeMatch = stdout.match(/page size of (\d+) bytes/);
				const pageSize = pageSizeMatch ? parseInt(pageSizeMatch[1], 10) : 4096;

				const parseVal = (key: string) => {
					const match = stdout.match(new RegExp(`${key}:\\s+(\\d+)`));
					return match ? parseInt(match[1], 10) : 0;
				};

				const wired = parseVal("Pages wired down");
				const compressor = parseVal("Pages occupied by compressor");
				const anonymous = parseVal("Anonymous pages");

				const usedMem = (wired + compressor + anonymous) * pageSize;
				const totalMem = os.totalmem();

				return {
					usedPercent: Math.round((usedMem / totalMem) * 100),
					freeGB: ((totalMem - usedMem) / (1024 * 1024 * 1024)).toFixed(1) + "GB",
				};
			} catch (e) {
				streamDeck.logger.error(`vm_stat parsing failed: ${e}`);
				// Fallback to systeminformation
			}
		}

		const mem = await si.mem();
		const usedMem = mem.total - mem.available;

		return {
			usedPercent: Math.round((usedMem / mem.total) * 100),
			freeGB: (mem.available / (1024 * 1024 * 1024)).toFixed(1) + "GB",
		};
	}

	// ─── Helpers ─────────────────────────────────────────

	private getInterval(settings: JsonObject): number {
		const val = settings?.updateInterval;
		if (typeof val === "number" && val > 0) return val;
		if (typeof val === "string") {
			const n = parseInt(val, 10);
			if (!isNaN(n) && n > 0) return n;
		}
		return DEFAULT_INTERVAL;
	}

	private openActivityMonitor(): void {
		const platform = os.platform();
		if (platform === "darwin") {
			exec("open -a 'Activity Monitor'");
		} else if (platform === "win32") {
			exec("taskmgr.exe");
		}
	}
}

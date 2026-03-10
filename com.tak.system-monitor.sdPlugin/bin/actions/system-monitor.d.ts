import { DialRotateEvent, DialDownEvent, TouchTapEvent, WillAppearEvent, WillDisappearEvent, SingletonAction, DidReceiveSettingsEvent, type JsonObject } from "@elgato/streamdeck";
/**
 * System Monitor action for Stream Deck+ encoder (dial).
 * Displays CPU and RAM usage on the touchscreen.
 *
 * Settings (JsonObject):
 *   updateInterval: number (seconds, default 3)
 */
export declare class SystemMonitorAction extends SingletonAction {
    /** Polling timer handle per action context */
    private timers;
    /** Current display mode per action context */
    private modes;
    /** Previous CPU snapshot for delta calculation */
    private prevCpu;
    onWillAppear(ev: WillAppearEvent<JsonObject>): Promise<void>;
    onWillDisappear(ev: WillDisappearEvent<JsonObject>): Promise<void>;
    onDialRotate(ev: DialRotateEvent<JsonObject>): Promise<void>;
    onDialDown(ev: DialDownEvent<JsonObject>): Promise<void>;
    onTouchTap(ev: TouchTapEvent<JsonObject>): Promise<void>;
    onDidReceiveSettings(ev: DidReceiveSettingsEvent<JsonObject>): Promise<void>;
    private doUpdate;
    private takeCpuSnapshot;
    private getCpuUsage;
    private getRamInfo;
    private getInterval;
    private openActivityMonitor;
}

// TypeScript wrapper for the Java plugin CinetorNative (docs/07-native-plugin.md).
import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';

export interface DlProgress { id: string; bytesDone: number; bytesTotal: number; bytesPerSec: number; status: 'queued' | 'running' | 'paused' | 'done' | 'error'; path?: string; error?: string }
export interface CinetorNativePlugin {
  setBrightness(o: { value: number | null }): Promise<void>;
  getBrightness(): Promise<{ value: number }>;
  setVolume(o: { value: number }): Promise<void>;
  getVolume(): Promise<{ value: number }>;
  openExternal(o: { url: string; mime: string; title?: string }): Promise<void>;
  deviceInfo(): Promise<{ isTv: boolean; abis: string[]; versionCode: number; versionName: string; sdk: number }>;
  pickFolder(): Promise<{ uri: string; label: string } | { cancelled: true }>;
  dlStart(o: { id: string; url: string; relPath: string; connections: 16 | 32 | 64; treeUri?: string }): Promise<void>;
  dlPause(o: { id: string }): Promise<void>;
  dlResume(o: { id: string }): Promise<void>;
  dlCancel(o: { id: string }): Promise<void>;
  dlList(): Promise<{ items: DlProgress[] }>;
  saveBytes(o: { relPath: string; base64: string; mime: string; treeUri?: string }): Promise<{ path: string }>;
  updateDownload(o: { url: string; sha256: string }): Promise<{ file: string }>;
  updateInstall(o: { file: string }): Promise<{ started: boolean; needsPermission?: boolean }>;
  keepAliveForPlayback(o: { on: boolean }): Promise<void>;
  keepScreenOn(o: { on: boolean }): Promise<void>;
  addListener(e: 'downloadProgress', fn: (p: DlProgress) => void): Promise<PluginListenerHandle>;
  addListener(e: 'updateProgress', fn: (p: { bytesDone: number; bytesTotal: number }) => void): Promise<PluginListenerHandle>;
}
export const CinetorNative = registerPlugin<CinetorNativePlugin>('CinetorNative');

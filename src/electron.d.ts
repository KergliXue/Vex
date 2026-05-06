export interface ActiveWindowInfo {
  app: string;
  title: string;
  context: string;
}

export interface ElectronAPI {
  getActiveWindow: () => Promise<ActiveWindowInfo>;
  moveWindow: (pos: { x: number; y: number; relative?: boolean }) => void;
  getScreenSize: () => Promise<{ width: number; height: number }>;
  openSettings: () => Promise<void>;
  readSoul: () => Promise<string>;
  writeLog: (content: string) => Promise<void>;
  getUserDataPath: () => Promise<string>;
  openSoulFile: () => Promise<void>;
  captureScreen: () => Promise<string | null>;
  onScreenshotAnalysis: (callback: (value?: unknown) => void) => () => void;
  setIgnoreMouseEvents: (ignore: boolean, options?: { forward?: boolean }) => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

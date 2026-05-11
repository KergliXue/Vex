export interface ActiveWindowInfo {
  app: string;
  title: string;
  context: string;
}

export interface RoleInfo {
  id: string;
  name: string;
  description: string;
  image?: string;
  avatarDataUrl?: string | null;
  folderPath: string;
  soulPath: string;
  isActive: boolean;
}

export interface ElectronAPI {
  getActiveWindow: () => Promise<ActiveWindowInfo>;
  moveWindow: (pos: { x: number; y: number; relative?: boolean }) => void;
  resizeCompanionWindow: (size: { width: number; height: number; anchor?: 'bottom-right' }) => void;
  getWindowMetrics: () => Promise<{
    bounds: { x: number; y: number; width: number; height: number };
    workArea: { x: number; y: number; width: number; height: number };
  }>;
  getScreenSize: () => Promise<{ width: number; height: number }>;
  openSettings: () => Promise<void>;
  showPetContextMenu: () => void;
  readSoul: () => Promise<string>;
  listRoles: () => Promise<RoleInfo[]>;
  setActiveRole: (roleId: string) => Promise<RoleInfo[]>;
  importRole: () => Promise<RoleInfo[]>;
  exportRole: (roleId: string) => Promise<{ exportedTo: string } | null>;
  writeLog: (content: string) => Promise<void>;
  getUserDataPath: () => Promise<string>;
  openSoulFile: () => Promise<void>;
  openRolesRoot: () => Promise<void>;
  openRoleFolder: (roleId: string) => Promise<void>;
  openRoleSoulFile: (roleId: string) => Promise<void>;
  captureScreen: () => Promise<string | null>;
  onScreenshotAnalysis: (callback: (value?: unknown) => void) => () => void;
  onRolesUpdated: (callback: (roles: RoleInfo[]) => void) => () => void;
  setIgnoreMouseEvents: (ignore: boolean, options?: { forward?: boolean }) => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

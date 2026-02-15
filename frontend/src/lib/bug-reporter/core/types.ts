// Bug Reporter Library Types — zero app imports for portability

export interface BugReporterUser {
  id: string;
  name: string;
  email: string;
}

export interface BugReporterConfig {
  onSubmit: (payload: BugReportPayload) => Promise<void>;
  user: BugReporterUser | null;
  maxConsoleLogs?: number;
  screenshotScale?: number;
  excludeSelector?: string;
}

export interface ConsoleLogEntry {
  level: 'log' | 'warn' | 'error' | 'info';
  message: string;
  timestamp: string;
}

export interface BrowserMetadata {
  browser: string;
  os: string;
  url: string;
  screenSize: { width: number; height: number };
  viewportSize: { width: number; height: number };
  userAgent: string;
  language: string;
  timestamp: string;
  touchSupport: boolean;
}

export type AnnotationTool = 'freehand' | 'rectangle' | 'arrow' | 'text';

export interface AnnotationShape {
  id: string;
  tool: AnnotationTool;
  color: string;
  strokeWidth: number;
  points?: { x: number; y: number }[];
  startX?: number;
  startY?: number;
  width?: number;
  height?: number;
  endX?: number;
  endY?: number;
  text?: string;
  fontSize?: number;
}

export interface BugReportPayload {
  title: string;
  description: string;
  stepsToReproduce: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  screenshotBase64: string | null;
  consoleLogs: ConsoleLogEntry[];
  metadata: BrowserMetadata;
  user: BugReporterUser | null;
}

export interface BugReporterContextValue {
  openReportModal: () => void;
  isCapturing: boolean;
}

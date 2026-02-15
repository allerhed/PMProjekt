// Bug Reporter Library — Public API

// Core types
export type {
  BugReporterUser,
  BugReporterConfig,
  BugReporterContextValue,
  BugReportPayload,
  ConsoleLogEntry,
  BrowserMetadata,
  AnnotationTool,
  AnnotationShape,
} from './core/types';

// Components
export { BugReporterProvider, useBugReporter } from './components/BugReporterProvider';
export { default as BugReportButton, BeetleIcon } from './components/BugReportButton';

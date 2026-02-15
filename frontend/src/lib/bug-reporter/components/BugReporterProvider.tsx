import { createContext, useContext, useRef, useEffect, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { ConsoleCapture } from '../core/consoleCapture';
import { captureScreenshot } from '../core/screenshotCapture';
import { collectMetadata } from '../core/metadataCollector';
import type { BugReporterConfig, BugReportPayload, BugReporterContextValue, ConsoleLogEntry, BrowserMetadata } from '../core/types';
import BugReportModal from './BugReportModal';

const BugReporterContext = createContext<BugReporterContextValue | null>(null);

export function useBugReporter(): BugReporterContextValue {
  const ctx = useContext(BugReporterContext);
  if (!ctx) throw new Error('useBugReporter must be used within BugReporterProvider');
  return ctx;
}

interface ProviderProps extends BugReporterConfig {
  children: ReactNode;
}

export function BugReporterProvider({
  children,
  onSubmit,
  user,
  maxConsoleLogs = 50,
  screenshotScale = 1,
  excludeSelector = '[data-bug-reporter-exclude]',
}: ProviderProps) {
  const consoleCaptureRef = useRef<ConsoleCapture | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [screenshotData, setScreenshotData] = useState<string | null>(null);
  const [consoleLogs, setConsoleLogs] = useState<ConsoleLogEntry[]>([]);
  const [metadata, setMetadata] = useState<BrowserMetadata | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  useEffect(() => {
    const capture = new ConsoleCapture(maxConsoleLogs);
    capture.start();
    consoleCaptureRef.current = capture;
    return () => {
      capture.stop();
    };
  }, [maxConsoleLogs]);

  // Keyboard shortcut: Ctrl+Shift+B
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey && e.shiftKey && e.key === 'B') {
        e.preventDefault();
        openReportModal();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openReportModal = useCallback(async () => {
    if (isCapturing || modalOpen) return;
    setIsCapturing(true);
    try {
      const screenshot = await captureScreenshot({ scale: screenshotScale, excludeSelector });
      const logs = consoleCaptureRef.current?.getLogs() || [];
      const meta = collectMetadata();
      setScreenshotData(screenshot);
      setConsoleLogs(logs);
      setMetadata(meta);
      setModalOpen(true);
    } catch (err) {
      console.error('Bug reporter: Failed to capture screenshot', err);
    } finally {
      setIsCapturing(false);
    }
  }, [isCapturing, modalOpen, screenshotScale, excludeSelector]);

  const handleSubmit = useCallback(async (report: BugReportPayload) => {
    await onSubmit(report);
    setModalOpen(false);
    setScreenshotData(null);
  }, [onSubmit]);

  const handleClose = useCallback(() => {
    setModalOpen(false);
    setScreenshotData(null);
  }, []);

  return (
    <BugReporterContext.Provider value={{ openReportModal, isCapturing }}>
      {children}
      {modalOpen && screenshotData && metadata && (
        <BugReportModal
          isOpen={modalOpen}
          onClose={handleClose}
          onSubmit={handleSubmit}
          screenshotBase64={screenshotData}
          consoleLogs={consoleLogs}
          metadata={metadata}
          user={user}
        />
      )}
    </BugReporterContext.Provider>
  );
}

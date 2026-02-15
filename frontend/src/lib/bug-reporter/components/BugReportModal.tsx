import { useState } from 'react';
import { createPortal } from 'react-dom';
import type { BugReportPayload, BugReporterUser, ConsoleLogEntry, BrowserMetadata } from '../core/types';
import AnnotationCanvas from './AnnotationCanvas';

interface BugReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (report: BugReportPayload) => Promise<void>;
  screenshotBase64: string | null;
  consoleLogs: ConsoleLogEntry[];
  metadata: BrowserMetadata;
  user: BugReporterUser | null;
}

export default function BugReportModal({
  isOpen,
  onClose,
  onSubmit,
  screenshotBase64,
  consoleLogs,
  metadata,
  user,
}: BugReportModalProps) {
  const [mode, setMode] = useState<'annotate' | 'form'>(screenshotBase64 ? 'annotate' : 'form');
  const [annotatedScreenshot, setAnnotatedScreenshot] = useState(screenshotBase64);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [stepsToReproduce, setStepsToReproduce] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showLogs, setShowLogs] = useState(false);
  const [showMeta, setShowMeta] = useState(false);

  if (!isOpen) return null;

  function handleAnnotationSave(base64: string) {
    setAnnotatedScreenshot(base64);
    setMode('form');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await onSubmit({
        title: title.trim(),
        description,
        stepsToReproduce,
        priority,
        screenshotBase64: annotatedScreenshot,
        consoleLogs,
        metadata,
        user,
      });
      onClose();
    } catch {
      setError('Failed to submit bug report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const levelColors: Record<string, string> = {
    error: 'bg-red-950/40',
    warn: 'bg-yellow-950/30',
    info: 'text-gray-300',
    log: 'text-gray-300',
  };

  const levelBadgeColors: Record<string, string> = {
    error: 'text-red-400',
    warn: 'text-yellow-400',
    info: 'text-blue-400',
    log: 'text-gray-500',
  };

  const content = mode === 'annotate' && screenshotBase64 ? (
    <AnnotationCanvas
      screenshotBase64={screenshotBase64}
      onSave={handleAnnotationSave}
      onCancel={onClose}
    />
  ) : (
    <div className="fixed inset-0 z-[10000] bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Report a Bug</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}

          {/* Screenshot preview */}
          {annotatedScreenshot ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Screenshot</label>
              <div className="relative group">
                <img
                  src={annotatedScreenshot}
                  alt="Bug screenshot"
                  className="w-full rounded-lg border border-gray-200 cursor-pointer"
                  onClick={() => setMode('annotate')}
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors rounded-lg">
                  <span className="text-white opacity-0 group-hover:opacity-100 text-sm font-medium transition-opacity">
                    Click to re-annotate
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg bg-yellow-50 p-3 text-sm text-yellow-700">
              Screenshot capture failed. You can still submit the bug report without a screenshot.
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Brief description of the issue"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What happened? What did you expect to happen?"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-y"
            />
          </div>

          {/* Steps to Reproduce */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Steps to Reproduce</label>
            <textarea
              value={stepsToReproduce}
              onChange={(e) => setStepsToReproduce(e.target.value)}
              placeholder={"1. Go to...\n2. Click on...\n3. See error..."}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-y"
            />
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as typeof priority)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>

          {/* Console Logs (collapsible) */}
          <div className="border border-gray-200 rounded-lg">
            <button
              type="button"
              onClick={() => setShowLogs(!showLogs)}
              className="flex items-center justify-between w-full px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <span>Console Logs ({consoleLogs.length})</span>
              <svg className={`w-4 h-4 transition-transform ${showLogs ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showLogs && (
              <div className="max-h-64 overflow-y-auto bg-gray-900 rounded-b-lg font-mono text-xs">
                {consoleLogs.length === 0 ? (
                  <div className="p-3 text-gray-500">No console logs captured</div>
                ) : (
                  consoleLogs.map((log, i) => (
                    <div
                      key={i}
                      className={`${levelColors[log.level]} px-3 py-1.5 ${i > 0 ? 'border-t border-gray-800' : ''}`}
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-gray-500 shrink-0">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                        <span className={`font-semibold shrink-0 ${levelBadgeColors[log.level]}`}>
                          [{log.level.toUpperCase()}]
                        </span>
                        <span className="break-all whitespace-pre-wrap min-w-0">
                          {log.message}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Metadata (collapsible) */}
          <div className="border border-gray-200 rounded-lg">
            <button
              type="button"
              onClick={() => setShowMeta(!showMeta)}
              className="flex items-center justify-between w-full px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <span>Environment Info</span>
              <svg className={`w-4 h-4 transition-transform ${showMeta ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showMeta && (
              <div className="px-3 py-2 text-xs text-gray-600 space-y-1 border-t border-gray-200">
                <div><strong>Browser:</strong> {metadata.browser}</div>
                <div><strong>OS:</strong> {metadata.os}</div>
                <div><strong>URL:</strong> {metadata.url}</div>
                <div><strong>Screen:</strong> {metadata.screenSize.width}x{metadata.screenSize.height}</div>
                <div><strong>Viewport:</strong> {metadata.viewportSize.width}x{metadata.viewportSize.height}</div>
                <div><strong>Touch:</strong> {metadata.touchSupport ? 'Yes' : 'No'}</div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {submitting && (
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              Submit Bug Report
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

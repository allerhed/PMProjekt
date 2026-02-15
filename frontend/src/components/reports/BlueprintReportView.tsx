import { useState, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import type { Annotation } from '../blueprints/PdfAnnotationViewer';
import Spinner from '../ui/Spinner';

// Configure PDF.js worker (same as PdfAnnotationViewer)
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url,
).toString();

const statusColors: Record<string, string> = {
  open: '#ef4444',
  in_progress: '#eab308',
  completed: '#22c55e',
  verified: '#3b82f6',
};

export interface TaskMarkerGroup {
  taskNumber: number;
  markers: Array<{ x: number; y: number; page: number }>;
}

interface BlueprintReportViewProps {
  blueprintName: string;
  pdfUrl: string;
  annotations: Annotation[];
  taskMarkers?: TaskMarkerGroup[];
}

interface RenderedPage {
  pageNum: number;
  dataUrl: string;
  width: number;
  height: number;
}

export default function BlueprintReportView({
  blueprintName,
  pdfUrl,
  annotations,
  taskMarkers = [],
}: BlueprintReportViewProps) {
  const [pages, setPages] = useState<RenderedPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const renderingRef = useRef(false);

  // Group annotations by page
  const annotationsByPage = new Map<number, Annotation[]>();
  for (const ann of annotations) {
    const list = annotationsByPage.get(ann.page) || [];
    list.push(ann);
    annotationsByPage.set(ann.page, list);
  }

  useEffect(() => {
    if (renderingRef.current) return;
    renderingRef.current = true;

    let cancelled = false;
    setLoading(true);
    setError(false);

    const loadingTask = pdfjsLib.getDocument(pdfUrl);
    loadingTask.promise
      .then(async (pdf) => {
        if (cancelled) return;

        const rendered: RenderedPage[] = [];

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          if (cancelled) break;

          const page = await pdf.getPage(pageNum);
          const viewport = page.getViewport({ scale: 1.5 });

          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const context = canvas.getContext('2d');
          if (!context) continue;

          await page.render({ canvasContext: context, canvas, viewport }).promise;

          rendered.push({
            pageNum,
            dataUrl: canvas.toDataURL('image/png'),
            width: viewport.width,
            height: viewport.height,
          });
        }

        if (!cancelled) {
          setPages(rendered);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('Failed to render blueprint:', err);
          setError(true);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
      renderingRef.current = false;
      loadingTask.destroy();
    };
  }, [pdfUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
        <span className="ml-3 text-sm text-gray-500">Rendering {blueprintName}...</span>
      </div>
    );
  }

  if (error || pages.length === 0) {
    return (
      <div className="text-sm text-gray-500 py-4">
        Could not render blueprint: {blueprintName}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {pages.map((page) => {
        const pageAnnotations = annotationsByPage.get(page.pageNum) || [];

        return (
          <div key={page.pageNum} className="print-avoid-break">
            <h3 className="text-sm font-medium text-gray-500 mb-2">
              {blueprintName} — Page {page.pageNum}
            </h3>
            <div
              className="relative border border-gray-200 rounded overflow-hidden"
              style={{ maxWidth: '100%' }}
            >
              <img
                src={page.dataUrl}
                alt={`${blueprintName} page ${page.pageNum}`}
                className="w-full h-auto block"
              />
              {/* Annotation overlays */}
              {pageAnnotations.map((ann) => {
                const color = statusColors[ann.status] || '#6b7280';
                return (
                  <div
                    key={ann.taskId}
                    className="absolute"
                    style={{
                      left: `${ann.x * 100}%`,
                      top: `${ann.y * 100}%`,
                      width: `${ann.width * 100}%`,
                      height: `${ann.height * 100}%`,
                      border: `2px solid ${color}`,
                      backgroundColor: `${color}20`,
                    }}
                  >
                    <span
                      className="absolute flex items-center justify-center text-white font-bold text-xs rounded-full"
                      style={{
                        backgroundColor: color,
                        width: '22px',
                        height: '22px',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        border: '2px solid white',
                        fontSize: '10px',
                      }}
                    >
                      {ann.taskNumber}
                    </span>
                  </div>
                );
              })}
              {/* Marker overlays */}
              {taskMarkers.map((group) =>
                group.markers
                  .filter((m) => m.page === page.pageNum)
                  .map((m, idx) => (
                    <div
                      key={`${group.taskNumber}-${idx}`}
                      className="absolute"
                      style={{
                        left: `${m.x * 100}%`,
                        top: `${m.y * 100}%`,
                        transform: 'translate(-50%, -50%)',
                        pointerEvents: 'none',
                      }}
                    >
                      <span
                        className="flex items-center justify-center text-white font-bold text-xs rounded-full"
                        style={{
                          backgroundColor: '#3b82f6',
                          width: '26px',
                          height: '26px',
                          border: '2px solid white',
                          fontSize: '9px',
                        }}
                      >
                        {group.taskNumber}-{idx + 1}
                      </span>
                    </div>
                  ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

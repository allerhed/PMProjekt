import { useState, useRef, useEffect, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import Button from '../ui/Button';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url,
).toString();

export interface Annotation {
  taskId: string;
  taskNumber: number;
  status: string;
  x: number; // Normalized 0-1
  y: number;
  width: number;
  height: number;
  page: number;
}

interface PdfAnnotationViewerProps {
  pdfUrl: string;
  annotations?: Annotation[];
  drawMode?: boolean;
  onAnnotationDraw?: (rect: { x: number; y: number; width: number; height: number; page: number }) => void;
  onAnnotationClick?: (taskId: string) => void;
  initialPage?: number;
}

const statusColors: Record<string, string> = {
  open: '#ef4444',
  in_progress: '#eab308',
  completed: '#22c55e',
  verified: '#3b82f6',
};

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;

export default function PdfAnnotationViewer({
  pdfUrl,
  annotations = [],
  drawMode = false,
  onAnnotationDraw,
  onAnnotationClick,
  initialPage = 1,
}: PdfAnnotationViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);

  const [currentPage, setCurrentPage] = useState(initialPage);
  const [totalPages, setTotalPages] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [loading, setLoading] = useState(true);

  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [drawCurrent, setDrawCurrent] = useState<{ x: number; y: number } | null>(null);

  // Load PDF document
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const loadingTask = pdfjsLib.getDocument(pdfUrl);
    loadingTask.promise.then((pdf) => {
      if (cancelled) return;
      pdfDocRef.current = pdf;
      setTotalPages(pdf.numPages);
      setLoading(false);
    }).catch((err) => {
      if (cancelled) return;
      console.error('Failed to load PDF:', err);
      setLoading(false);
    });

    return () => {
      cancelled = true;
      loadingTask.destroy();
    };
  }, [pdfUrl]);

  // Render current page
  useEffect(() => {
    const pdf = pdfDocRef.current;
    const canvas = canvasRef.current;
    if (!pdf || !canvas || currentPage < 1 || currentPage > totalPages) return;

    let cancelled = false;

    pdf.getPage(currentPage).then((page) => {
      if (cancelled) return;

      const viewport = page.getViewport({ scale: 1.5 });
      const context = canvas.getContext('2d');
      if (!context) return;

      canvas.width = viewport.width;
      canvas.height = viewport.height;
      setCanvasSize({ width: viewport.width, height: viewport.height });

      const renderContext = {
        canvasContext: context,
        viewport,
      };

      page.render(renderContext);
    });

    return () => { cancelled = true; };
  }, [currentPage, totalPages, pdfUrl]);

  // Reset view on page change
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [currentPage]);

  const handleZoomIn = () => setZoom((z) => Math.min(z + ZOOM_STEP, MAX_ZOOM));
  const handleZoomOut = () => setZoom((z) => Math.max(z - ZOOM_STEP, MIN_ZOOM));
  const handleZoomReset = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    setZoom((z) => Math.min(Math.max(z + delta, MIN_ZOOM), MAX_ZOOM));
  }, []);

  // Convert pointer position to normalized coordinates
  const pointerToNormalized = useCallback((clientX: number, clientY: number) => {
    const container = containerRef.current;
    if (!container || canvasSize.width === 0) return null;

    const rect = container.getBoundingClientRect();
    const x = (clientX - rect.left - pan.x) / (canvasSize.width * zoom);
    const y = (clientY - rect.top - pan.y) / (canvasSize.height * zoom);

    return { x, y };
  }, [pan, zoom, canvasSize]);

  // Pointer handlers for drawing and panning
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (drawMode && onAnnotationDraw) {
      const pos = pointerToNormalized(e.clientX, e.clientY);
      if (!pos || pos.x < 0 || pos.x > 1 || pos.y < 0 || pos.y > 1) return;
      setIsDrawing(true);
      setDrawStart(pos);
      setDrawCurrent(pos);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } else {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  }, [drawMode, onAnnotationDraw, pointerToNormalized, pan]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (isDrawing) {
      const pos = pointerToNormalized(e.clientX, e.clientY);
      if (pos) {
        setDrawCurrent({
          x: Math.max(0, Math.min(1, pos.x)),
          y: Math.max(0, Math.min(1, pos.y)),
        });
      }
    } else if (isDragging) {
      setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  }, [isDrawing, isDragging, pointerToNormalized, dragStart]);

  const handlePointerUp = useCallback(() => {
    if (isDrawing && drawStart && drawCurrent && onAnnotationDraw) {
      const x = Math.min(drawStart.x, drawCurrent.x);
      const y = Math.min(drawStart.y, drawCurrent.y);
      const width = Math.abs(drawCurrent.x - drawStart.x);
      const height = Math.abs(drawCurrent.y - drawStart.y);

      // Only save if the rectangle has meaningful size
      if (width > 0.01 && height > 0.01) {
        onAnnotationDraw({ x, y, width, height, page: currentPage });
      }

      setIsDrawing(false);
      setDrawStart(null);
      setDrawCurrent(null);
    }
    setIsDragging(false);
  }, [isDrawing, drawStart, drawCurrent, onAnnotationDraw, currentPage]);

  // Global pointer up handler
  useEffect(() => {
    function handleGlobalUp() {
      setIsDragging(false);
    }
    window.addEventListener('pointerup', handleGlobalUp);
    return () => window.removeEventListener('pointerup', handleGlobalUp);
  }, []);

  // Filter annotations for the current page
  const pageAnnotations = annotations.filter((a) => a.page === currentPage);

  // Calculate drawing rectangle for SVG
  const drawRect = isDrawing && drawStart && drawCurrent ? {
    x: Math.min(drawStart.x, drawCurrent.x),
    y: Math.min(drawStart.y, drawCurrent.y),
    width: Math.abs(drawCurrent.x - drawStart.x),
    height: Math.abs(drawCurrent.y - drawStart.y),
  } : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-100 rounded-lg border border-gray-200">
        <div className="text-gray-500">Loading PDF...</div>
      </div>
    );
  }

  if (totalPages === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-100 rounded-lg border border-gray-200">
        <div className="text-gray-500">Failed to load PDF</div>
      </div>
    );
  }

  return (
    <div className="relative border border-gray-200 rounded-lg overflow-hidden bg-gray-100">
      {/* Controls */}
      <div className="absolute top-2 right-2 z-10 flex gap-1">
        <Button variant="secondary" size="sm" onClick={handleZoomIn}>+</Button>
        <Button variant="secondary" size="sm" onClick={handleZoomOut}>-</Button>
        <Button variant="secondary" size="sm" onClick={handleZoomReset}>Reset</Button>
      </div>

      {/* Page navigation */}
      {totalPages > 1 && (
        <div className="absolute top-2 left-2 z-10 flex items-center gap-1">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
          >
            &larr;
          </Button>
          <span className="text-xs bg-white/80 px-2 py-1 rounded">
            {currentPage} / {totalPages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
          >
            &rarr;
          </Button>
        </div>
      )}

      {drawMode && (
        <div className="absolute top-12 left-2 z-10 bg-red-600 text-white text-xs px-2 py-1 rounded">
          Draw rectangle on the blueprint
        </div>
      )}

      {/* Canvas + SVG overlay container */}
      <div
        ref={containerRef}
        className="relative overflow-hidden"
        style={{
          height: '600px',
          cursor: drawMode ? 'crosshair' : isDragging ? 'grabbing' : 'grab',
          touchAction: 'none',
        }}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
            transition: isDragging || isDrawing ? 'none' : 'transform 0.1s ease-out',
            position: 'relative',
            width: canvasSize.width,
            height: canvasSize.height,
          }}
        >
          <canvas ref={canvasRef} style={{ display: 'block' }} />

          {/* SVG annotation overlay */}
          <svg
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: drawMode ? 'none' : 'auto',
            }}
            viewBox={`0 0 ${canvasSize.width} ${canvasSize.height}`}
          >
            {/* Existing annotations */}
            {pageAnnotations.map((ann) => {
              const rx = ann.x * canvasSize.width;
              const ry = ann.y * canvasSize.height;
              const rw = ann.width * canvasSize.width;
              const rh = ann.height * canvasSize.height;
              const color = statusColors[ann.status] || '#6b7280';
              const cx = rx + rw / 2;
              const cy = ry + rh / 2;
              const dotRadius = Math.min(rw, rh, 30) / 2;

              return (
                <g
                  key={ann.taskId}
                  style={{ cursor: 'pointer' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onAnnotationClick?.(ann.taskId);
                  }}
                >
                  {/* Rectangle */}
                  <rect
                    x={rx}
                    y={ry}
                    width={rw}
                    height={rh}
                    fill={color}
                    fillOpacity={0.15}
                    stroke={color}
                    strokeWidth={2}
                  />
                  {/* Dot with task number */}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={dotRadius}
                    fill={color}
                    stroke="white"
                    strokeWidth={2}
                  />
                  <text
                    x={cx}
                    y={cy}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="white"
                    fontSize={dotRadius * 1.1}
                    fontWeight="bold"
                    style={{ pointerEvents: 'none' }}
                  >
                    {ann.taskNumber}
                  </text>
                </g>
              );
            })}

            {/* Active drawing rectangle */}
            {drawRect && (
              <rect
                x={drawRect.x * canvasSize.width}
                y={drawRect.y * canvasSize.height}
                width={drawRect.width * canvasSize.width}
                height={drawRect.height * canvasSize.height}
                fill="#ef4444"
                fillOpacity={0.2}
                stroke="#ef4444"
                strokeWidth={2}
                strokeDasharray="6 3"
              />
            )}
          </svg>
        </div>
      </div>

      {/* Zoom indicator */}
      <div className="absolute bottom-2 left-2 text-xs text-gray-500 bg-white/80 px-2 py-1 rounded">
        {Math.round(zoom * 100)}%
      </div>
    </div>
  );
}

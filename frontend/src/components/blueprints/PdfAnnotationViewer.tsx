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

export interface Marker {
  id: string;
  x: number; // Normalized 0-1
  y: number;
  page: number;
  label?: string; // Optional custom label; overrides auto-generated
}

interface PdfAnnotationViewerProps {
  pdfUrl: string;
  annotations?: Annotation[];
  drawMode?: boolean;
  onAnnotationDraw?: (rect: { x: number; y: number; width: number; height: number; page: number }) => void;
  onAnnotationClick?: (taskId: string) => void;
  initialPage?: number;
  // Marker props
  markers?: Marker[];
  markerPlaceMode?: boolean;
  onMarkerPlace?: (point: { x: number; y: number; page: number }) => void;
  onMarkerMove?: (id: string, x: number, y: number) => void;
  onMarkerDelete?: (id: string) => void;
  taskNumber?: number;
}

const statusColors: Record<string, string> = {
  open: '#ef4444',
  in_progress: '#eab308',
  completed: '#22c55e',
  verified: '#3b82f6',
};

const MARKER_COLOR = '#3b82f6';
const LABEL_RADIUS = 14;
const TARGET_RADIUS = 5;
const LABEL_OFFSET_X = 22;
const LABEL_OFFSET_Y = -22;

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
  markers = [],
  markerPlaceMode = false,
  onMarkerPlace,
  onMarkerMove,
  onMarkerDelete,
  taskNumber,
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

  // Marker dragging state
  const [draggingMarkerId, setDraggingMarkerId] = useState<string | null>(null);
  const [dragMarkerPos, setDragMarkerPos] = useState<{ x: number; y: number } | null>(null);

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
        canvas,
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

  // Pointer handlers for drawing, panning, and marker placement/dragging
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (markerPlaceMode && onMarkerPlace) {
      const pos = pointerToNormalized(e.clientX, e.clientY);
      if (!pos || pos.x < 0 || pos.x > 1 || pos.y < 0 || pos.y > 1) return;
      onMarkerPlace({ x: pos.x, y: pos.y, page: currentPage });
      return;
    }
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
  }, [drawMode, markerPlaceMode, onAnnotationDraw, onMarkerPlace, pointerToNormalized, pan, currentPage]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (draggingMarkerId) {
      const pos = pointerToNormalized(e.clientX, e.clientY);
      if (pos) {
        setDragMarkerPos({
          x: Math.max(0, Math.min(1, pos.x)),
          y: Math.max(0, Math.min(1, pos.y)),
        });
      }
    } else if (isDrawing) {
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
  }, [draggingMarkerId, isDrawing, isDragging, pointerToNormalized, dragStart]);

  const handlePointerUp = useCallback(() => {
    if (draggingMarkerId && dragMarkerPos && onMarkerMove) {
      onMarkerMove(draggingMarkerId, dragMarkerPos.x, dragMarkerPos.y);
      setDraggingMarkerId(null);
      setDragMarkerPos(null);
      return;
    }
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
  }, [draggingMarkerId, dragMarkerPos, onMarkerMove, isDrawing, drawStart, drawCurrent, onAnnotationDraw, currentPage]);

  // Global pointer up handler
  useEffect(() => {
    function handleGlobalUp() {
      setIsDragging(false);
      if (draggingMarkerId) {
        setDraggingMarkerId(null);
        setDragMarkerPos(null);
      }
    }
    window.addEventListener('pointerup', handleGlobalUp);
    return () => window.removeEventListener('pointerup', handleGlobalUp);
  }, [draggingMarkerId]);

  // Filter annotations for the current page
  const pageAnnotations = annotations.filter((a) => a.page === currentPage);

  // Filter markers for the current page
  const pageMarkers = markers.filter((m) => m.page === currentPage);

  // Calculate drawing rectangle for SVG
  const drawRect = isDrawing && drawStart && drawCurrent ? {
    x: Math.min(drawStart.x, drawCurrent.x),
    y: Math.min(drawStart.y, drawCurrent.y),
    width: Math.abs(drawCurrent.x - drawStart.x),
    height: Math.abs(drawCurrent.y - drawStart.y),
  } : null;

  const isInteractive = drawMode || markerPlaceMode;

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

      {markerPlaceMode && (
        <div className="absolute top-12 left-2 z-10 bg-blue-600 text-white text-xs px-2 py-1 rounded">
          Click on the blueprint to place a marker
        </div>
      )}

      {/* Canvas + SVG overlay container */}
      <div
        ref={containerRef}
        className="relative overflow-hidden"
        style={{
          height: '600px',
          cursor: isInteractive ? 'crosshair' : isDragging ? 'grabbing' : 'grab',
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
            transition: isDragging || isDrawing || draggingMarkerId ? 'none' : 'transform 0.1s ease-out',
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
              pointerEvents: isInteractive ? 'none' : 'auto',
            }}
            viewBox={`0 0 ${canvasSize.width} ${canvasSize.height}`}
          >
            {/* Existing annotations (rectangles) */}
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

            {/* Markers */}
            {pageMarkers.map((marker, index) => {
              const isDragTarget = draggingMarkerId === marker.id;
              const mx = isDragTarget && dragMarkerPos ? dragMarkerPos.x : marker.x;
              const my = isDragTarget && dragMarkerPos ? dragMarkerPos.y : marker.y;

              const targetX = mx * canvasSize.width;
              const targetY = my * canvasSize.height;
              const labelX = targetX + LABEL_OFFSET_X;
              const labelY = targetY + LABEL_OFFSET_Y;
              const label = marker.label || (taskNumber != null ? `${taskNumber}-${index + 1}` : String(index + 1));

              return (
                <g key={marker.id}>
                  {/* Leader line from target to label */}
                  <line
                    x1={targetX}
                    y1={targetY}
                    x2={labelX}
                    y2={labelY}
                    stroke={MARKER_COLOR}
                    strokeWidth={1.5}
                    strokeOpacity={0.7}
                  />
                  {/* Target dot (draggable) */}
                  <circle
                    cx={targetX}
                    cy={targetY}
                    r={TARGET_RADIUS}
                    fill={MARKER_COLOR}
                    stroke="white"
                    strokeWidth={1.5}
                    style={{ cursor: onMarkerMove ? 'move' : 'default', pointerEvents: 'auto' }}
                    onPointerDown={(e) => {
                      if (!onMarkerMove) return;
                      e.stopPropagation();
                      e.preventDefault();
                      setDraggingMarkerId(marker.id);
                      setDragMarkerPos({ x: mx, y: my });
                      (e.target as SVGElement).setPointerCapture(e.pointerId);
                    }}
                  />
                  {/* Label circle */}
                  <circle
                    cx={labelX}
                    cy={labelY}
                    r={LABEL_RADIUS}
                    fill={MARKER_COLOR}
                    stroke="white"
                    strokeWidth={2}
                    style={{ pointerEvents: 'auto' }}
                  />
                  {/* Label text */}
                  <text
                    x={labelX}
                    y={labelY}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="white"
                    fontSize={10}
                    fontWeight="bold"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {label}
                  </text>
                  {/* Delete button (small x circle, top-right of label) */}
                  {onMarkerDelete && (
                    <g
                      style={{ cursor: 'pointer', pointerEvents: 'auto' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onMarkerDelete(marker.id);
                      }}
                    >
                      <circle
                        cx={labelX + LABEL_RADIUS * 0.7}
                        cy={labelY - LABEL_RADIUS * 0.7}
                        r={7}
                        fill="#ef4444"
                        stroke="white"
                        strokeWidth={1.5}
                      />
                      <text
                        x={labelX + LABEL_RADIUS * 0.7}
                        y={labelY - LABEL_RADIUS * 0.7}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fill="white"
                        fontSize={9}
                        fontWeight="bold"
                        style={{ pointerEvents: 'none' }}
                      >
                        x
                      </text>
                    </g>
                  )}
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

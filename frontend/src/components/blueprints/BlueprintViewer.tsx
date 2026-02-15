import { useState, useRef, useCallback, useEffect } from 'react';
import Button from '../ui/Button';
import PdfAnnotationViewer from './PdfAnnotationViewer';
import type { Annotation, Marker } from './PdfAnnotationViewer';

interface BlueprintViewerProps {
  imageUrl: string;
  mimeType?: string;
  markers?: Array<{
    id: string;
    x: number; // Normalized 0-1
    y: number; // Normalized 0-1
    status: string;
    priority: string;
    title: string;
  }>;
  annotations?: Annotation[];
  annotationMarkers?: Marker[];
  onMarkerClick?: (markerId: string) => void;
  onAnnotationClick?: (taskId: string) => void;
  onAnnotationDraw?: (rect: { x: number; y: number; width: number; height: number; page: number }) => void;
  onLocationSelect?: (x: number, y: number) => void;
  createMode?: boolean;
  drawMode?: boolean;
}

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;

const statusColors: Record<string, string> = {
  open: '#ef4444',
  in_progress: '#eab308',
  completed: '#22c55e',
  verified: '#3b82f6',
};

export default function BlueprintViewer({
  imageUrl,
  mimeType,
  markers = [],
  annotations = [],
  annotationMarkers = [],
  onMarkerClick,
  onAnnotationClick,
  onAnnotationDraw,
  onLocationSelect,
  createMode = false,
  drawMode = false,
}: BlueprintViewerProps) {
  const isPdf = mimeType === 'application/pdf' || imageUrl.toLowerCase().endsWith('.pdf');
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imgSize, setImgSize] = useState({ width: 0, height: 0 });

  const handleZoomIn = () => setZoom((z) => Math.min(z + ZOOM_STEP, MAX_ZOOM));
  const handleZoomOut = () => setZoom((z) => Math.max(z - ZOOM_STEP, MIN_ZOOM));
  const handleZoomReset = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    setZoom((z) => Math.min(Math.max(z + delta, MIN_ZOOM), MAX_ZOOM));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (createMode) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  }, [createMode, pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (!createMode || !onLocationSelect || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Convert screen coords to normalized 0-1 coords
    const normalizedX = (clickX - pan.x) / (imgSize.width * zoom);
    const normalizedY = (clickY - pan.y) / (imgSize.height * zoom);

    if (normalizedX >= 0 && normalizedX <= 1 && normalizedY >= 0 && normalizedY <= 1) {
      onLocationSelect(normalizedX, normalizedY);
    }
  }, [createMode, onLocationSelect, pan, zoom, imgSize]);

  useEffect(() => {
    function handleGlobalMouseUp() { setIsDragging(false); }
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  // PDF viewer — delegate to PdfAnnotationViewer
  if (isPdf) {
    return (
      <PdfAnnotationViewer
        pdfUrl={imageUrl}
        annotations={annotations}
        drawMode={drawMode}
        onAnnotationDraw={onAnnotationDraw}
        onAnnotationClick={onAnnotationClick}
        markers={annotationMarkers}
      />
    );
  }

  // Image viewer with zoom/pan/markers (legacy support for existing image blueprints)
  return (
    <div className="relative border border-gray-200 rounded-lg overflow-hidden bg-gray-100">
      {/* Controls */}
      <div className="absolute top-2 right-2 z-10 flex gap-1">
        <Button variant="secondary" size="sm" onClick={handleZoomIn}>+</Button>
        <Button variant="secondary" size="sm" onClick={handleZoomOut}>-</Button>
        <Button variant="secondary" size="sm" onClick={handleZoomReset}>Reset</Button>
      </div>

      {createMode && (
        <div className="absolute top-2 left-2 z-10 bg-primary-600 text-white text-xs px-2 py-1 rounded">
          Click to place task
        </div>
      )}

      {/* Image + markers container */}
      <div
        ref={containerRef}
        className="relative overflow-hidden"
        style={{ height: '500px', cursor: createMode ? 'crosshair' : isDragging ? 'grabbing' : 'grab' }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onClick={handleClick}
      >
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
            transition: isDragging ? 'none' : 'transform 0.1s ease-out',
          }}
        >
          <img
            src={imageUrl}
            alt="Blueprint"
            draggable={false}
            onLoad={(e) => {
              const img = e.currentTarget;
              setImgSize({ width: img.naturalWidth, height: img.naturalHeight });
            }}
            style={{ maxWidth: 'none' }}
          />

          {/* Markers */}
          {markers.map((marker) => (
            <div
              key={marker.id}
              className="absolute w-6 h-6 -ml-3 -mt-3 rounded-full border-2 border-white shadow-lg cursor-pointer transition-transform hover:scale-125"
              style={{
                left: `${marker.x * 100}%`,
                top: `${marker.y * 100}%`,
                backgroundColor: statusColors[marker.status] || '#6b7280',
                animation: marker.priority === 'critical' ? 'pulse 2s infinite' : undefined,
              }}
              onClick={(e) => {
                e.stopPropagation();
                onMarkerClick?.(marker.id);
              }}
              title={marker.title}
            />
          ))}
        </div>
      </div>

      {/* Zoom indicator */}
      <div className="absolute bottom-2 left-2 text-xs text-gray-500 bg-white/80 px-2 py-1 rounded">
        {Math.round(zoom * 100)}%
      </div>
    </div>
  );
}

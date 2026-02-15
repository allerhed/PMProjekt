import { useState, useRef, useEffect, useCallback } from 'react';
import type { AnnotationTool, AnnotationShape } from '../core/types';

interface AnnotationCanvasProps {
  screenshotBase64: string;
  onSave: (annotatedBase64: string) => void;
  onCancel: () => void;
}

const COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#000000'];
const TOOLS: { id: AnnotationTool; label: string; icon: string }[] = [
  { id: 'freehand', label: 'Draw', icon: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z' },
  { id: 'rectangle', label: 'Rect', icon: 'M3 3h18v18H3z' },
  { id: 'arrow', label: 'Arrow', icon: 'M17 8l4 4m0 0l-4 4m4-4H3' },
  { id: 'text', label: 'Text', icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' },
];

export default function AnnotationCanvas({ screenshotBase64, onSave, onCancel }: AnnotationCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tool, setTool] = useState<AnnotationTool>('freehand');
  const [color, setColor] = useState(COLORS[0]);
  const [shapes, setShapes] = useState<AnnotationShape[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentShape, setCurrentShape] = useState<AnnotationShape | null>(null);
  const [textInput, setTextInput] = useState<{ x: number; y: number; visible: boolean }>({ x: 0, y: 0, visible: false });
  const [textValue, setTextValue] = useState('');
  const [imgDimensions, setImgDimensions] = useState({ width: 0, height: 0 });
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Load image and set dimensions
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      const maxW = window.innerWidth - 48;
      const maxH = window.innerHeight - 160;
      const scale = Math.min(1, maxW / img.width, maxH / img.height);
      setImgDimensions({ width: Math.round(img.width * scale), height: Math.round(img.height * scale) });
    };
    img.src = screenshotBase64;
  }, [screenshotBase64]);

  // Redraw all shapes whenever shapes array changes
  const redrawShapes = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const shape of shapes) {
      drawShape(ctx, shape);
    }
    if (currentShape) {
      drawShape(ctx, currentShape);
    }
  }, [shapes, currentShape]);

  useEffect(() => {
    redrawShapes();
  }, [redrawShapes]);

  function getPos(e: React.MouseEvent | React.TouchEvent): { x: number; y: number } {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      const touch = e.touches[0] || e.changedTouches[0];
      return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function handlePointerDown(e: React.MouseEvent | React.TouchEvent) {
    if (tool === 'text') {
      const pos = getPos(e);
      setTextInput({ x: pos.x, y: pos.y, visible: true });
      setTextValue('');
      return;
    }

    setIsDrawing(true);
    const pos = getPos(e);
    const newShape: AnnotationShape = {
      id: crypto.randomUUID(),
      tool,
      color,
      strokeWidth: 3,
      ...(tool === 'freehand' ? { points: [pos] } : { startX: pos.x, startY: pos.y, width: 0, height: 0, endX: pos.x, endY: pos.y }),
    };
    setCurrentShape(newShape);
  }

  function handlePointerMove(e: React.MouseEvent | React.TouchEvent) {
    if (!isDrawing || !currentShape) return;
    e.preventDefault();
    const pos = getPos(e);

    if (tool === 'freehand') {
      setCurrentShape((prev) => prev ? { ...prev, points: [...(prev.points || []), pos] } : null);
    } else {
      setCurrentShape((prev) => prev ? {
        ...prev,
        width: pos.x - (prev.startX || 0),
        height: pos.y - (prev.startY || 0),
        endX: pos.x,
        endY: pos.y,
      } : null);
    }
  }

  function handlePointerUp() {
    if (!isDrawing || !currentShape) return;
    setIsDrawing(false);
    setShapes((prev) => [...prev, currentShape]);
    setCurrentShape(null);
  }

  function handleTextSubmit() {
    if (textValue.trim()) {
      setShapes((prev) => [...prev, {
        id: crypto.randomUUID(),
        tool: 'text',
        color,
        strokeWidth: 3,
        startX: textInput.x,
        startY: textInput.y,
        text: textValue,
        fontSize: 16,
      }]);
    }
    setTextInput({ x: 0, y: 0, visible: false });
    setTextValue('');
  }

  function handleUndo() {
    setShapes((prev) => prev.slice(0, -1));
  }

  function handleClear() {
    setShapes([]);
  }

  function handleDone() {
    const offscreen = document.createElement('canvas');
    const img = imgRef.current;
    if (!img) return;

    offscreen.width = img.width;
    offscreen.height = img.height;
    const ctx = offscreen.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(img, 0, 0);

    // Scale annotation coordinates to full image size
    const scaleX = img.width / imgDimensions.width;
    const scaleY = img.height / imgDimensions.height;
    ctx.save();
    ctx.scale(scaleX, scaleY);
    for (const shape of shapes) {
      drawShape(ctx, shape);
    }
    ctx.restore();

    onSave(offscreen.toDataURL('image/png'));
  }

  if (imgDimensions.width === 0) {
    return (
      <div className="fixed inset-0 z-[10000] bg-gray-900 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-white border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[10000] bg-gray-900 flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 bg-gray-800 border-b border-gray-700 flex-shrink-0">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTool(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              tool === t.id ? 'bg-white text-gray-900' : 'text-gray-300 hover:bg-gray-700'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d={t.icon} />
            </svg>
            {t.label}
          </button>
        ))}

        <div className="w-px h-6 bg-gray-600 mx-2" />

        {COLORS.map((c) => (
          <button
            key={c}
            onClick={() => setColor(c)}
            className={`w-6 h-6 rounded-full border-2 transition-transform ${
              color === c ? 'border-white scale-125' : 'border-gray-600'
            }`}
            style={{ backgroundColor: c }}
          />
        ))}

        <div className="w-px h-6 bg-gray-600 mx-2" />

        <button onClick={handleUndo} disabled={shapes.length === 0}
          className="px-3 py-1.5 rounded text-sm text-gray-300 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed">
          Undo
        </button>
        <button onClick={handleClear} disabled={shapes.length === 0}
          className="px-3 py-1.5 rounded text-sm text-gray-300 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed">
          Clear
        </button>

        <div className="flex-1" />

        <button onClick={onCancel} className="px-4 py-1.5 rounded text-sm text-gray-300 hover:bg-gray-700">
          Cancel
        </button>
        <button onClick={handleDone} className="px-4 py-1.5 rounded text-sm bg-blue-600 text-white hover:bg-blue-700">
          Done
        </button>
      </div>

      {/* Canvas area */}
      <div ref={containerRef} className="flex-1 flex items-center justify-center overflow-auto p-4">
        <div className="relative" style={{ width: imgDimensions.width, height: imgDimensions.height }}>
          <img
            src={screenshotBase64}
            alt="Screenshot"
            style={{ width: imgDimensions.width, height: imgDimensions.height }}
            className="block select-none pointer-events-none"
            draggable={false}
          />
          <canvas
            ref={canvasRef}
            width={imgDimensions.width}
            height={imgDimensions.height}
            className="absolute inset-0 cursor-crosshair"
            onMouseDown={handlePointerDown}
            onMouseMove={handlePointerMove}
            onMouseUp={handlePointerUp}
            onMouseLeave={handlePointerUp}
            onTouchStart={handlePointerDown}
            onTouchMove={handlePointerMove}
            onTouchEnd={handlePointerUp}
          />
          {textInput.visible && (
            <input
              autoFocus
              type="text"
              value={textValue}
              onChange={(e) => setTextValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleTextSubmit(); if (e.key === 'Escape') setTextInput({ x: 0, y: 0, visible: false }); }}
              onBlur={handleTextSubmit}
              className="absolute bg-transparent border-b-2 text-base outline-none"
              style={{ left: textInput.x, top: textInput.y - 10, color, borderColor: color, minWidth: 100 }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function drawShape(ctx: CanvasRenderingContext2D, shape: AnnotationShape): void {
  ctx.strokeStyle = shape.color;
  ctx.fillStyle = shape.color;
  ctx.lineWidth = shape.strokeWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  switch (shape.tool) {
    case 'freehand': {
      const pts = shape.points || [];
      if (pts.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x, pts[i].y);
      }
      ctx.stroke();
      break;
    }
    case 'rectangle': {
      ctx.strokeRect(shape.startX || 0, shape.startY || 0, shape.width || 0, shape.height || 0);
      break;
    }
    case 'arrow': {
      const sx = shape.startX || 0;
      const sy = shape.startY || 0;
      const ex = shape.endX || 0;
      const ey = shape.endY || 0;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      // Arrowhead
      const angle = Math.atan2(ey - sy, ex - sx);
      const headLen = 15;
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex - headLen * Math.cos(angle - Math.PI / 6), ey - headLen * Math.sin(angle - Math.PI / 6));
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex - headLen * Math.cos(angle + Math.PI / 6), ey - headLen * Math.sin(angle + Math.PI / 6));
      ctx.stroke();
      break;
    }
    case 'text': {
      ctx.font = `${shape.fontSize || 16}px sans-serif`;
      ctx.fillText(shape.text || '', shape.startX || 0, shape.startY || 0);
      break;
    }
  }
}

import React, {
  useRef,
  useEffect,
  useState,
  useImperativeHandle,
  forwardRef,
  useCallback,
} from 'react';
import { RotateCcw, Trash2, Pen } from 'lucide-react';

export interface DrawingCanvasHandle {
  getImageDataUrl: () => string;
  clear: () => void;
  undo: () => void;
  hasStrokes: () => boolean;
}

interface Point {
  x: number;
  y: number;
}

interface Stroke {
  points: Point[];
  color: string;
  width: number;
}

interface DrawingCanvasProps {
  height?: number;
  onStrokeEnd?: () => void;
  className?: string;
  placeholder?: string;
}

export const DrawingCanvas = forwardRef<DrawingCanvasHandle, DrawingCanvasProps>(
  ({ height = 240, onStrokeEnd, className = '', placeholder = 'Draw handwriting here...' }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);

    const [strokes, setStrokes] = useState<Stroke[]>([]);
    const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [penWidth, setPenWidth] = useState<number>(8); // Default medium bold for handwriting recognition

    // Redraw entire canvas from strokes array
    const redraw = useCallback(
      (allStrokes: Stroke[], inProgress?: Stroke | null) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Reset canvas to solid white background
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw guideline dotted center line for handwriting guidance
        ctx.save();
        ctx.strokeStyle = '#F1F0EC';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 6]);
        ctx.beginPath();
        ctx.moveTo(0, canvas.height * 0.65);
        ctx.lineTo(canvas.width, canvas.height * 0.65);
        ctx.stroke();
        ctx.restore();

        const renderStroke = (stroke: Stroke) => {
          if (stroke.points.length === 0) return;
          ctx.beginPath();
          ctx.strokeStyle = stroke.color;
          ctx.lineWidth = stroke.width;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';

          if (stroke.points.length === 1) {
            const p = stroke.points[0];
            ctx.arc(p.x, p.y, stroke.width / 2, 0, Math.PI * 2);
            ctx.fillStyle = stroke.color;
            ctx.fill();
            return;
          }

          ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
          for (let i = 1; i < stroke.points.length; i++) {
            const p1 = stroke.points[i - 1];
            const p2 = stroke.points[i];
            const midX = (p1.x + p2.x) / 2;
            const midY = (p1.y + p2.y) / 2;
            ctx.quadraticCurveTo(p1.x, p1.y, midX, midY);
          }
          const last = stroke.points[stroke.points.length - 1];
          ctx.lineTo(last.x, last.y);
          ctx.stroke();
        };

        allStrokes.forEach(renderStroke);
        if (inProgress) {
          renderStroke(inProgress);
        }
      },
      []
    );

    // Resize canvas to fill container with 1:1 pixel coordinates
    useEffect(() => {
      const handleResize = () => {
        const container = containerRef.current;
        const canvas = canvasRef.current;
        if (!container || !canvas) return;

        const rect = container.getBoundingClientRect();
        const width = Math.floor(rect.width);

        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
          redraw(strokes, currentStroke);
        }
      };

      handleResize();
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }, [height, strokes, currentStroke, redraw]);

    // Imperative API
    useImperativeHandle(ref, () => ({
      getImageDataUrl: () => {
        const canvas = canvasRef.current;
        if (!canvas) return '';
        return canvas.toDataURL('image/png');
      },
      clear: () => {
        setStrokes([]);
        setCurrentStroke(null);
        redraw([]);
      },
      undo: () => {
        setStrokes((prev) => {
          const next = prev.slice(0, prev.length - 1);
          redraw(next);
          return next;
        });
      },
      hasStrokes: () => strokes.length > 0,
    }));

    // Convert pointer event coordinate to canvas local coordinate
    const getCoordinates = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    };

    // Pointer event handlers with touch capture
    const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      // Capture pointer so drawing continues even if finger moves slightly outside bounds
      e.currentTarget.setPointerCapture(e.pointerId);

      const pt = getCoordinates(e);
      const newStroke: Stroke = {
        points: [pt],
        color: '#111827', // Crisp dark ink
        width: penWidth,
      };

      setIsDrawing(true);
      setCurrentStroke(newStroke);
      redraw(strokes, newStroke);
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isDrawing || !currentStroke) return;
      e.preventDefault();

      const pt = getCoordinates(e);
      const updatedStroke: Stroke = {
        ...currentStroke,
        points: [...currentStroke.points, pt],
      };

      setCurrentStroke(updatedStroke);
      redraw(strokes, updatedStroke);
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isDrawing || !currentStroke) return;
      e.preventDefault();
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Ignore if pointer capture was already lost
      }

      const finalizedStrokes = [...strokes, currentStroke];
      setStrokes(finalizedStrokes);
      setCurrentStroke(null);
      setIsDrawing(false);
      redraw(finalizedStrokes);

      if (onStrokeEnd) {
        onStrokeEnd();
      }
    };

    const handleClear = () => {
      setStrokes([]);
      setCurrentStroke(null);
      redraw([]);
    };

    const handleUndo = () => {
      setStrokes((prev) => {
        const next = prev.slice(0, prev.length - 1);
        redraw(next);
        return next;
      });
    };

    return (
      <div className={`relative flex flex-col ${className}`} ref={containerRef}>
        {/* Canvas Toolbar */}
        <div className="flex items-center justify-between pb-2 text-xs text-stone-600">
          {/* Pen thickness selection */}
          <div className="flex items-center gap-1.5 bg-stone-100 p-1 rounded-lg border border-stone-200">
            <span className="text-[11px] font-medium text-stone-500 px-1.5 flex items-center gap-1">
              <Pen className="w-3 h-3" /> Pen:
            </span>
            {[
              { label: 'Fine', width: 4 },
              { label: 'Medium', width: 8 },
              { label: 'Bold', width: 12 },
            ].map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => setPenWidth(p.width)}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  penWidth === p.width
                    ? 'bg-white text-navy-900 shadow-xs border border-stone-200 font-semibold'
                    : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Action buttons (Undo & Clear) */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleUndo}
              disabled={strokes.length === 0}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-white border border-stone-200 text-stone-700 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Undo last stroke"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Undo</span>
            </button>
            <button
              type="button"
              onClick={handleClear}
              disabled={strokes.length === 0}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-white border border-stone-200 text-rose-600 hover:bg-rose-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Clear entire canvas"
            >
              <Trash2 className="w-3 h-3" />
              <span>Clear</span>
            </button>
          </div>
        </div>

        {/* Canvas Area */}
        <div className="relative w-full rounded-xl border border-stone-300 bg-white shadow-xs overflow-hidden">
          <canvas
            ref={canvasRef}
            className="drawing-canvas w-full block cursor-crosshair"
            style={{ height: `${height}px` }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          />

          {/* Empty state hint */}
          {strokes.length === 0 && !isDrawing && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <p className="text-xs text-stone-400 font-medium tracking-wide">
                {placeholder}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }
);

DrawingCanvas.displayName = 'DrawingCanvas';


'use client';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { format, eachDayOfInterval, startOfMonth, endOfMonth, isSameDay } from 'date-fns';

interface DiaryData {
  date: string;
  count?: number;
  mood_emoji?: string;
}

interface StrokeData {
  id: string;
  paths: {
    x: number;
    y: number;
    pressure?: number;
  }[];
  color: string;
  thickness: number;
  timestamp: number;
}

interface CalendarStroke {
  id: number;
  date: string;
  stroke_data: {
    strokes: StrokeData[];
  };
}

interface InteractiveCalendarProps {
  year: number;
  month: number;
  onDateClick?: (date: string) => void;
}

export default function InteractiveCalendar({ 
  year, 
  month, 
  onDateClick 
}: InteractiveCalendarProps) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingTool, setDrawingTool] = useState<'pen' | 'eraser'>('pen');
  const [strokeColor, setStrokeColor] = useState('#3b82f6');
  const [strokeThickness, setStrokeThickness] = useState(3);
  const [currentStroke, setCurrentStroke] = useState<StrokeData | null>(null);
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('month');

  // Fetch diary data
  const ym = `${year}-${String(month).padStart(2, '0')}`;
  const fetcher = (url: string): Promise<DiaryData[]> =>
    fetch(url).then((r) => r.json());

  const { data: diaryData } = useSWR<DiaryData[]>(`/api/diaries?month=${ym}`, fetcher);

  // Fetch stroke data
  const { data: strokeData, mutate: mutateStrokes } = useSWR<CalendarStroke[]>(
    `/api/calendar/strokes?month=${ym}`, 
    fetcher
  );

  const monthStart = startOfMonth(new Date(year, month - 1));
  const monthEnd = endOfMonth(new Date(year, month - 1));
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Canvas drawing functions
  const startDrawing = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!selectedDate) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const newStroke: StrokeData = {
      id: Date.now().toString(),
      paths: [{ x, y }],
      color: drawingTool === 'eraser' ? 'transparent' : strokeColor,
      thickness: strokeThickness,
      timestamp: Date.now()
    };

    setCurrentStroke(newStroke);
    setIsDrawing(true);
  }, [selectedDate, drawingTool, strokeColor, strokeThickness]);

  const draw = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !currentStroke) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const updatedStroke = {
      ...currentStroke,
      paths: [...currentStroke.paths, { x, y }]
    };

    setCurrentStroke(updatedStroke);
    drawStroke(updatedStroke);
  }, [isDrawing, currentStroke]);

  const stopDrawing = useCallback(async () => {
    if (!isDrawing || !currentStroke || !selectedDate) return;

    setIsDrawing(false);
    
    // Save stroke to database
    try {
      const response = await fetch('/api/calendar/strokes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate,
          stroke_data: { strokes: [currentStroke] }
        })
      });

      if (response.ok) {
        mutateStrokes();
      }
    } catch (error) {
      console.error('Failed to save stroke:', error);
    }

    setCurrentStroke(null);
  }, [isDrawing, currentStroke, selectedDate, mutateStrokes]);

  const drawStroke = useCallback((stroke: StrokeData) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.beginPath();
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.thickness;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (stroke.color === 'transparent') {
      ctx.globalCompositeOperation = 'destination-out';
    } else {
      ctx.globalCompositeOperation = 'source-over';
    }

    stroke.paths.forEach((point, index) => {
      if (index === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        ctx.lineTo(point.x, point.y);
      }
    });

    ctx.stroke();
  }, []);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  const handleDateSelect = useCallback((date: string) => {
    setSelectedDate(date);
    clearCanvas();
    
    // Load existing strokes for this date
    const dateStrokes = strokeData?.find(s => s.date === date);
    if (dateStrokes?.stroke_data?.strokes) {
      dateStrokes.stroke_data.strokes.forEach(drawStroke);
    }

    if (onDateClick) {
      onDateClick(date);
    }
  }, [strokeData, clearCanvas, drawStroke, onDateClick]);

  const handleDiaryReplay = useCallback((date: string) => {
    router.push(`/diary/${date}?replay=true`);
  }, [router]);

  // Grid layout based on view mode
  const renderCalendarGrid = () => {
    const gridColsClass = viewMode === 'month' ? 'grid-cols-7' : viewMode === 'week' ? 'grid-cols-7' : 'grid-cols-1';
    
    return (
      <div className={`grid ${gridColsClass} gap-2 mb-4`}>
        {days.map((day) => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const dayData = diaryData?.find(d => d.date === dateStr);
          const hasEntry = !!dayData;
          const isSelected = selectedDate === dateStr;
          
          return (
            <div
              key={dateStr}
              className={`
                relative h-20 border-2 rounded-lg cursor-pointer transition-all
                ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}
                ${hasEntry ? 'bg-green-50' : 'bg-white'}
              `}
              onClick={() => handleDateSelect(dateStr)}
            >
              <div className="p-2">
                <div className="text-sm font-medium">{format(day, 'd')}</div>
                {dayData?.mood_emoji && (
                  <div className="text-lg">{dayData.mood_emoji}</div>
                )}
                {hasEntry && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDiaryReplay(dateStr);
                    }}
                    className="absolute bottom-1 right-1 w-6 h-6 bg-blue-500 hover:bg-blue-600 text-white rounded-full text-xs flex items-center justify-center"
                    title="Replay conversation"
                  >
                    ▶
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div ref={containerRef} className="space-y-4">
      {/* View Mode Selector */}
      <div className="flex space-x-2 mb-4">
        {(['month', 'week', 'day'] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={`
              px-4 py-2 rounded-lg capitalize transition-colors
              ${viewMode === mode 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }
            `}
          >
            {mode}
          </button>
        ))}
      </div>

      {/* Calendar Grid */}
      {renderCalendarGrid()}

      {/* Drawing Tools */}
      {selectedDate && (
        <div className="border rounded-lg p-4 bg-white">
          <h3 className="text-lg font-semibold mb-3">
            Draw on {format(new Date(selectedDate), 'MMM d, yyyy')}
          </h3>
          
          {/* Tool Controls */}
          <div className="flex items-center space-x-4 mb-4">
            <div className="flex space-x-2">
              <button
                onClick={() => setDrawingTool('pen')}
                className={`
                  px-3 py-1 rounded transition-colors
                  ${drawingTool === 'pen' ? 'bg-blue-500 text-white' : 'bg-gray-200'}
                `}
              >
                Pen
              </button>
              <button
                onClick={() => setDrawingTool('eraser')}
                className={`
                  px-3 py-1 rounded transition-colors
                  ${drawingTool === 'eraser' ? 'bg-blue-500 text-white' : 'bg-gray-200'}
                `}
              >
                Eraser
              </button>
            </div>

            <div className="flex items-center space-x-2">
              <label className="text-sm">Color:</label>
              <input
                type="color"
                value={strokeColor}
                onChange={(e) => setStrokeColor(e.target.value)}
                className="w-8 h-8 rounded border"
              />
            </div>

            <div className="flex items-center space-x-2">
              <label className="text-sm">Thickness:</label>
              <input
                type="range"
                min="1"
                max="10"
                value={strokeThickness}
                onChange={(e) => setStrokeThickness(Number(e.target.value))}
                className="w-20"
              />
              <span className="text-sm">{strokeThickness}px</span>
            </div>

            <button
              onClick={clearCanvas}
              className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
            >
              Clear
            </button>
          </div>

          {/* Drawing Canvas */}
          <canvas
            ref={canvasRef}
            width={600}
            height={400}
            className="border border-gray-300 rounded cursor-crosshair bg-white"
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
          />
        </div>
      )}
    </div>
  );
}
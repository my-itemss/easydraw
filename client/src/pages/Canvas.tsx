import React, { useRef, useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

const Canvas = () => {
  const { id } = useParams<{ id: string }>(); 
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [mode, setMode] = useState<'pen' | 'eraser'>('pen');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.lineCap = 'round';
      ctx.lineWidth = 5;
      ctx.strokeStyle = '#000000';
    }
  }, []);

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    if ('touches' in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.globalCompositeOperation = mode === 'pen' ? 'source-over' : 'destination-out';
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      const { x, y } = getCoordinates(e);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  };

  const download = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `whiteboard-${id}.png`;
    link.href = canvas.toDataURL();
    link.click();
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-white">
      <div className="absolute top-4 left-1/2 -translate-x-1/2 flex gap-2 bg-gray-800 p-2 rounded-xl shadow-2xl z-10">
        <button 
          onClick={() => setMode('pen')}
          className={`px-4 py-2 rounded-lg transition ${mode === 'pen' ? 'bg-blue-500 text-white' : 'text-gray-300 hover:bg-gray-700'}`}
        >
          Pen
        </button>
        <button 
          onClick={() => setMode('eraser')}
          className={`px-4 py-2 rounded-lg transition ${mode === 'eraser' ? 'bg-red-500 text-white' : 'text-gray-300 hover:bg-gray-700'}`}
        >
          Eraser
        </button>
        <div className="w-px h-8 bg-gray-600 mx-1" />
        <button 
          onClick={download}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
        >
          Download
        </button>
      </div>

      <div className="absolute bottom-4 right-4 text-gray-400 text-xs font-mono">
        Room ID: {id}
      </div>

      <canvas
        ref={canvasRef}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={() => setIsDrawing(false)}
        onMouseLeave={() => setIsDrawing(false)}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={() => setIsDrawing(false)}
        className="cursor-crosshair touch-none"
      />
    </div>
  );
};

export default Canvas;

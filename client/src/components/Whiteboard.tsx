import React, { useRef, useState, useEffect } from 'react';

const Whiteboard = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [mode, setMode] = useState<'pen' | 'eraser'>('pen');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.lineCap = 'round';
      ctx.lineWidth = 5;
    }
  }, []);

  const startDrawing = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    // Use 'source-over' for pen and 'destination-out' for eraser
    ctx.globalCompositeOperation = mode === 'pen' ? 'source-over' : 'destination-out';
    ctx.beginPath();
    ctx.moveTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent) => {
    if (!isDrawing) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.lineTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
      ctx.stroke();
    }
  };

  const downloadImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = 'whiteboard-drawing.png';
    link.href = canvas.toDataURL('image/png'); // Converts canvas to base64 data
    link.click();
  };

  return (
    <div className="flex flex-col items-center h-screen bg-gray-100 p-4">
      {/* Toolbar with Tailwind styling */}
      <div className="mb-4 flex space-x-2 bg-white p-2 rounded shadow-md">
        <button onClick={() => setMode('pen')} className={`px-4 py-2 rounded ${mode === 'pen' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}>Pen</button>
        <button onClick={() => setMode('eraser')} className={`px-4 py-2 rounded ${mode === 'eraser' ? 'bg-red-500 text-white' : 'bg-gray-200'}`}>Eraser</button>
        <button onClick={downloadImage} className="bg-green-600 text-white px-4 py-2 rounded">Download</button>
      </div>
      
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={() => setIsDrawing(false)}
        className="border border-gray-300 bg-white cursor-crosshair shadow-lg"
      />
    </div>
  );
};

export default Whiteboard;

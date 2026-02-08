import React, { useRef, useState, useEffect } from "react";

type Mode = "pen" | "eraser";

const Canvas = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  const [mode, setMode] = useState<Mode>("pen");
  const [isDrawing, setIsDrawing] = useState(false);

  const [penColor, setPenColor] = useState("#000000");
  const [penSize, setPenSize] = useState(4);
  const [eraserSize, setEraserSize] = useState(24);

  const [canvasSize, setCanvasSize] = useState({
    width: window.innerWidth * 2,
    height: window.innerHeight * 2,
  });

  const [showEditor, setShowEditor] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current!;
    canvas.width = canvasSize.width;
    canvas.height = canvasSize.height;

    const ctx = canvas.getContext("2d")!;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctxRef.current = ctx;
  }, [canvasSize]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "e") {
        e.preventDefault();
        setShowEditor(v => !v);
      }

      if (e.ctrlKey && e.key === "+") {
        setCanvasSize(s => ({
          width: s.width + 400,
          height: s.height + 400,
        }));
      }

      if (e.ctrlKey && e.key === "-") {
        setCanvasSize(s => ({
          width: Math.max(2000, s.width - 400),
          height: Math.max(2000, s.height - 400),
        }));
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const getPos = (e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const startDrawing = (e: React.MouseEvent) => {
    const ctx = ctxRef.current!;
    const { x, y } = getPos(e);

    ctx.beginPath();
    ctx.moveTo(x, y);

    ctx.globalCompositeOperation =
      mode === "pen" ? "source-over" : "destination-out";

    ctx.strokeStyle = penColor;
    ctx.lineWidth = mode === "pen" ? penSize : eraserSize;

    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent) => {
    if (!isDrawing) return;
    const ctx = ctxRef.current!;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    ctxRef.current?.closePath();
  };

  const share = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      alert("Link copied to clipboard");
    } catch {
      prompt("Copy link:", url);
    }
  };

  const download = () => {
    const link = document.createElement("a");
    link.download = "canvas.png";
    link.href = canvasRef.current!.toDataURL("image/png");
    link.click();
  };

  return (
    <div className="fixed inset-0 bg-gray-100 overflow-hidden">

      {/* SHARE */}
      <button
        onClick={share}
        className="fixed top-4 right-4 z-30 bg-indigo-600 text-white px-4 py-2 rounded-lg shadow"
      >
        Share
      </button>

      {/* TOOL SETTINGS */}
      {showEditor && (
        <div className="fixed left-4 top-1/2 -translate-y-1/2 z-30 bg-white p-4 rounded-xl shadow w-56">
          {mode === "pen" && (
            <>
              <p className="font-semibold mb-2">Pen</p>
              <input
                type="color"
                value={penColor}
                onChange={e => setPenColor(e.target.value)}
                className="w-full mb-2"
              />
              <input
                type="range"
                min={1}
                max={20}
                value={penSize}
                onChange={e => setPenSize(+e.target.value)}
                className="w-full"
              />
            </>
          )}

          {mode === "eraser" && (
            <>
              <p className="font-semibold mb-2">Eraser</p>
              <input
                type="range"
                min={10}
                max={60}
                value={eraserSize}
                onChange={e => setEraserSize(+e.target.value)}
                className="w-full"
              />
            </>
          )}
        </div>
      )}

     <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-20
                flex gap-2 bg-gray-900 px-1 py-1 
                rounded-xl shadow-xl">

  {/* PEN */}
  <button
    onClick={() => setMode("pen")}
    className="p-2 rounded-xl hover:bg-gray-600 transition"
  >
    <img
      src={mode === "pen" ? "/images/pen.png" : "/images/pens.png"}
      className="w-10 h-10"
      alt="Pen"
    />
  </button>

  <button
    onClick={() => setMode("eraser")}
    className="p-2 rounded-xl hover:bg-gray-700 transition"
  >
    <img
      src={mode === "eraser" ? "/images/cross.png" : "/images/eraser.png"}
      className="w-10 h-10"
      alt="Eraser"
    />
  </button>

  <button
    onClick={download}
    className="p-2 rounded-xl hover:bg-gray-700 transition"
  >
    <img
      src="/images/download.png"
      className="w-10 h-10"
      alt="Download"
    />
  </button>

</div>


      <canvas
        ref={canvasRef}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        className="absolute top-0 left-0 bg-white"
        style={{
          cursor:
            mode === "pen"
              ? 'url("/pen-cursor.png") 8 8, auto'
              : 'url("/eraser-cursor.png") 8 8, auto',
        }}
      />
    </div>
  );
};

export default Canvas;

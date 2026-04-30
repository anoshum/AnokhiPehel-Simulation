import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Zap, Maximize, MousePointer2, Info, Eye, EyeOff, 
  Sun, Moon, PanelLeftClose, PanelLeftOpen, 
  ChevronRight, ChevronLeft, Maximize2, RefreshCw
} from 'lucide-react';

const App = () => {
  const [windowSize, setWindowSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1200,
    height: typeof window !== 'undefined' ? window.innerHeight : 800
  });

  useEffect(() => {
    const handleResize = () => setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = windowSize.width < 768;
  const BASE_PX_PER_CM = isMobile ? 3.5 : 6; 

  // --- State ---
  const [theme, setTheme] = useState('dark'); 
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
  const [lensType, setLensType] = useState('convex'); // 'convex' (converging) or 'concave' (diverging)
  const [u_cm, setU] = useState(60); 
  const [f_cm, setF] = useState(30); 
  const [objHeight_cm, setObjHeight] = useState(15);
  const [zoom, setZoom] = useState(1.0);
  
  // Interaction State
  const [isDraggingObject, setIsDraggingObject] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  
  // Interaction Tracking
  const lastTouchPos = useRef({ x: 0, y: 0 });
  const lastPinchDist = useRef(0);
  const activePointers = useRef(new Map()); 
  
  const [visibleRays, setVisibleRays] = useState({
    parallel: true,
    optical: true,
    focal: false,
  });
  
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  // --- Theme Colors ---
  const colors = useMemo(() => ({
    bg: theme === 'dark' ? '#020617' : '#f8fafc',
    grid: theme === 'dark' ? '#0f172a' : '#e2e8f0',
    axis: theme === 'dark' ? '#1e293b' : '#cbd5e1',
    text: theme === 'dark' ? '#f1f5f9' : '#0f172a',
    lensBody: theme === 'dark' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.15)',
    lensStroke: theme === 'dark' ? '#94a3b8' : '#64748b',
  }), [theme]);

  const pxPerCm = useMemo(() => BASE_PX_PER_CM * zoom, [zoom, BASE_PX_PER_CM]);

  // --- Physics Logic ---
  // Lens Formula: 1/v - 1/u = 1/f  => v = (u * f) / (u + f)
  // Sign Convention: u is always negative (left of lens), f is positive for convex, negative for concave.
  const physics = useMemo(() => {
    const signedU = -u_cm;
    const signedF = lensType === 'convex' ? f_cm : -f_cm;
    
    // Check if u is exactly at f to avoid division by zero
    const v = (signedU * signedF) / (signedU + signedF);
    const m = v / signedU;
    const imgHeight = objHeight_cm * m;

    let nature = "";
    if (Math.abs(u_cm - f_cm) < 0.5 && lensType === 'convex') {
      nature = "At Infinity (Parallel Rays)";
    } else if (v > 0) {
      nature = `Real & Inverted | ${Math.abs(m).toFixed(1)}x`;
    } else {
      nature = `Virtual & Erect | ${Math.abs(m).toFixed(1)}x`;
    }

    return { v, m, h_i: imgHeight, nature, f: signedF, u: signedU };
  }, [u_cm, f_cm, lensType, objHeight_cm]);

  const getCenters = (width, height) => {
    const baseOffset = (sidebarOpen && !isMobile) ? 140 : 0;
    const defaultCenterX = isMobile ? width * 0.5 : width / 2 + baseOffset; 
    const defaultCenterY = height / 2;
    return { 
      centerX: defaultCenterX + panOffset.x, 
      centerY: defaultCenterY + panOffset.y 
    };
  };

  const handlePointerDown = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pointers = Array.from(activePointers.current.values());

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const { centerX, centerY } = getCenters(rect.width, rect.height);
    const objX = centerX - (u_cm * pxPerCm);
    const objY = centerY - (objHeight_cm * pxPerCm);

    if (pointers.length === 1) {
      const distToTip = Math.sqrt(Math.pow(x - objX, 2) + Math.pow(y - objY, 2));
      const nearBase = Math.abs(x - objX) < 45 && y < centerY + 30 && y > objY - 30;

      if (distToTip < 60 || nearBase) {
        setIsDraggingObject(true);
      } else {
        setIsPanning(true);
      }
      lastTouchPos.current = { x: e.clientX, y: e.clientY };
    } else if (pointers.length === 2) {
      const dist = Math.sqrt(Math.pow(pointers[0].x - pointers[1].x, 2) + Math.pow(pointers[0].y - pointers[1].y, 2));
      lastPinchDist.current = dist;
      setIsDraggingObject(false);
      setIsPanning(true);
    }
    canvas.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!activePointers.current.has(e.pointerId)) return;
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pointers = Array.from(activePointers.current.values());

    if (isDraggingObject && pointers.length === 1) {
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const { centerX } = getCenters(rect.width, rect.height);
      const x = e.clientX - rect.left;
      const newU = (centerX - x) / pxPerCm;
      if (newU > 0.05) setU(Number(Math.min(newU, 500).toFixed(1)));
    } else if (isPanning) {
      if (pointers.length === 1) {
        const dx = e.clientX - lastTouchPos.current.x;
        const dy = e.clientY - lastTouchPos.current.y;
        setPanOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
        lastTouchPos.current = { x: e.clientX, y: e.clientY };
      } else if (pointers.length === 2) {
        const dist = Math.sqrt(Math.pow(pointers[0].x - pointers[1].x, 2) + Math.pow(pointers[0].y - pointers[1].y, 2));
        if (lastPinchDist.current > 0) {
          const ratio = dist / lastPinchDist.current;
          setZoom(prev => Math.min(Math.max(prev * ratio, 0.05), 10.0));
        }
        lastPinchDist.current = dist;
      }
    }
  };

  const handlePointerUp = (e) => {
    activePointers.current.delete(e.pointerId);
    if (activePointers.current.size < 2) lastPinchDist.current = 0;
    if (activePointers.current.size === 0) {
      setIsDraggingObject(false);
      setIsPanning(false);
    }
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prev => Math.min(Math.max(prev * delta, 0.05), 10.0));
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const { width, height } = rect;
    const { centerX, centerY } = getCenters(width, height);
    const toPx = (cm) => cm * pxPerCm;
    const { v, h_i, f, u } = physics;

    ctx.clearRect(0, 0, width, height);

    // --- Grid ---
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 1;
    const gridStep = 50 * zoom;
    const startX = (panOffset.x % gridStep);
    const startY = (panOffset.y % gridStep);
    for (let i = startX; i < width; i += gridStep) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, height); ctx.stroke();
    }
    for (let j = startY; j < height; j += gridStep) {
      ctx.beginPath(); ctx.moveTo(0, j); ctx.lineTo(width, j); ctx.stroke();
    }

    // --- Principal Axis ---
    ctx.strokeStyle = colors.axis;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, centerY); ctx.lineTo(width, centerY); ctx.stroke();

    // --- Draw Lens Shape ---
    const lensHeight = 160 * zoom;
    const lensWidth = 30 * zoom;
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.strokeStyle = colors.lensStroke;
    ctx.fillStyle = colors.lensBody;
    ctx.lineWidth = 2.5;

    if (lensType === 'convex') {
      ctx.beginPath();
      ctx.moveTo(0, -lensHeight);
      ctx.quadraticCurveTo(lensWidth, 0, 0, lensHeight);
      ctx.quadraticCurveTo(-lensWidth, 0, 0, -lensHeight);
      ctx.fill(); ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(-lensWidth/2, -lensHeight);
      ctx.lineTo(lensWidth/2, -lensHeight);
      ctx.quadraticCurveTo(0, 0, lensWidth/2, lensHeight);
      ctx.lineTo(-lensWidth/2, lensHeight);
      ctx.quadraticCurveTo(0, 0, -lensWidth/2, -lensHeight);
      ctx.fill(); ctx.stroke();
    }
    ctx.restore();

    // --- Points F1, F2, O ---
    const drawPoint = (x, label, color) => {
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, centerY, 4, 0, Math.PI * 2); ctx.fill();
      ctx.font = 'bold 11px Inter';
      ctx.fillStyle = colors.text;
      ctx.fillText(label, x - 5, centerY + 22);
    };

    drawPoint(centerX, 'O', '#64748b');
    drawPoint(centerX - toPx(f_cm), 'F₁', '#fbbf24');
    drawPoint(centerX + toPx(f_cm), 'F₂', '#fbbf24');
    drawPoint(centerX - toPx(2 * f_cm), '2F₁', '#f97316');
    drawPoint(centerX + toPx(2 * f_cm), '2F₂', '#f97316');

    // --- Object ---
    const objX = centerX + toPx(u);
    const objY = centerY - toPx(objHeight_cm);
    drawArrow(ctx, objX, centerY, objX, objY, '#ef4444', 'Object', isDraggingObject);

    // --- Image & Rays ---
    if (Math.abs(u_cm - f_cm) > 0.5 || lensType === 'concave') {
      const imgX = centerX + toPx(v);
      const imgY = centerY - toPx(h_i);

      // Function to draw ray with arrow and virtual extension
      const drawLensRay = (startX, startY, midX, midY, endX, endY, color, isVisible) => {
        if (!isVisible) return;
        ctx.strokeStyle = color; ctx.lineWidth = 1.5;
        
        // Incident Ray
        ctx.beginPath(); ctx.moveTo(startX, startY); ctx.lineTo(midX, midY); ctx.stroke();
        drawDirArrow(ctx, startX, startY, midX, midY);

        // Refracted Ray
        // Calculate direction to draw a long enough line
        const dx = endX - midX;
        const dy = endY - midY;
        const len = Math.sqrt(dx*dx + dy*dy);
        const extendLen = 1000;
        const finalX = midX + (dx/len) * extendLen;
        const finalY = midY + (dy/len) * extendLen;

        ctx.beginPath(); ctx.moveTo(midX, midY); ctx.lineTo(finalX, finalY); ctx.stroke();
        drawDirArrow(ctx, midX, midY, midX + dx, midY + dy);

        // Virtual Extension (Dotted line backwards)
        if (v < 0) {
          ctx.setLineDash([4, 4]);
          ctx.beginPath(); ctx.moveTo(midX, midY); ctx.lineTo(imgX, imgY); ctx.stroke();
          ctx.setLineDash([]);
        }
      };

      // Ray 1: Parallel to Axis -> through F2
      const f2X = centerX + toPx(f_cm);
      const hit1Y = objY;
      drawLensRay(objX, objY, centerX, hit1Y, lensType === 'convex' ? f2X : centerX - toPx(f_cm), lensType === 'convex' ? centerY : centerY + (centerY - hit1Y), '#22c55e', visibleRays.parallel);

      // Ray 2: Through Optical Center
      drawLensRay(objX, objY, centerX, centerY, imgX, imgY, '#ec4899', visibleRays.optical);

      // Ray 3: Through F1 (if exists/practical) -> Parallel
      if (visibleRays.focal) {
         const f1X = centerX - toPx(f_cm);
         // Aiming towards F1 for concave, or through F1 for convex
         let midY3, targetY3;
         if (lensType === 'convex') {
            // Path through F1
            const slope = (centerY - objY) / (f1X - objX);
            midY3 = objY + slope * (centerX - objX);
            drawLensRay(objX, objY, centerX, midY3, centerX + 200, midY3, '#3b82f6', true);
         } else {
            // Aiming at F2 on the other side
            const f2SideX = centerX + toPx(f_cm);
            const slope = (centerY - objY) / (f2SideX - objX);
            midY3 = objY + slope * (centerX - objX);
            drawLensRay(objX, objY, centerX, midY3, centerX + 200, midY3, '#3b82f6', true);
         }
      }

      drawArrow(ctx, imgX, centerY, imgX, imgY, '#a855f7', `Image (${Math.abs(v).toFixed(1)}cm)`);
    }

  }, [physics, lensType, u_cm, f_cm, objHeight_cm, pxPerCm, zoom, isDraggingObject, isPanning, panOffset, visibleRays, colors, sidebarOpen]);

  const drawDirArrow = (ctx, x1, y1, x2, y2) => {
    const mx = x1 + (x2 - x1) * 0.5;
    const my = y1 + (y2 - y1) * 0.5;
    const angle = Math.atan2(y2 - y1, x2 - x1);
    ctx.save(); ctx.translate(mx, my); ctx.rotate(angle);
    ctx.beginPath(); ctx.moveTo(-8, -5); ctx.lineTo(0, 0); ctx.lineTo(-8, 5); ctx.stroke();
    ctx.restore();
  };

  const drawArrow = (ctx, x1, y1, x2, y2, color, label, glow) => {
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = glow ? 5 : 3;
    if (glow) { ctx.shadowBlur = 15; ctx.shadowColor = color; }
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    const a = Math.atan2(y2 - y1, x2 - x1);
    ctx.beginPath(); ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - 12 * Math.cos(a - 0.5), y2 - 12 * Math.sin(a - 0.5));
    ctx.lineTo(x2 - 12 * Math.cos(a + 0.5), y2 - 12 * Math.sin(a + 0.5)); ctx.fill();
    ctx.shadowBlur = 0; ctx.font = '800 13px Inter';
    ctx.fillText(label, x2 - 30, y2 < y1 ? y2 - 15 : y2 + 25);
  };

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.();
    }
  };

  const navThemeClass = theme === 'dark' ? 'bg-slate-900 border-white/5' : 'bg-white border-slate-200';
  const sidebarThemeClass = theme === 'dark' ? 'bg-slate-900 border-white/5' : 'bg-white border-slate-200';
  const btnThemeClass = theme === 'dark' ? 'bg-slate-800 border-white/5 hover:bg-slate-700 text-slate-100' : 'bg-slate-100 border-slate-200 hover:bg-slate-200 text-slate-900';

  return (
    <div ref={containerRef} className={`flex flex-col h-dvh ${theme === 'dark' ? 'bg-[#020617] text-slate-100' : 'bg-slate-50 text-slate-900'} overflow-hidden font-sans transition-colors duration-300 relative`}>
      <nav className={`flex items-center justify-between px-4 md:px-6 py-4 border-b z-50 transition-colors duration-300 ${navThemeClass}`}>
        <div className="flex items-center gap-2 md:gap-3">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className={`p-2 rounded-lg border transition-colors ${btnThemeClass}`}>
            {sidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
          </button>
          <div className="p-1.5 md:p-2 bg-purple-600 rounded-lg shadow-purple-500/20"><Zap className="w-4 h-4 md:w-5 md:h-5 text-white" /></div>
          <h1 className="text-sm md:text-lg font-black uppercase tracking-tighter">Lens<span className="text-purple-500">Master</span></h1>
        </div>
        
        <div className="flex gap-1.5 md:gap-2">
            <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className={`p-2 rounded-lg border transition-colors ${btnThemeClass}`} title="Toggle Theme">
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-blue-600" />}
            </button>
            <button onClick={toggleFullScreen} className={`p-2 rounded-lg border transition-colors ${btnThemeClass}`}>
              <Maximize2 className={`w-4 h-4 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`} />
            </button>
            <div className={`flex p-0.5 md:p-1 rounded-xl border ${theme === 'dark' ? 'bg-slate-800 border-white/5' : 'bg-slate-100 border-slate-200'}`}>
                <button onClick={() => setLensType('convex')} className={`px-2 md:px-4 py-1 text-[9px] md:text-[10px] font-black rounded-lg transition-all ${lensType === 'convex' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-500'}`}>CONVEX</button>
                <button onClick={() => setLensType('concave')} className={`px-2 md:px-4 py-1 text-[9px] md:text-[10px] font-black rounded-lg transition-all ${lensType === 'concave' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-500'}`}>CONCAVE</button>
            </div>
            <button onClick={() => {setZoom(1.0); setPanOffset({x:0, y:0});}} className={`p-2 rounded-lg border transition-colors ${btnThemeClass}`}><RefreshCw className="w-4 h-4" /></button>
        </div>
      </nav>

      <div className="flex flex-1 overflow-hidden relative">
        <aside className={`
          absolute top-0 left-0 bottom-0 z-[100] md:relative
          ${sidebarOpen ? 'w-72 sm:w-80 translate-x-0' : '-translate-x-full md:w-0'}
          backdrop-blur-xl border-r flex flex-col transition-all duration-300 ease-in-out ${sidebarThemeClass} overflow-hidden
        `}>
          <div className="p-5 md:p-6 space-y-5 md:space-y-6 flex-1 overflow-y-auto w-72 sm:w-80">
            <div className="flex items-center justify-between mb-2">
               <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">Lens Lab</h3>
               <button onClick={() => setSidebarOpen(false)} className="p-2 bg-slate-800/20 rounded-lg hover:bg-slate-800/40"><ChevronLeft className="w-4 h-4" /></button>
            </div>

            <section className="space-y-6">
              <SliderWithInput theme={theme} label="Obj Distance (u)" val={u_cm} min={5} max={300} unit="cm" onChange={setU} color="purple" />
              <SliderWithInput theme={theme} label="Focal Length (f)" val={f_cm} min={10} max={150} unit="cm" onChange={setF} color="amber" />
              <SliderWithInput theme={theme} label="Obj Height" val={objHeight_cm} min={5} max={80} unit="cm" onChange={setObjHeight} color="red" />
            </section>

            <section>
              <h3 className={`text-[10px] font-black uppercase tracking-widest mb-4 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>Ray Visibility</h3>
              <div className="grid grid-cols-2 gap-2">
                <ToggleButton theme={theme} label="Parallel" active={visibleRays.parallel} color="#22c55e" onClick={() => setVisibleRays(v => ({...v, parallel: !v.parallel}))} />
                <ToggleButton theme={theme} label="Optical" active={visibleRays.optical} color="#ec4899" onClick={() => setVisibleRays(v => ({...v, optical: !v.optical}))} />
                <ToggleButton theme={theme} label="Focal" active={visibleRays.focal} color="#3b82f6" onClick={() => setVisibleRays(v => ({...v, focal: !v.focal}))} />
              </div>
            </section>

            <section className={`p-4 rounded-2xl border mt-auto shadow-inner transition-colors duration-300 ${theme === 'dark' ? 'bg-slate-900/80 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex justify-between items-center text-[10px] md:text-xs mb-1.5">
                <span className={`uppercase font-black ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>Img Distance</span>
                <span className="font-mono font-bold text-purple-400">{Math.abs(physics.v).toFixed(1)} cm</span>
              </div>
              <div className="flex justify-between items-center text-[10px] md:text-xs mb-1.5">
                <span className={`uppercase font-black ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>Magnification</span>
                <span className="font-mono font-bold text-amber-400">{Math.abs(physics.m).toFixed(2)}x</span>
              </div>
              <p className={`text-[10px] md:text-xs font-bold italic border-t pt-2 mt-2 ${theme === 'dark' ? 'text-white border-white/5' : 'text-slate-700 border-slate-200'}`}>"{physics.nature}"</p>
            </section>
          </div>
        </aside>

        {!sidebarOpen && (
          <button 
            onClick={() => setSidebarOpen(true)}
            className={`absolute left-0 top-1/2 -translate-y-1/2 z-[60] p-3 rounded-r-2xl border transition-all duration-300 ${btnThemeClass} shadow-2xl`}
          >
            <ChevronRight className="w-5 h-5 text-purple-500" />
          </button>
        )}

        {isMobile && sidebarOpen && (
          <div className="absolute inset-0 bg-black/40 z-[90] backdrop-blur-[1px]" onClick={() => setSidebarOpen(false)} />
        )}

        <main className="flex-1 relative touch-none overflow-hidden transition-all duration-300" style={{ backgroundColor: colors.bg }}>
          <canvas 
            ref={canvasRef} 
            onWheel={handleWheel} 
            onPointerDown={handlePointerDown} 
            onPointerMove={handlePointerMove} 
            onPointerUp={handlePointerUp} 
            onPointerCancel={handlePointerUp}
            className={`w-full h-full ${isDraggingObject ? 'cursor-grabbing' : 'cursor-crosshair'}`} 
          />
        </main>
      </div>
    </div>
  );
};

const ToggleButton = ({ label, active, onClick, color, theme }) => {
  const activeClass = theme === 'dark' ? 'bg-slate-800 border-white/20 text-white' : 'bg-purple-50 border-purple-200 text-purple-700';
  const inactiveClass = theme === 'dark' ? 'bg-slate-900/50 border-white/5 text-slate-600' : 'bg-slate-100 border-slate-200 text-slate-400';
  return (
    <button onClick={onClick} className={`flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all text-[9px] font-bold ${active ? activeClass : inactiveClass}`}>
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full" style={{backgroundColor: active ? color : (theme === 'dark' ? '#334155' : '#cbd5e1')}} />
        {label}
      </div>
      {active ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
    </button>
  );
};

const SliderWithInput = ({ label, val, min, max, unit, onChange, color, theme }) => {
  const accentColors = { purple: 'accent-purple-500', amber: 'accent-amber-500', red: 'accent-red-500' };
  const borderColors = { purple: 'border-purple-500/30', amber: 'border-amber-500/30', red: 'border-red-500/30' };
  const inputBg = theme === 'dark' ? 'bg-slate-800' : 'bg-white';
  const labelColor = theme === 'dark' ? 'text-slate-500' : 'text-slate-400';
  const textColor = theme === 'dark' ? 'text-white' : 'text-slate-900';

  return (
    <div className="space-y-1.5 md:space-y-3">
      <div className="flex justify-between items-center text-[8px] md:text-[10px] font-black uppercase mb-1">
        <span className={labelColor}>{label}</span>
        <div className={`flex items-center border ${borderColors[color]} rounded px-2 py-1 ${inputBg}`}>
          <input 
            type="number" 
            inputMode="decimal"
            value={val} 
            onChange={(e) => {
              const num = parseFloat(e.target.value);
              if (!isNaN(num)) onChange(num);
            }}
            className={`w-10 md:w-12 bg-transparent font-mono text-center outline-none ${textColor}`}
          />
          <span className={`${labelColor} ml-0.5 font-bold`}>{unit}</span>
        </div>
      </div>
      <input 
        type="range" min={min} max={max} step="0.5" value={val} 
        onChange={(e) => onChange(Number(e.target.value))} 
        className={`w-full h-1.5 md:h-2 rounded-full appearance-none cursor-pointer transition-all ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-200'} ${accentColors[color]}`} 
      />
    </div>
  );
};

export default App;
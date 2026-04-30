import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Zap, Sun, Moon, PanelLeftClose, PanelLeftOpen, 
  Maximize2, RefreshCw, Eye, EyeOff, Activity, 
  Layers, Crosshair, Move, Settings2, Info,
  MousePointer2, ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const App = () => {
  // --- Window & Layout State ---
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
  const isSmallMobile = windowSize.width < 400;
  const BASE_PX_PER_CM = isMobile ? 3.5 : 6;

  // --- Simulation State ---
  const [theme, setTheme] = useState('dark');
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
  const [lensType, setLensType] = useState('convex'); 
  const [u_cm, setU] = useState(60); 
  const [f_cm, setF] = useState(30); 
  const [objHeight_cm, setObjHeight] = useState(15);
  const [zoom, setZoom] = useState(1.0);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });

  // Interaction States
  const [isDraggingObject, setIsDraggingObject] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const activePointers = useRef(new Map());
  const lastTouchPos = useRef({ x: 0, y: 0 });

  const [visibleRays, setVisibleRays] = useState({
    parallel: true,
    optical: true,
    focal: true,
  });

  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  // --- Adaptive Theme System ---
  const styles = useMemo(() => ({
    bg: theme === 'dark' ? 'bg-[#020617]' : 'bg-slate-50',
    canvasBg: theme === 'dark' ? '#020617' : '#f8fafc',
    glass: theme === 'dark' 
      ? 'bg-slate-900/40 border-white/10 backdrop-blur-2xl' 
      : 'bg-white/40 border-slate-200/50 backdrop-blur-2xl',
    pill: theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-slate-200/40 border-slate-300/30',
    text: theme === 'dark' ? 'text-slate-100' : 'text-slate-900',
    subtext: theme === 'dark' ? 'text-slate-400' : 'text-slate-500',
    grid: theme === 'dark' ? 'rgba(30, 41, 59, 0.3)' : 'rgba(203, 213, 225, 0.4)',
    axis: theme === 'dark' ? '#1e293b' : '#cbd5e1',
    lensBody: theme === 'dark' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(14, 165, 233, 0.1)',
    lensStroke: theme === 'dark' ? '#38bdf8' : '#0ea5e9',
    accent: 'blue'
  }), [theme]);

  const pxPerCm = useMemo(() => BASE_PX_PER_CM * zoom, [zoom, BASE_PX_PER_CM]);

  // --- Physics Core ---
  const physics = useMemo(() => {
    const signedU = -u_cm;
    const signedF = lensType === 'convex' ? f_cm : -f_cm;
    const v = (signedU * signedF) / (signedU + signedF);
    const m = v / signedU;
    const h_i = objHeight_cm * m;

    let nature = "";
    if (Math.abs(u_cm - f_cm) < 0.2 && lensType === 'convex') {
      nature = "At Infinity (Parallel Rays)";
    } else {
      const isReal = v > 0;
      const isMagnified = Math.abs(m) > 1;
      nature = `${isReal ? 'Real & Inverted' : 'Virtual & Erect'} | ${isMagnified ? 'Magnified' : 'Diminished'}`;
    }

    return { v, m, h_i, nature, f: signedF, u: signedU };
  }, [u_cm, f_cm, lensType, objHeight_cm]);

  const getCenters = (width, height) => {
    const sideOffset = (sidebarOpen && !isMobile) ? 160 : 0;
    return {
      centerX: (width / 2) + sideOffset + panOffset.x,
      centerY: (height / 2) + panOffset.y
    };
  };

  // --- Input Handlers ---
  const handlePointerDown = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const { centerX, centerY } = getCenters(rect.width, rect.height);
    
    const objX = centerX - (u_cm * pxPerCm);
    const objY = centerY - (objHeight_cm * pxPerCm);

    const distToTip = Math.sqrt(Math.pow(x - objX, 2) + Math.pow(y - objY, 2));
    
    if (distToTip < 40) {
      setIsDraggingObject(true);
    } else {
      setIsPanning(true);
      lastTouchPos.current = { x: e.clientX, y: e.clientY };
    }
    canvas.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!activePointers.current.has(e.pointerId)) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    if (isDraggingObject) {
      const { centerX, centerY } = getCenters(rect.width, rect.height);
      const newU = (centerX - (e.clientX - rect.left)) / pxPerCm;
      const newH = (centerY - (e.clientY - rect.top)) / pxPerCm;
      if (newU > 1) setU(Math.min(Math.round(newU * 10) / 10, 500));
      if (Math.abs(newH) > 2) setObjHeight(Math.min(Math.round(Math.abs(newH) * 10) / 10, 100));
    } else if (isPanning) {
      const dx = e.clientX - lastTouchPos.current.x;
      const dy = e.clientY - lastTouchPos.current.y;
      setPanOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      lastTouchPos.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handlePointerUp = (e) => {
    activePointers.current.delete(e.pointerId);
    setIsDraggingObject(false);
    setIsPanning(false);
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prev => Math.min(Math.max(prev * factor, 0.1), 5));
  };

  // --- Drawing Logic ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const { centerX, centerY } = getCenters(rect.width, rect.height);
    const toPx = (cm) => cm * pxPerCm;

    ctx.clearRect(0, 0, rect.width, rect.height);

    // Helper: Draw directional arrow on line
    const drawDirArrow = (x1, y1, x2, y2, color) => {
        const mx = (x1 + x2) / 2;
        const my = (y1 + y2) / 2;
        const angle = Math.atan2(y2 - y1, x2 - x1);
        ctx.save();
        ctx.translate(mx, my);
        ctx.rotate(angle);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-6, -4);
        ctx.lineTo(0, 0);
        ctx.lineTo(-6, 4);
        ctx.stroke();
        ctx.restore();
    };

    // 1. Grid
    ctx.strokeStyle = styles.grid;
    ctx.lineWidth = 1;
    const gridStep = 50 * zoom;
    for (let i = (panOffset.x % gridStep); i < rect.width; i += gridStep) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, rect.height); ctx.stroke();
    }
    for (let j = (panOffset.y % gridStep); j < rect.height; j += gridStep) {
      ctx.beginPath(); ctx.moveTo(0, j); ctx.lineTo(rect.width, j); ctx.stroke();
    }

    // 2. Axis
    ctx.strokeStyle = styles.axis;
    ctx.setLineDash([8, 4]);
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, centerY); ctx.lineTo(rect.width, centerY); ctx.stroke();
    ctx.setLineDash([]);

    // 3. Markers
    const drawPoint = (x, label, color) => {
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(x, centerY, 5, 0, Math.PI * 2); ctx.fill();
      ctx.font = '700 10px Inter';
      ctx.fillStyle = styles.text;
      ctx.textAlign = 'center';
      ctx.fillText(label, x, centerY + 25);
    };

    drawPoint(centerX - toPx(f_cm), 'F₁', '#f59e0b');
    drawPoint(centerX + toPx(f_cm), 'F₂', '#f59e0b');
    drawPoint(centerX - toPx(2 * f_cm), '2F₁', '#ef4444');
    drawPoint(centerX + toPx(2 * f_cm), '2F₂', '#ef4444');
    drawPoint(centerX, 'O', styles.text);

    // 4. Lens
    const lh = 190 * zoom;
    const lw = 35 * zoom;
    ctx.save();
    ctx.translate(centerX, centerY);
    
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, lh);
    grad.addColorStop(0, styles.lensBody);
    grad.addColorStop(1, 'rgba(56, 189, 248, 0)');
    
    ctx.fillStyle = grad;
    ctx.strokeStyle = styles.lensStroke;
    ctx.lineWidth = 3;
    ctx.beginPath();
    if (lensType === 'convex') {
      ctx.moveTo(0, -lh);
      ctx.quadraticCurveTo(lw, 0, 0, lh);
      ctx.quadraticCurveTo(-lw, 0, 0, -lh);
    } else {
      ctx.moveTo(-lw/2, -lh);
      ctx.lineTo(lw/2, -lh);
      ctx.quadraticCurveTo(0, 0, lw/2, lh);
      ctx.lineTo(-lw/2, lh);
      ctx.quadraticCurveTo(0, 0, -lw/2, -lh);
    }
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();

    // 5. Object & Image
    const objX = centerX - toPx(u_cm);
    const objY = centerY - toPx(objHeight_cm);
    drawArrow(ctx, objX, centerY, objX, objY, '#3b82f6', 'OBJECT', isDraggingObject);

    if (Math.abs(u_cm - f_cm) > 0.2 || lensType === 'concave') {
      const imgX = centerX + toPx(physics.v);
      const imgY = centerY - toPx(physics.h_i);

      // --- Ray Tracing ---
      const drawRay = (startX, startY, midX, midY, endX, endY, color, dash = false) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        if (dash) ctx.setLineDash([5, 5]);
        ctx.beginPath(); ctx.moveTo(startX, startY); ctx.lineTo(midX, midY); ctx.lineTo(endX, endY); ctx.stroke();
        ctx.setLineDash([]);
        
        if (!dash) {
            drawDirArrow(startX, startY, midX, midY, color);
            drawDirArrow(midX, midY, endX, endY, color);
        }
      };

      // Ray 1: Parallel to Axis
      if (visibleRays.parallel) {
        const hitX = centerX;
        const hitY = objY;
        const f2X = centerX + toPx(f_cm);
        
        if (lensType === 'convex') {
          const slope = (centerY - hitY) / (f2X - hitX);
          const finalX = rect.width;
          const finalY = hitY + slope * (finalX - hitX);
          drawRay(objX, objY, hitX, hitY, finalX, finalY, '#10b981');
          if (physics.v < 0) drawRay(hitX, hitY, imgX, imgY, '#10b981', true);
        } else {
          const f1X = centerX - toPx(f_cm);
          const slope = (hitY - centerY) / (hitX - f1X);
          const finalX = rect.width;
          const finalY = hitY + slope * (finalX - hitX);
          drawRay(objX, objY, hitX, hitY, finalX, finalY, '#10b981');
          drawRay(hitX, hitY, imgX, imgY, '#10b981', true);
        }
      }

      // Ray 2: Optical Center
      if (visibleRays.optical) {
        const slope = (centerY - objY) / (centerX - objX);
        const finalX = physics.v > 0 ? rect.width : -rect.width;
        const finalY = centerY + slope * (finalX - centerX);
        drawRay(objX, objY, centerX, centerY, finalX, finalY, '#ec4899');
        if (physics.v < 0) drawRay(centerX, centerY, imgX, imgY, '#ec4899', true);
      }

      // Ray 3: Through Focal Point
      if (visibleRays.focal) {
          if (lensType === 'convex') {
              const f1X = centerX - toPx(f_cm);
              const slope = (centerY - objY) / (f1X - objX);
              const hitY = objY + slope * (centerX - objX);
              drawRay(objX, objY, centerX, hitY, rect.width, hitY, '#8b5cf6');
              if (physics.v < 0) drawRay(centerX, hitY, imgX, imgY, '#8b5cf6', true);
          } else {
              const f2SideX = centerX + toPx(f_cm);
              const slope = (centerY - objY) / (f2SideX - objX);
              const hitY = objY + slope * (centerX - objX);
              drawRay(objX, objY, centerX, hitY, rect.width, hitY, '#8b5cf6');
              drawRay(centerX, hitY, imgX, imgY, '#8b5cf6', true);
          }
      }

      drawArrow(ctx, imgX, centerY, imgX, imgY, '#f59e0b', `IMAGE (${Math.abs(physics.v).toFixed(1)}cm)`);
    }

  }, [physics, lensType, u_cm, f_cm, objHeight_cm, pxPerCm, zoom, panOffset, visibleRays, styles]);

  const drawArrow = (ctx, x1, y1, x2, y2, color, label, isHot) => {
    ctx.strokeStyle = color; ctx.fillStyle = color;
    ctx.lineWidth = isHot ? 6 : 4;
    if (isHot) { ctx.shadowBlur = 15; ctx.shadowColor = color; }
    
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    const a = Math.atan2(y2 - y1, x2 - x1);
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - 12 * Math.cos(a - 0.5), y2 - 12 * Math.sin(a - 0.5));
    ctx.lineTo(x2 - 12 * Math.cos(a + 0.5), y2 - 12 * Math.sin(a + 0.5));
    ctx.fill();
    
    ctx.shadowBlur = 0;
    ctx.font = 'bold 9px Inter';
    ctx.textAlign = 'center';
    ctx.fillText(label, x2, y2 < y1 ? y2 - 15 : y2 + 25);
  };

  const toggleFS = () => {
    if (!document.fullscreenElement) containerRef.current?.requestFullscreen();
    else document.exitFullscreen();
  };

  return (
    <div ref={containerRef} className={`h-screen w-full flex flex-col overflow-hidden transition-colors duration-700 ${styles.bg} ${styles.text}`}>
      
      {/* --- Navbar - Responsive Pill Based --- */}
      <nav className={`h-16 px-3 md:px-6 flex items-center justify-between border-b z-[100] ${styles.glass}`}>
        <div className="flex items-center gap-2 md:gap-4">
          <motion.button 
            whileHover={{ scale: 1.05 }} 
            whileTap={{ scale: 0.95 }}
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={`p-2 md:p-2.5 rounded-full border transition-colors ${styles.pill}`}
          >
            {sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
          </motion.button>
          <div className="flex items-center gap-2 md:gap-3">
            <div className="p-1.5 md:p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full shadow-lg shadow-blue-500/20">
              <Zap size={16} className="text-white md:size-[18px]" />
            </div>
            <h1 className="font-black text-xs md:text-base tracking-tighter uppercase italic">
              Lens<span className="text-blue-500">Flux</span> 
              {!isSmallMobile && <span className="text-[8px] md:text-[9px] bg-blue-500/10 px-2 py-0.5 rounded-full ml-1 text-blue-500 not-italic border border-blue-500/20">2.0</span>}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-1 md:gap-2">
          {/* Fixed Selector Visibility for Mobile */}
          <div className={`flex p-0.5 md:p-1 rounded-full border border-white/5 bg-black/20`}>
            <button 
              onClick={() => setLensType('convex')} 
              className={`px-3 md:px-5 py-1 md:py-1.5 rounded-full text-[8px] md:text-[10px] font-bold transition-all ${lensType === 'convex' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
            >CONVEX</button>
            <button 
              onClick={() => setLensType('concave')} 
              className={`px-3 md:px-5 py-1 md:py-1.5 rounded-full text-[8px] md:text-[10px] font-bold transition-all ${lensType === 'concave' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
            >CONCAVE</button>
          </div>
          
          <div className="h-6 w-px bg-white/10 mx-1 hidden md:block" />

          <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className={`p-2 md:p-2.5 rounded-full border text-amber-500 ${styles.pill}`}>
            {theme === 'dark' ? <Sun size={16} className="md:size-[18px]" /> : <Moon size={16} className="text-blue-600 md:size-[18px]" />}
          </button>
          
          {!isMobile && (
            <button onClick={toggleFS} className={`p-2.5 rounded-full border opacity-60 hover:opacity-100 ${styles.pill}`}>
              <Maximize2 size={18} />
            </button>
          )}
        </div>
      </nav>

      <div className="flex-1 flex overflow-hidden relative">
        {/* --- Sidebar --- */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.aside 
              initial={{ x: -340 }} animate={{ x: 0 }} exit={{ x: -340 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className={`absolute md:relative w-80 h-full border-r z-50 flex flex-col p-6 space-y-8 overflow-y-auto ${styles.glass}`}
            >
              <div className="space-y-6">
                <header className="flex items-center gap-2 text-blue-500">
                  <Settings2 size={16} />
                  <h3 className="text-[10px] font-black uppercase tracking-widest">Physics Core</h3>
                </header>

                <div className="space-y-6">
                  <ControlSlider label="Object Distance" val={u_cm} unit="cm" min={1} max={300} color="blue" onChange={setU} theme={theme} />
                  <ControlSlider label="Focal Length" val={f_cm} unit="cm" min={10} max={150} color="amber" onChange={setF} theme={theme} />
                  <ControlSlider label="Object Height" val={objHeight_cm} unit="cm" min={2} max={100} color="red" onChange={setObjHeight} theme={theme} />
                </div>
              </div>

              <div className="space-y-4">
                <header className="flex items-center gap-2 text-slate-500">
                  <Layers size={16} />
                  <h3 className="text-[10px] font-black uppercase tracking-widest">Ray Visualization</h3>
                </header>
                <div className="grid grid-cols-2 gap-2">
                  <RayToggle label="Parallel" active={visibleRays.parallel} color="#10b981" onClick={() => setVisibleRays(r => ({...r, parallel: !r.parallel}))} styles={styles} />
                  <RayToggle label="Center" active={visibleRays.optical} color="#ec4899" onClick={() => setVisibleRays(r => ({...r, optical: !r.optical}))} styles={styles} />
                  <RayToggle label="Focal" active={visibleRays.focal} color="#8b5cf6" onClick={() => setVisibleRays(r => ({...r, focal: !r.focal}))} styles={styles} />
                </div>
              </div>

              <div className="mt-auto">
                 <div className={`p-5 rounded-3xl border border-white/5 ${theme === 'dark' ? 'bg-blue-500/5' : 'bg-blue-50/50'}`}>
                    <div className="flex justify-between items-center text-[10px] font-bold uppercase mb-4 tracking-tighter">
                        <span className="opacity-40">Imaging Data</span>
                        <span className="text-blue-500 flex items-center gap-1.5"><Activity size={10}/> Active</span>
                    </div>
                    <div className="space-y-3">
                        <ResultItem label="Image Dist." val={`${Math.abs(physics.v).toFixed(1)} cm`} />
                        <ResultItem label="Magnification" val={`${Math.abs(physics.m).toFixed(2)}x`} />
                        <div className="pt-3 mt-1 border-t border-white/10 text-[11px] font-bold italic text-blue-400">
                            {physics.nature}
                        </div>
                    </div>
                 </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        <main className="flex-1 relative touch-none select-none">
          <canvas 
            ref={canvasRef} 
            onWheel={handleWheel} 
            onPointerDown={handlePointerDown} 
            onPointerMove={handlePointerMove} 
            onPointerUp={handlePointerUp} 
            className={`w-full h-full cursor-crosshair`} 
            style={{ backgroundColor: styles.canvasBg }}
          />

          {/* Floating Pill Controls */}
          <div className="absolute bottom-8 right-8 flex flex-col gap-3">
             <FloatingButton 
                onClick={() => {setZoom(1); setPanOffset({x:0, y:0})}} 
                icon={<RefreshCw size={20} />} 
                label="Reset" 
                styles={styles} 
             />
          </div>

          <AnimatePresence>
            {isDraggingObject && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
                className="absolute top-8 left-1/2 -translate-x-1/2 px-6 py-2.5 rounded-full bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest shadow-2xl flex items-center gap-2"
              >
                <MousePointer2 size={12} /> Modifying Object
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
};

// --- Pill UI Components ---

const ControlSlider = ({ label, val, unit, min, max, color, onChange, theme }) => (
  <div className="space-y-3">
    <div className="flex justify-between items-end px-1">
      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{label}</span>
      <div className="flex items-center gap-1.5 bg-black/20 px-2 py-0.5 rounded-full border border-white/5">
        <input 
          type="number" value={val} 
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-10 bg-transparent text-right font-mono text-[10px] font-bold outline-none"
        />
        <span className="text-[9px] font-black opacity-30 uppercase">{unit}</span>
      </div>
    </div>
    <div className="px-1">
        <input 
            type="range" min={min} max={max} step="0.1" value={val} 
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-full h-1 rounded-full appearance-none bg-slate-500/20 cursor-pointer accent-blue-600"
        />
    </div>
  </div>
);

const RayToggle = ({ label, active, color, onClick, styles }) => (
  <button 
    onClick={onClick} 
    className={`flex items-center justify-between px-4 py-2.5 rounded-full border transition-all ${active ? 'bg-white/10 border-white/20' : 'bg-transparent border-transparent opacity-30 hover:opacity-100'}`}
  >
    <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full shadow-[0_0_8px_rgba(255,255,255,0.2)]" style={{ backgroundColor: color }} />
        <span className="text-[9px] font-black uppercase tracking-tighter">{label}</span>
    </div>
    {active ? <Eye size={12} className="opacity-60" /> : <EyeOff size={12} className="opacity-20" />}
  </button>
);

const ResultItem = ({ label, val }) => (
  <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-tight">
    <span className="opacity-30">{label}</span>
    <span className="font-mono text-blue-500 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/10 shadow-inner">{val}</span>
  </div>
);

const FloatingButton = ({ onClick, icon, label, styles }) => (
    <motion.button 
        whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
        onClick={onClick} 
        className={`p-4 rounded-full shadow-2xl border flex items-center gap-3 transition-colors ${styles.glass} ${styles.pill}`}
    >
        {icon}
        <span className="text-[10px] font-black uppercase tracking-widest hidden md:block">{label}</span>
    </motion.button>
);

export default App;
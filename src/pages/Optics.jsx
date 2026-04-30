import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Zap, Maximize, MousePointer2, Info, Eye, EyeOff, 
  Smartphone, Maximize2, Sun, Moon, PanelLeftClose, PanelLeftOpen, 
  ChevronRight, ChevronLeft, Activity, Box, Sparkles, Calculator
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
  const [mirrorType, setMirrorType] = useState('concave'); 
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
    focal: true,
    center: false,
    pole: true
  });
  
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  // --- Theme Colors ---
  const colors = useMemo(() => ({
    bg: theme === 'dark' ? '#020617' : '#f8fafc',
    gridMinor: theme === 'dark' ? 'rgba(30, 41, 59, 0.3)' : 'rgba(226, 232, 240, 0.5)',
    gridMajor: theme === 'dark' ? 'rgba(51, 65, 85, 0.5)' : 'rgba(203, 213, 225, 0.8)',
    axis: theme === 'dark' ? '#334155' : '#cbd5e1',
    text: theme === 'dark' ? '#f1f5f9' : '#0f172a',
    mirrorBack: theme === 'dark' ? '#1e293b' : '#94a3b8',
    hatch: theme === 'dark' ? '#334155' : '#cbd5e1',
  }), [theme]);

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.();
    }
  };

  const pxPerCm = useMemo(() => BASE_PX_PER_CM * zoom, [zoom, BASE_PX_PER_CM]);

  const physics = useMemo(() => {
    const signedU = -u_cm;
    const signedF = mirrorType === 'concave' ? -f_cm : f_cm;
    const signedV = (signedU * signedF) / (signedU - signedF);
    const m = -signedV / signedU;
    const imgHeight = objHeight_cm * m;

    let nature = "";
    if (Math.abs(u_cm - f_cm) < 0.5) {
      nature = "Infinity (Parallel Rays)";
    } else if (signedV < 0) {
      nature = `Real & Inverted`;
    } else {
      nature = `Virtual & Erect`;
    }

    return { 
      v: signedV, 
      m, 
      h_i: imgHeight, 
      nature, 
      f: signedF, 
      u: signedU, 
      c: 2 * signedF,
      isReal: signedV < 0
    };
  }, [u_cm, f_cm, mirrorType, objHeight_cm]);

  const getCenters = (width, height) => {
    // Offset the center slightly if sidebar is open on desktop
    const baseOffset = (sidebarOpen && !isMobile) ? 140 : 0;
    const defaultCenterX = isMobile ? width * 0.75 : width / 2 + baseOffset; 
    const defaultCenterY = height / 2;
    return { 
      centerX: defaultCenterX + panOffset.x, 
      centerY: defaultCenterY + panOffset.y 
    };
  };

  const getMirrorIntersection = (x1, y1, x2, y2, centerX, centerY, radius, isConcave) => {
    const circleX = isConcave ? centerX - radius : centerX + radius;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const A = dx * dx + dy * dy;
    if (A === 0) return { x: centerX, y: y1 };
    const B = 2 * (dx * (x1 - circleX) + dy * (y1 - centerY));
    const C = (x1 - circleX) * (x1 - circleX) + (y1 - centerY) * (y1 - centerY) - radius * radius;
    const det = B * B - 4 * A * C;
    
    if (det < 0) return { x: centerX, y: y1 }; 
    const t1 = (-B + Math.sqrt(det)) / (2 * A);
    const t2 = (-B - Math.sqrt(det)) / (2 * A);
    
    const p1 = { x: x1 + t1 * dx, y: y1 + t1 * dy };
    const p2 = { x: x1 + t2 * dx, y: y1 + t2 * dy };
    
    return Math.abs(p1.x - centerX) < Math.abs(p2.x - centerX) ? p1 : p2;
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
          setZoom(prev => Math.min(Math.max(prev * ratio, 0.05), 20.0));
        }
        lastPinchDist.current = dist;
        const midX = (pointers[0].x + pointers[1].x) / 2;
        const midY = (pointers[0].y + pointers[1].y) / 2;
        if (lastTouchPos.current.midX) {
            const dx = midX - lastTouchPos.current.midX;
            const dy = midY - lastTouchPos.current.midY;
            setPanOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
        }
        lastTouchPos.current = { ...lastTouchPos.current, midX, midY };
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
    const delta = e.deltaY > 0 ? 0.95 : 1.05;
    setZoom(prev => Math.min(Math.max(prev * delta, 0.1), 10.0));
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
    const { v, h_i, f, u, c } = physics;
    const radiusPx = Math.abs(toPx(c));

    ctx.clearRect(0, 0, width, height);

    const drawGrid = () => {
      const stepMinor = 25 * zoom;
      const stepMajor = 100 * zoom;
      
      ctx.beginPath();
      ctx.strokeStyle = colors.gridMinor;
      ctx.lineWidth = 0.5;
      for (let i = (panOffset.x % stepMinor); i < width; i += stepMinor) {
        ctx.moveTo(i, 0); ctx.lineTo(i, height);
      }
      for (let j = (panOffset.y % stepMinor); j < height; j += stepMinor) {
        ctx.moveTo(0, j); ctx.lineTo(width, j);
      }
      ctx.stroke();

      ctx.beginPath();
      ctx.strokeStyle = colors.gridMajor;
      ctx.lineWidth = 1;
      for (let i = (panOffset.x % stepMajor); i < width; i += stepMajor) {
        ctx.moveTo(i, 0); ctx.lineTo(i, height);
      }
      for (let j = (panOffset.y % stepMajor); j < height; j += stepMajor) {
        ctx.moveTo(0, j); ctx.lineTo(width, j);
      }
      ctx.stroke();
    };
    drawGrid();

    ctx.strokeStyle = colors.axis;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, centerY); ctx.lineTo(width, centerY); ctx.stroke();

    const angleRange = 0.55;
    ctx.save();
    if (mirrorType === 'concave') {
      const mCX = centerX - radiusPx; 
      ctx.strokeStyle = colors.mirrorBack; ctx.lineWidth = 8;
      ctx.beginPath(); ctx.arc(mCX, centerY, radiusPx + 2, -angleRange, angleRange); ctx.stroke();
      ctx.strokeStyle = colors.hatch; ctx.lineWidth = 1;
      for (let a = -angleRange; a <= angleRange; a += 0.04) {
        const xs = mCX + radiusPx * Math.cos(a); const ys = centerY + radiusPx * Math.sin(a);
        ctx.beginPath(); ctx.moveTo(xs, ys); ctx.lineTo(xs + 6, ys + 6); ctx.stroke();
      }
      const grad = ctx.createLinearGradient(centerX - 20, centerY - 100, centerX, centerY + 100);
      grad.addColorStop(0, '#3b82f6'); grad.addColorStop(0.5, '#60a5fa'); grad.addColorStop(1, '#2563eb');
      ctx.beginPath(); ctx.arc(mCX, centerY, radiusPx, -angleRange, angleRange);
      ctx.strokeStyle = grad; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.stroke();
    } else {
      const mCX = centerX + radiusPx; 
      ctx.strokeStyle = colors.mirrorBack; ctx.lineWidth = 8;
      ctx.beginPath(); ctx.arc(mCX, centerY, radiusPx - 2, Math.PI - angleRange, Math.PI + angleRange); ctx.stroke();
      ctx.strokeStyle = colors.hatch; ctx.lineWidth = 1;
      for (let a = Math.PI - angleRange; a <= Math.PI + angleRange; a += 0.04) {
        const xs = mCX + radiusPx * Math.cos(a); const ys = centerY + radiusPx * Math.sin(a);
        ctx.beginPath(); ctx.moveTo(xs, ys); ctx.lineTo(xs - 6, ys + 6); ctx.stroke();
      }
      const grad = ctx.createLinearGradient(centerX - 20, centerY - 100, centerX + 20, centerY + 100);
      grad.addColorStop(0, '#3b82f6'); grad.addColorStop(0.5, '#60a5fa'); grad.addColorStop(1, '#2563eb');
      ctx.beginPath(); ctx.arc(mCX, centerY, radiusPx, Math.PI - angleRange, Math.PI + angleRange);
      ctx.strokeStyle = grad; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.stroke();
    }
    ctx.restore();

    const drawP = (x, label, color) => {
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, centerY, 6, 0, 7); ctx.fill();
      ctx.strokeStyle = 'white'; ctx.lineWidth = 2; ctx.stroke();
      ctx.font = '900 12px Inter';
      ctx.fillStyle = colors.text;
      ctx.fillText(label, x - 5, centerY + 28);
    };
    drawP(centerX, 'P', '#64748b');
    drawP(centerX + toPx(f), 'F', '#fbbf24');
    drawP(centerX + toPx(c), 'C', '#f97316');

    const objX = centerX + toPx(u);
    const objY = centerY - toPx(objHeight_cm);
    drawArrow(ctx, objX, centerY, objX, objY, '#ef4444', 'OBJ', isDraggingObject);

    if (Math.abs(u_cm - f_cm) > 0.5) {
      const imgX = centerX + toPx(v);
      const imgY = centerY - toPx(h_i);
      const isConcave = mirrorType === 'concave';

      const drawRayPath = (startX, startY, midX, midY, endX, endY, color, isVisible) => {
        if (!isVisible) return;
        ctx.strokeStyle = color; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(startX, startY); ctx.lineTo(midX, midY); ctx.stroke();
        drawDirArrow(ctx, startX, startY, midX, midY);
        
        if (v < 0) {
          ctx.beginPath(); ctx.moveTo(midX, midY); ctx.lineTo(endX, endY); ctx.stroke();
          drawDirArrow(ctx, midX, midY, endX, endY);
        } else {
          const angle = Math.atan2(endY - midY, endX - midX);
          const extX = midX - 400 * Math.cos(angle);
          const extY = midY - 400 * Math.sin(angle);
          ctx.beginPath(); ctx.moveTo(midX, midY); ctx.lineTo(extX, extY); ctx.stroke();
          drawDirArrow(ctx, midX, midY, extX, extY);
          ctx.setLineDash([8,6]);
          ctx.beginPath(); ctx.moveTo(midX, midY); ctx.lineTo(endX, endY); ctx.stroke();
          ctx.setLineDash([]);
        }
      };

      const hit1 = getMirrorIntersection(objX, objY, centerX + (isConcave ? 200 : -200), objY, centerX, centerY, radiusPx, isConcave);
      drawRayPath(objX, objY, hit1.x, hit1.y, imgX, imgY, '#22c55e', visibleRays.parallel);
      const hit2 = getMirrorIntersection(objX, objY, centerX + toPx(f), centerY, centerX, centerY, radiusPx, isConcave);
      drawRayPath(objX, objY, hit2.x, hit2.y, imgX, imgY, '#3b82f6', visibleRays.focal);
      const hit3 = getMirrorIntersection(objX, objY, centerX + toPx(c), centerY, centerX, centerY, radiusPx, isConcave);
      drawRayPath(objX, objY, hit3.x, hit3.y, imgX, imgY, '#f97316', visibleRays.center);
      drawRayPath(objX, objY, centerX, centerY, imgX, imgY, '#ec4899', visibleRays.pole);

      drawArrow(ctx, imgX, centerY, imgX, imgY, '#a855f7', `IMG (${Math.abs(v).toFixed(1)})`);
    }
  }, [physics, mirrorType, u_cm, f_cm, objHeight_cm, pxPerCm, zoom, isDraggingObject, isPanning, panOffset, visibleRays, colors, sidebarOpen, isMobile]);

  const drawDirArrow = (ctx, x1, y1, x2, y2) => {
    const mx = (x1 + x2) / 2; const my = (y1 + y2) / 2;
    const angle = Math.atan2(y2 - y1, x2 - x1);
    ctx.save(); ctx.translate(mx, my); ctx.rotate(angle);
    ctx.beginPath(); ctx.moveTo(-12, -7); ctx.lineTo(0, 0); ctx.lineTo(-12, 7); ctx.stroke();
    ctx.restore();
  };

  const drawArrow = (ctx, x1, y1, x2, y2, color, label, glow) => {
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = glow ? 7 : 5;
    if (glow) { ctx.shadowBlur = 25; ctx.shadowColor = color; }
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    const a = Math.atan2(y2 - y1, x2 - x1);
    ctx.beginPath(); ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - 16 * Math.cos(a - 0.5), y2 - 16 * Math.sin(a - 0.5));
    ctx.lineTo(x2 - 16 * Math.cos(a + 0.5), y2 - 16 * Math.sin(a + 0.5)); ctx.fill();
    ctx.shadowBlur = 0; 
    ctx.font = '900 13px Inter';
    ctx.fillStyle = theme === 'dark' ? 'white' : 'black';
    ctx.fillText(label, x2 - 25, y2 < y1 ? y2 - 20 : y2 + 32);
  };

  const glassPanel = theme === 'dark' 
    ? 'bg-slate-900/80 backdrop-blur-2xl border border-white/10 shadow-2xl' 
    : 'bg-white/90 backdrop-blur-2xl border border-slate-200/50 shadow-xl';

  return (
    <div ref={containerRef} className={`flex flex-col h-dvh ${theme === 'dark' ? 'bg-[#020617] text-slate-100' : 'bg-slate-50 text-slate-900'} overflow-hidden font-sans relative transition-all duration-700`}>
      
      {/* Background Orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
         <div className={`absolute -top-[10%] -left-[10%] w-[50%] h-[50%] rounded-full blur-[120px] opacity-20 ${theme === 'dark' ? 'bg-blue-600' : 'bg-blue-300'}`} />
         <div className={`absolute -bottom-[10%] -right-[10%] w-[50%] h-[50%] rounded-full blur-[120px] opacity-10 ${theme === 'dark' ? 'bg-indigo-600' : 'bg-indigo-300'}`} />
      </div>

      {/* Navbar - More Compact for Mobile */}
      <nav className={`fixed top-4 left-4 right-4 h-14 md:h-16 flex items-center justify-between px-3 md:px-6 z-[100] ${glassPanel} rounded-full mx-auto max-w-6xl`}>
        <div className="flex items-center gap-2 md:gap-4">
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)} 
            className={`w-9 h-9 md:w-11 md:h-11 rounded-full flex items-center justify-center transition-all ${theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}
          >
            {sidebarOpen ? <PanelLeftClose className="w-5 h-5" /> : <PanelLeftOpen className="w-5 h-5" />}
          </button>
          <div className="flex items-center gap-2">
            <div className="p-1.5 md:p-2 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-full shadow-lg">
              <Zap className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" />
            </div>
            <h1 className="text-[10px] md:text-xs font-black uppercase tracking-[0.2em] md:tracking-[0.3em]">
              OPTICS<span className="text-blue-500 italic">MASTER</span>
            </h1>
          </div>
        </div>

        <div className="flex gap-1 md:gap-2">
            <div className={`flex p-0.5 md:p-1 rounded-full ${theme === 'dark' ? 'bg-black/30' : 'bg-slate-200/50'}`}>
                <button onClick={() => setMirrorType('concave')} className={`px-3 md:px-5 py-1 text-[8px] md:text-[10px] font-black rounded-full transition-all ${mirrorType === 'concave' ? 'bg-blue-600 text-white' : 'text-slate-500'}`}>CCV</button>
                <button onClick={() => setMirrorType('convex')} className={`px-3 md:px-5 py-1 text-[8px] md:text-[10px] font-black rounded-full transition-all ${mirrorType === 'convex' ? 'bg-blue-600 text-white' : 'text-slate-500'}`}>CVX</button>
            </div>
            
            <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className={`w-9 h-9 md:w-11 md:h-11 rounded-full flex items-center justify-center transition-all ${theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}>
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-blue-600" />}
            </button>
        </div>
      </nav>

      <div className="flex flex-1 overflow-hidden relative pt-20 md:pt-24">
        {/* Sidebar - Mobile Specific Layout */}
        <aside className={`
          absolute z-[100] transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] overflow-hidden
          ${isMobile 
            ? `top-0 left-0 bottom-0 w-[280px] rounded-r-[32px] ${sidebarOpen ? 'translate-x-0 shadow-[20px_0_60px_-15px_rgba(0,0,0,0.5)]' : '-translate-x-full'}` 
            : `top-4 left-4 bottom-4 w-[340px] rounded-[40px] ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:w-0'}`
          }
          ${glassPanel} md:border-none md:bg-transparent md:backdrop-blur-none
        `}>
          <div className="p-6 md:p-8 space-y-6 md:space-y-10 flex-1 h-full flex flex-col overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
               <div className="flex items-center gap-2">
                 <Activity className="w-4 h-4 text-blue-500" />
                 <h3 className="text-[10px] md:text-[11px] font-black uppercase tracking-[0.25em] text-blue-500">Parameters</h3>
               </div>
               <button onClick={() => setSidebarOpen(false)} className="p-2 bg-white/5 rounded-full"><ChevronLeft className="w-5 h-5" /></button>
            </div>

            <section className="space-y-6 md:space-y-10">
              <SliderWithInput theme={theme} label="Object Dist (u)" val={u_cm} min={5} max={300} unit="cm" onChange={setU} color="blue" icon={<Box className="w-3 h-3" />} />
              <SliderWithInput theme={theme} label="Focal Length (f)" val={f_cm} min={10} max={150} unit="cm" onChange={setF} color="amber" icon={<Sparkles className="w-3 h-3" />} />
              <SliderWithInput theme={theme} label="Height (h)" val={objHeight_cm} min={5} max={80} unit="cm" onChange={setObjHeight} color="red" icon={<Maximize className="w-3 h-3" />} />
            </section>

            <section>
              <h3 className={`text-[9px] font-black uppercase tracking-[0.2em] mb-4 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>Optical Paths</h3>
              <div className="grid grid-cols-2 gap-3">
                <ToggleButton theme={theme} label="Parallel" active={visibleRays.parallel} color="#22c55e" onClick={() => setVisibleRays(v => ({...v, parallel: !v.parallel}))} />
                <ToggleButton theme={theme} label="Focal" active={visibleRays.focal} color="#3b82f6" onClick={() => setVisibleRays(v => ({...v, focal: !v.focal}))} />
                <ToggleButton theme={theme} label="Center" active={visibleRays.center} color="#f97316" onClick={() => setVisibleRays(v => ({...v, center: !v.center}))} />
                <ToggleButton theme={theme} label="Pole" active={visibleRays.pole} color="#ec4899" onClick={() => setVisibleRays(v => ({...v, pole: !v.pole}))} />
              </div>
            </section>

            {/* Combined Result Card for Mobile */}
            <section className={`p-5 rounded-[28px] border transition-all duration-500 mt-auto ${theme === 'dark' ? 'bg-blue-600/5 border-blue-500/20' : 'bg-blue-50 border-blue-100'}`}>
              <div className="flex justify-between items-center text-[10px] mb-3">
                <span className={`uppercase font-black tracking-widest ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>RESULT DATA</span>
                <span className="font-mono font-bold text-blue-500">v = {Math.abs(physics.v).toFixed(1)} cm</span>
              </div>
              
              <div className="space-y-3">
                <div className="flex gap-2">
                   <div className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${physics.isReal ? 'bg-red-500/10 text-red-400' : 'bg-blue-500/10 text-blue-400'}`}>
                      {physics.isReal ? 'REAL' : 'VIRTUAL'}
                   </div>
                   <div className="px-2 py-0.5 rounded text-[8px] font-black uppercase bg-slate-500/10 text-slate-400">
                      m = {Math.abs(physics.m).toFixed(2)}
                   </div>
                </div>
                <p className={`text-[11px] font-black uppercase ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{physics.nature}</p>
                
                {/* Math Table Integrated into Sidebar for Mobile */}
                {isMobile && (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 pt-2 border-t border-white/5 text-[9px] font-mono">
                    <div className="flex justify-between"><span className="opacity-40">f:</span> {physics.f.toFixed(1)}</div>
                    <div className="flex justify-between"><span className="opacity-40">u:</span> {physics.u.toFixed(1)}</div>
                    <div className="flex justify-between"><span className="opacity-40">v:</span> {physics.v.toFixed(1)}</div>
                    <div className="flex justify-between"><span className="opacity-40">m:</span> {physics.m.toFixed(2)}</div>
                  </div>
                )}
              </div>
            </section>
          </div>
        </aside>

        {!sidebarOpen && (
          <button onClick={() => setSidebarOpen(true)} className={`fixed left-4 md:left-8 top-1/2 -translate-y-1/2 z-[60] w-12 h-12 md:w-14 md:h-14 rounded-full border flex items-center justify-center transition-all duration-500 ${theme === 'dark' ? 'bg-slate-900 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900 shadow-xl'}`}>
            <ChevronRight className="w-6 h-6 text-blue-500" />
          </button>
        )}

        {isMobile && sidebarOpen && (
          <div className="absolute inset-0 bg-black/60 z-[90] backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
        )}

        {/* Main Canvas Area */}
        <main className="flex-1 relative touch-none overflow-hidden" style={{ backgroundColor: colors.bg }}>
          <canvas 
            ref={canvasRef} 
            onWheel={handleWheel} 
            onPointerDown={handlePointerDown} 
            onPointerMove={handlePointerMove} 
            onPointerUp={handlePointerUp} 
            onPointerCancel={handlePointerUp}
            className={`w-full h-full ${isDraggingObject ? 'cursor-grabbing' : 'cursor-crosshair'}`} 
          />

          {/* Desktop Only MATH OVERLAY CARD */}
          {!isMobile && (
            <div className={`absolute bottom-8 right-8 w-64 p-5 rounded-[28px] ${glassPanel} border-none shadow-2xl`}>
               <div className="flex items-center gap-2 mb-3">
                 <Calculator className="w-3.5 h-3.5 text-blue-500" />
                 <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Live Equation</span>
               </div>
               <div className="space-y-4">
                  <div className="font-mono text-center text-sm py-2 bg-black/5 rounded-xl border border-white/5">
                     <span className="text-blue-400">1</span>/f = <span className="text-purple-400">1</span>/v + <span className="text-red-400">1</span>/u
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-[10px]">
                     <div className="flex justify-between border-b border-white/5 pb-1">
                        <span className="text-slate-500 uppercase">f:</span>
                        <span className="font-bold text-amber-500">{physics.f.toFixed(1)}</span>
                     </div>
                     <div className="flex justify-between border-b border-white/5 pb-1">
                        <span className="text-slate-500 uppercase">u:</span>
                        <span className="font-bold text-red-500">{physics.u.toFixed(1)}</span>
                     </div>
                     <div className="flex justify-between border-b border-white/5 pb-1">
                        <span className="text-slate-500 uppercase">v:</span>
                        <span className="font-bold text-purple-500">{physics.v.toFixed(2)}</span>
                     </div>
                     <div className="flex justify-between border-b border-white/5 pb-1">
                        <span className="text-slate-500 uppercase">m:</span>
                        <span className="font-bold text-green-500">{Math.abs(physics.m).toFixed(2)}</span>
                     </div>
                  </div>
               </div>
            </div>
          )}

          {/* Floating Action Buttons */}
          <div className="absolute top-4 right-4 flex flex-col gap-2 md:gap-3 z-50">
             <button 
               onClick={() => {setZoom(1.0); setPanOffset({x:0, y:0});}} 
               className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center transition-all ${glassPanel} border-none shadow-lg`}
               title="Reset View"
             >
                <Maximize className="w-4 h-4 md:w-5 md:h-5 text-blue-500" />
             </button>
          </div>
        </main>
      </div>
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 3px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(59, 130, 246, 0.15); border-radius: 10px; }
      `}</style>
    </div>
  );
};

const ToggleButton = ({ label, active, onClick, color, theme }) => {
  const activeClass = theme === 'dark' ? 'bg-white/10 border-white/20 text-white' : 'bg-white border-slate-200 shadow-md text-slate-900';
  const inactiveClass = theme === 'dark' ? 'bg-black/20 border-white/5 text-slate-500' : 'bg-slate-100 border-slate-200 text-slate-400 opacity-60';
  
  return (
    <button 
      onClick={onClick} 
      className={`flex items-center justify-between px-3 md:px-4 py-2.5 md:py-3.5 rounded-[16px] md:rounded-[20px] border transition-all duration-300 text-[9px] md:text-[10px] font-black uppercase tracking-[0.1em] ${active ? activeClass : inactiveClass}`}
    >
      <div className="flex items-center gap-2 md:gap-3">
        <div 
          className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full transition-all duration-500 ${active ? 'scale-125' : 'scale-100 opacity-20'}`} 
          style={{
            backgroundColor: active ? color : '#475569',
            boxShadow: active ? `0 0 10px ${color}` : 'none'
          }} 
        />
        {label}
      </div>
      {active ? <Eye className="w-3.5 h-3.5 text-blue-500" /> : <EyeOff className="w-3.5 h-3.5 opacity-30" />}
    </button>
  );
};

const SliderWithInput = ({ label, val, min, max, unit, onChange, color, theme, icon }) => {
  const accentColors = { blue: 'accent-blue-500', amber: 'accent-amber-500', red: 'accent-red-500' };
  const inputBg = theme === 'dark' ? 'bg-black/30' : 'bg-white';
  const labelColor = theme === 'dark' ? 'text-slate-500' : 'text-slate-400';
  const textColor = theme === 'dark' ? 'text-white' : 'text-slate-900';

  return (
    <div className="space-y-3 group">
      <div className="flex justify-between items-center text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em]">
        <div className="flex items-center gap-2">
           <span className="opacity-40">{icon}</span>
           <span className={`${labelColor}`}>{label}</span>
        </div>
        <div className={`flex items-center px-3 py-1.5 rounded-xl ${inputBg} border border-white/5`}>
          <input 
            type="number" 
            inputMode="decimal"
            value={val} 
            onChange={(e) => {
              const num = parseFloat(e.target.value);
              if (!isNaN(num)) onChange(num);
            }}
            className={`w-10 md:w-12 bg-transparent font-mono text-center outline-none ${textColor} text-[10px] md:text-[11px] font-bold`}
          />
          <span className={`text-[8px] ml-1 font-black opacity-30`}>{unit}</span>
        </div>
      </div>
      
      <div className="relative flex items-center h-4">
        <div className={`absolute inset-0 h-1 my-auto rounded-full ${theme === 'dark' ? 'bg-white/5' : 'bg-slate-200'}`} />
        <input 
          type="range" min={min} max={max} step="0.5" value={val} 
          onChange={(e) => onChange(Number(e.target.value))} 
          className={`relative z-10 w-full h-1.5 rounded-full appearance-none cursor-pointer bg-transparent ${accentColors[color]}`} 
        />
      </div>
    </div>
  );
};

export default App;
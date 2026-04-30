import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Zap, Settings, Trash2, Box, Layers, 
  Activity, ToggleRight, MousePointer2,
  Lightbulb, AlertTriangle, Hand,
  Maximize, Minimize, Moon, Sun,
  ZoomIn, ZoomOut, ChevronUp, X,
  Info, Cpu, Plus
} from 'lucide-react';

// --- CSS for Advanced Animations & Glassmorphism ---
const styles = `
  @keyframes flow-horizontal {
    to { stroke-dashoffset: -20; }
  }
  @keyframes flow-vertical {
    to { stroke-dashoffset: -20; }
  }
  @keyframes pulse-glow {
    0%, 100% { opacity: 0.6; transform: scale(1); }
    50% { opacity: 1; transform: scale(1.05); }
  }
  .wire-flow { animation: flow-horizontal var(--speed, 1s) linear infinite; }
  .wire-flow-v { animation: flow-vertical var(--speed, 1s) linear infinite; }
  .paused { animation-play-state: paused; }
  
  .glass-card {
    background: rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.15);
    box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.3);
  }
  
  .dark .glass-card {
    background: rgba(15, 23, 42, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .no-scrollbar::-webkit-scrollbar { display: none; }
  .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

  .blueprint-bg {
    background-image: 
      radial-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 0),
      linear-gradient(to right, rgba(255, 255, 255, 0.02) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
    background-size: 40px 40px, 20px 20px, 20px 20px;
  }

  .active-tool-ring {
    box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.4);
  }

  .drag-ghost {
    position: fixed;
    pointer-events: none;
    z-index: 10000;
    transform: translate(-50%, -50%);
    opacity: 0.9;
    filter: drop-shadow(0 0 15px rgba(99, 102, 241, 0.4));
  }
`;

// --- Circuit Math Engine ---
const generateId = () => Math.random().toString(36).substr(2, 9);

const calculateReq = (node) => {
  if (!node) return Infinity; 
  if (node.type === 'resistor' || node.type === 'bulb') return Math.max(0.001, node.resistance);
  if (node.type === 'switch') return node.closed ? 0 : Infinity;
  
  if (node.type === 'series') {
    if (!node.children || node.children.length === 0) return 0; 
    return node.children.reduce((sum, child) => sum + calculateReq(child), 0);
  }
  
  if (node.type === 'parallel') {
    if (!node.children || node.children.length === 0) return Infinity; 
    let hasZeroBranch = false;
    let sumInv = node.children.reduce((sum, child) => {
      let req = calculateReq(child);
      if (req === 0) hasZeroBranch = true;
      return sum + (req > 0 && req < Infinity ? 1 / req : 0);
    }, 0);
    if (hasZeroBranch) return 0; 
    if (sumInv === 0) return Infinity; 
    return 1 / sumInv;
  }
  return 0;
};

const calculateVI = (node, vIn, iIn) => {
  let req = calculateReq(node);
  let result = { ...node, v: vIn, i: iIn, req: req };

  if (node.type === 'resistor' || node.type === 'switch' || node.type === 'bulb') {
    // Basic values
  } else if (node.type === 'series') {
    let openCount = node.children.filter(c => calculateReq(c) === Infinity).length;
    result.children = node.children.map(child => {
      let childReq = calculateReq(child);
      let childV = (req === Infinity) 
        ? ((childReq === Infinity && openCount > 0) ? vIn / openCount : 0)
        : (iIn * childReq);
      return calculateVI(child, childV, iIn);
    });
  } else if (node.type === 'parallel') {
    result.children = node.children.map(child => {
      let childReq = calculateReq(child);
      let childI = (childReq === 0) ? (req === 0 ? iIn : iIn) : (childReq < Infinity ? vIn / childReq : 0);
      return calculateVI(child, vIn, childI);
    });
  }
  return result;
};

const insertNode = (node, parentId, index, newNode) => {
  if (node.id === parentId) {
    const newChildren = [...(node.children || [])];
    newChildren.splice(index, 0, newNode);
    return { ...node, children: newChildren };
  }
  if (node.children) return { ...node, children: node.children.map(c => insertNode(c, parentId, index, newNode)) };
  return node;
};

const deleteNode = (node, id) => {
  if (node.children) return { ...node, children: node.children.filter(c => c.id !== id).map(c => deleteNode(c, id)) };
  return node;
};

const updateNode = (node, id, updates) => {
  if (node.id === id) return { ...node, ...updates };
  if (node.children) return { ...node, children: node.children.map(c => updateNode(c, id, updates)) };
  return node;
};

// --- Sub-Components ---

const Wires = ({ i, horizontal = true }) => {
  const isFlowing = i > 0.001;
  const speed = isFlowing ? Math.max(0.15, 1.5 / i) : 0; 
  return (
    <div className={`flex items-center justify-center shrink-0 ${horizontal ? 'w-6 md:w-10 h-2' : 'h-6 md:h-10 w-2'}`}>
      <svg width={horizontal ? "100%" : "4"} height={horizontal ? "4" : "100%"} className="overflow-visible">
        <line 
          x1="0" y1="0" x2={horizontal ? "100%" : "0"} y2={horizontal ? "0" : "100%"} 
          stroke={isFlowing ? "#fcd34d" : "#475569"} strokeWidth="3" strokeLinecap="round" strokeDasharray="6,8"
          className={`${horizontal ? 'wire-flow' : 'wire-flow-v'} ${!isFlowing ? 'paused' : ''}`}
          style={{ '--speed': `${speed}s`, filter: isFlowing ? 'drop-shadow(0 0 4px #fbbf24)' : 'none' }}
        />
      </svg>
    </div>
  );
};

const ToolButton = ({ type, icon: Icon, label, selectedTool, onPointerDown }) => (
  <button 
    onPointerDown={(e) => onPointerDown(e, type)}
    className={`group relative flex flex-col items-center justify-center p-2 md:p-3 rounded-2xl transition-all duration-300 transform active:scale-90 select-none touch-none
      ${selectedTool === type 
        ? 'bg-indigo-500 text-white active-tool-ring scale-110' 
        : 'bg-white/10 dark:bg-slate-800/40 text-slate-400 hover:text-white hover:bg-white/20 border border-white/10'}`}
  >
    <div className="mb-1 pointer-events-none">
      {type === 'resistor' ? (
        <div className={`w-8 h-2 rounded-full transition-colors ${selectedTool === type ? 'bg-white' : 'bg-orange-400'}`} />
      ) : (
        <Icon size={22} className="transition-transform group-hover:scale-110" />
      )}
    </div>
    <span className="text-[10px] md:text-xs font-bold tracking-tight uppercase opacity-80 pointer-events-none">{label}</span>
  </button>
);

// --- Main App ---

export default function App() {
  const [batteryVoltage, setBatteryVoltage] = useState(12);
  const [selectedId, setSelectedId] = useState('root');
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [lastPanPos, setLastPanPos] = useState(null);
  const [showMultimeterMobile, setShowMultimeterMobile] = useState(false);
  
  // Unified Drag State
  const [draggingTool, setDraggingTool] = useState({ active: false, type: null, x: 0, y: 0 });
  const [selectedTool, setSelectedTool] = useState(null);

  useEffect(() => {
    const handleFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFs);
    return () => document.removeEventListener('fullscreenchange', handleFs);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen();
    else if (document.exitFullscreen) document.exitFullscreen();
  };

  const [circuitTemplate, setCircuitTemplate] = useState({
    type: 'series', id: 'root', name: 'Main Circuit', children: []
  });

  const circuit = useMemo(() => {
    let req = calculateReq(circuitTemplate);
    let totalI = (req > 0 && req < Infinity) ? batteryVoltage / req : (req === 0 ? 99.99 : 0);
    return calculateVI(circuitTemplate, batteryVoltage, totalI);
  }, [circuitTemplate, batteryVoltage]);

  const isShortCircuit = circuit.i > 40;

  const handleDropComplete = (parentId, index, type) => {
    if (!type) return;
    let newNode = { type, id: generateId(), name: `${type.charAt(0).toUpperCase() + type.slice(1)}` };
    if (type === 'resistor') newNode.resistance = 10;
    if (type === 'bulb') newNode.resistance = 15;
    if (type === 'switch') newNode.closed = false;
    if (type === 'series' || type === 'parallel') newNode.children = [];
    setCircuitTemplate(prev => insertNode(prev, parentId, index, newNode));
    setDraggingTool({ active: false, type: null, x: 0, y: 0 });
    setSelectedTool(null);
  };

  const findNode = (node, id) => {
    if (node.id === id) return node;
    if (node.children) {
      for (let child of node.children) {
        let found = findNode(child, id);
        if (found) return found;
      }
    }
    return null;
  };
  const selectedNode = findNode(circuit, selectedId);

  // --- Unified Pointer Handlers ---
  const handleToolPointerDown = (e, type) => {
    e.stopPropagation();
    setDraggingTool({ active: true, type, x: e.clientX, y: e.clientY });
    setSelectedTool(type);
  };

  const handleGlobalPointerMove = (e) => {
    if (draggingTool.active) {
      setDraggingTool(prev => ({ ...prev, x: e.clientX, y: e.clientY }));
      return;
    }

    if (isPanning && lastPanPos) {
      setPan(prev => ({ x: prev.x + (e.clientX - lastPanPos.x), y: prev.y + (e.clientY - lastPanPos.y) }));
      setLastPanPos({ x: e.clientX, y: e.clientY });
    }
  };

  const handleGlobalPointerUp = (e) => {
    if (draggingTool.active) {
      const dropZone = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-dropzone="true"]');
      if (dropZone) {
        const parentId = dropZone.getAttribute('data-parent-id');
        const index = parseInt(dropZone.getAttribute('data-index'), 10);
        handleDropComplete(parentId, index, draggingTool.type);
      } else {
        // If not dropped on a zone, we keep it "selected" for tap-to-place fallback
        setDraggingTool({ active: false, type: null, x: 0, y: 0 });
      }
    }

    setIsPanning(false);
    setLastPanPos(null);
  };

  const handleWorkspacePointerDown = (e) => {
    if (e.target.closest('[data-no-pan="true"]')) return;
    setIsPanning(true);
    setLastPanPos({ x: e.clientX, y: e.clientY });
  };

  const renderSimulationNode = (node) => {
    const isSelected = node.id === selectedId;
    const baseClass = `relative rounded-2xl border-2 transition-all duration-300 cursor-pointer flex flex-col items-center justify-center group
      ${isSelected ? 'border-indigo-400 ring-4 ring-indigo-400/30 scale-105 z-20' : 'border-white/10 hover:border-indigo-300/50 hover:bg-white/5 z-10'}`;

    const renderTrash = () => (
      <button 
        onClick={(e) => { e.stopPropagation(); setCircuitTemplate(prev => deleteNode(prev, node.id)); if (selectedId === node.id) setSelectedId('root'); }} 
        className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full p-2 opacity-0 group-hover:opacity-100 transition-all hover:scale-110 shadow-lg z-50"
      >
        <Trash2 size={12}/>
      </button>
    );

    if (node.type === 'resistor') {
      return (
        <div data-no-pan="true" key={node.id} onClick={(e) => { e.stopPropagation(); setSelectedId(node.id); setShowMultimeterMobile(true); }} className={`${baseClass} glass-card w-20 h-16 md:w-28 md:h-20`}>
          {renderTrash()}
          <div className="w-12 md:w-16 h-3 md:h-5 bg-orange-200/20 rounded-full flex items-center justify-around px-1 border border-orange-400/50 pointer-events-none">
            <div className="w-1 h-full bg-red-500/80"></div>
            <div className="w-1 h-full bg-yellow-500/80"></div>
            <div className="w-1 h-full bg-amber-800/80"></div>
          </div>
          <span className="text-[10px] md:text-xs font-mono mt-2 text-white/70">{node.resistance}Ω</span>
        </div>
      );
    }

    if (node.type === 'bulb') {
      const power = (node.v || 0) * (node.i || 0);
      const isOn = power > 0.05;
      const glowScale = Math.min(1.5, power / 15);
      return (
        <div data-no-pan="true" key={node.id} onClick={(e) => { e.stopPropagation(); setSelectedId(node.id); setShowMultimeterMobile(true); }} className={`${baseClass} glass-card w-20 h-20 md:w-28 md:h-28 overflow-hidden`}>
          {renderTrash()}
          {isOn && (
            <div 
              className="absolute inset-0 bg-yellow-400/20 blur-2xl animate-pulse" 
              style={{ transform: `scale(${1 + glowScale})` }}
            />
          )}
          <Lightbulb 
            size={32} 
            className={`transition-all duration-500 ${isOn ? 'text-yellow-300 drop-shadow-[0_0_15px_#fcd34d]' : 'text-slate-600'}`} 
          />
          <span className="text-[9px] font-mono mt-2 text-white/50">{power.toFixed(1)}W</span>
        </div>
      );
    }

    if (node.type === 'switch') {
      return (
        <div data-no-pan="true" key={node.id} onClick={(e) => { e.stopPropagation(); setSelectedId(node.id); setShowMultimeterMobile(true); }} className={`${baseClass} glass-card w-20 h-16 md:w-28 md:h-20`}>
          {renderTrash()}
          <div 
            onClick={(e) => { e.stopPropagation(); setCircuitTemplate(prev => updateNode(prev, node.id, { closed: !node.closed })); }}
            className={`w-12 h-6 md:w-16 md:h-8 rounded-full border flex items-center px-1 transition-all duration-300 ${node.closed ? 'bg-emerald-500/30 border-emerald-400' : 'bg-slate-700/50 border-slate-500'}`}
          >
            <div className={`w-4 h-4 md:w-6 md:h-6 rounded-full shadow-lg transform transition-transform duration-300 ${node.closed ? 'translate-x-6 md:translate-x-8 bg-emerald-400' : 'translate-x-0 bg-white'}`} />
          </div>
          <span className="text-[9px] font-bold mt-1 text-white/50">{node.closed ? 'CLOSED' : 'OPEN'}</span>
        </div>
      );
    }

    if (node.type === 'series') {
      const isRoot = node.id === 'root';
      return (
        <div data-no-pan="true" key={node.id} onClick={(e) => { e.stopPropagation(); setSelectedId(node.id); }} className={`${!isRoot ? baseClass + ' glass-card p-4 border-dashed border-indigo-400/30' : 'flex-1'} flex items-center min-h-[120px]`}>
          {!isRoot && renderTrash()}
          <div className="flex flex-row items-center justify-center gap-1">
             <DropZone parentId={node.id} index={0} onDropComplete={handleDropComplete} isVisible={draggingTool.active || !!selectedTool} />
             {node.children?.map((child, idx) => (
               <React.Fragment key={child.id}>
                 {renderSimulationNode(child)}
                 <DropZone parentId={node.id} index={idx + 1} onDropComplete={handleDropComplete} isVisible={draggingTool.active || !!selectedTool} />
                 {idx < node.children.length - 1 && !draggingTool.active && !selectedTool && <Wires i={child.i} horizontal={true}/>}
               </React.Fragment>
             ))}
             {node.children?.length === 0 && !draggingTool.active && !selectedTool && (
               <div className="px-6 py-3 rounded-xl border border-dashed border-white/20 text-white/20 text-xs italic">Drop Zone Ready</div>
             )}
          </div>
        </div>
      );
    }

    if (node.type === 'parallel') {
      return (
        <div data-no-pan="true" key={node.id} onClick={(e) => { e.stopPropagation(); setSelectedId(node.id); }} className={`${baseClass} glass-card p-6 min-w-[200px] border-emerald-400/20`}>
          {renderTrash()}
          <div className="flex flex-col items-center gap-4 w-full relative">
            <div className="absolute left-6 top-2 bottom-2 w-0.5 bg-emerald-400/20" />
            <div className="absolute right-6 top-2 bottom-2 w-0.5 bg-emerald-400/20" />
            {node.children?.map((child) => (
              <div key={child.id} className="flex items-center w-full justify-center px-6">
                <Wires i={child.i} horizontal={true}/>
                <div className="flex-1 flex justify-center">{renderSimulationNode(child)}</div>
                <Wires i={child.i} horizontal={true}/>
              </div>
            ))}
            <DropZone parentId={node.id} index={node.children?.length || 0} onDropComplete={handleDropComplete} isVisible={draggingTool.active || !!selectedTool} />
          </div>
        </div>
      );
    }
  };

  const DropZone = ({ parentId, index, onDropComplete, isVisible }) => {
    if (!isVisible) return null;
    return (
      <div 
        data-dropzone="true"
        data-parent-id={parentId}
        data-index={index}
        data-no-pan="true"
        onClick={(e) => { 
          e.stopPropagation(); 
          if(selectedTool) handleDropComplete(parentId, index, selectedTool); 
        }}
        className={`w-14 h-14 md:w-20 md:h-20 border-2 border-dashed rounded-2xl flex items-center justify-center transition-all duration-300 mx-1 cursor-pointer
          bg-indigo-500/10 border-indigo-400/40 hover:bg-indigo-500/20 hover:border-indigo-400 hover:scale-105 shadow-[inset_0_0_15px_rgba(99,102,241,0.1)]`}
      >
        <div className="flex flex-col items-center justify-center gap-1">
           <Plus size={24} className="text-indigo-400 animate-pulse" />
           <span className="text-[8px] font-black text-indigo-300 uppercase tracking-tighter">Drop</span>
        </div>
      </div>
    );
  };

  const GhostIcon = ({ type, x, y }) => {
    const IconMap = {
      resistor: () => <div className="w-12 h-3 bg-orange-400 rounded-full" />,
      bulb: Lightbulb,
      switch: ToggleRight,
      series: Layers,
      parallel: Box
    };
    const Component = IconMap[type];
    return (
      <div className="drag-ghost glass-card p-4 rounded-2xl border-indigo-400 border-2 text-indigo-400" style={{ left: x, top: y }}>
        {type === 'resistor' ? Component() : <Component size={32} />}
      </div>
    );
  };

  return (
    <div className={isDarkMode ? 'dark' : ''}>
      <style>{styles}</style>
      <div 
        className="h-[100dvh] bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans flex flex-col overflow-hidden transition-colors duration-500 blueprint-bg touch-none"
        onPointerMove={handleGlobalPointerMove}
        onPointerUp={handleGlobalPointerUp}
      >
        
        {draggingTool.active && <GhostIcon type={draggingTool.type} x={draggingTool.x} y={draggingTool.y} />}

        {/* Floating Header */}
        <header className="fixed top-4 left-1/2 -translate-x-1/2 w-[92%] max-w-4xl glass-card h-14 md:h-16 rounded-2xl flex items-center justify-between px-4 md:px-6 z-50 transition-all duration-500">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl transition-all duration-500 ${isShortCircuit ? 'bg-red-500 animate-pulse shadow-[0_0_15px_#ef4444]' : 'bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.5)]'}`}>
              <Zap size={20} fill="currentColor" className="text-white"/>
            </div>
            <div>
              <h1 className="text-sm md:text-lg font-black tracking-tight uppercase italic leading-none">Circuit<span className="text-indigo-400">Assembler</span></h1>
              <p className="text-[8px] md:text-[10px] font-bold text-white/40 tracking-widest uppercase mt-0.5">Quantum VirtLab v2.5</p>
            </div>
          </div>
          <div className="flex items-center gap-2" data-no-pan="true">
            <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
              {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button onClick={toggleFullscreen} className="hidden sm:block p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
              {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
            </button>
          </div>
        </header>

        {/* Main Workspace */}
        <main 
          className={`flex-1 relative overflow-hidden transition-all duration-300 ${isPanning ? 'cursor-grabbing' : 'cursor-grab'} touch-none`}
          onPointerDown={handleWorkspacePointerDown}
          onWheel={(e) => setZoom(z => Math.max(0.4, Math.min(2.5, z + (e.deltaY < 0 ? 0.1 : -0.1))))}
        >
          {/* Zoom/Reset Controls */}
          <div className="absolute right-6 top-24 flex flex-col gap-3 z-30" data-no-pan="true">
              <button onClick={() => setZoom(z => Math.min(2.5, z + 0.2))} className="w-10 h-10 glass-card rounded-xl flex items-center justify-center hover:bg-white/20 transition-all"><ZoomIn size={20}/></button>
              <button onClick={() => {setZoom(1); setPan({x:0, y:0})}} className="w-10 h-10 glass-card rounded-xl flex items-center justify-center font-mono text-[10px] font-bold hover:bg-white/20 transition-all">{Math.round(zoom*100)}%</button>
              <button onClick={() => setZoom(z => Math.max(0.4, z - 0.2))} className="w-10 h-10 glass-card rounded-xl flex items-center justify-center hover:bg-white/20 transition-all"><ZoomOut size={20}/></button>
          </div>

          <div 
            style={{ transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${zoom})`, transformOrigin: 'center' }}
            className="absolute top-1/2 left-1/2 flex items-center justify-center min-w-[300px]"
          >
            {/* Power Source (Battery) */}
            <div data-no-pan="true" className="mr-8 flex flex-col items-center">
              <div className="text-indigo-400 font-mono text-xs font-bold mb-2">{batteryVoltage}V</div>
              <div className={`w-14 h-24 md:w-20 md:h-32 glass-card rounded-2xl flex flex-col items-center overflow-hidden transition-all duration-500 ${isShortCircuit ? 'border-red-500 shadow-[0_0_30px_#ef4444]' : 'border-indigo-500/50'}`}>
                  <div className="h-4 w-full bg-indigo-500 flex items-center justify-center text-[10px] font-bold">+</div>
                  <div className="flex-1 flex flex-col items-center justify-center gap-2">
                     <Zap size={24} className={isShortCircuit ? 'text-red-400' : 'text-indigo-400'} />
                     {isShortCircuit && <AlertTriangle size={16} className="text-red-400 animate-bounce"/>}
                  </div>
                  <div className="h-4 w-full bg-slate-800 flex items-center justify-center text-[10px] font-bold">-</div>
              </div>
              <Wires i={circuit.i} horizontal={false}/>
            </div>

            {/* Circuit Core */}
            <div className="p-8 md:p-12 glass-card rounded-[3rem] border-dashed border-2 border-white/10 relative">
               <div className="absolute -left-1 w-1 top-[45%] bottom-[45%] bg-indigo-400 rounded-full shadow-[0_0_10px_#818cf8]" />
               {renderSimulationNode(circuit)}
            </div>
          </div>

          {/* Placement Hint */}
          {(draggingTool.active || selectedTool) && (
             <div className="absolute top-24 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
                <div className="px-6 py-2 bg-indigo-500 text-white rounded-full text-xs font-black uppercase tracking-[0.2em] shadow-2xl flex items-center gap-3 border border-white/20">
                   <div className="w-2 h-2 bg-white rounded-full animate-ping" />
                   Dropping {draggingTool.type || selectedTool}: Hover over a zone
                </div>
             </div>
          )}

          {!circuitTemplate.children?.length && !draggingTool.active && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="px-8 py-4 glass-card rounded-3xl animate-bounce flex items-center gap-4 text-white/60">
                <Hand size={24} />
                <span className="font-bold tracking-tight">Drag a tool to the workspace</span>
              </div>
            </div>
          )}
        </main>

        {/* Floating Dock (Footer) */}
        <footer className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[96%] max-w-2xl glass-card rounded-3xl p-3 md:p-4 z-50 flex flex-col gap-4 transition-all duration-500">
          <div className="flex items-center justify-between gap-4">
             <div className="flex-1 flex items-center gap-3 glass-card px-4 h-12 rounded-2xl" data-no-pan="true">
               <Cpu size={18} className="text-indigo-400" />
               <input 
                 type="range" min="1" max="100" value={batteryVoltage} 
                 onChange={(e) => setBatteryVoltage(Number(e.target.value))} 
                 className="flex-1 accent-indigo-500 h-1.5 bg-white/10 rounded-full"
               />
               <span className="font-mono text-xs font-bold w-10 text-right">{batteryVoltage}V</span>
             </div>
             
             {/* Stats Bubble */}
             <div className={`hidden sm:flex items-center gap-4 glass-card px-6 h-12 rounded-2xl font-mono text-xs
               ${isShortCircuit ? 'border-red-500 text-red-400 animate-pulse' : 'text-emerald-400'}`}>
                <div className="flex flex-col">
                  <span className="text-[8px] uppercase text-white/30">Resistance</span>
                  <span>{circuit.req > 999 ? '∞' : circuit.req.toFixed(1)} Ω</span>
                </div>
                <div className="flex flex-col border-l border-white/10 pl-4">
                  <span className="text-[8px] uppercase text-white/30">Current</span>
                  <span>{circuit.i.toFixed(2)} A</span>
                </div>
             </div>

             <button 
               onClick={() => setShowMultimeterMobile(true)}
               className="sm:hidden glass-card w-12 h-12 rounded-2xl flex items-center justify-center text-indigo-400"
               data-no-pan="true"
             >
               <Activity size={20} />
             </button>
          </div>

          <div className="flex items-center justify-center gap-2 md:gap-4 overflow-x-auto no-scrollbar py-1" data-no-pan="true">
            <ToolButton type="resistor" label="Res" selectedTool={selectedTool} onPointerDown={handleToolPointerDown} />
            <ToolButton type="bulb" icon={Lightbulb} label="Bulb" selectedTool={selectedTool} onPointerDown={handleToolPointerDown} />
            <ToolButton type="switch" icon={ToggleRight} label="Swi" selectedTool={selectedTool} onPointerDown={handleToolPointerDown} />
            <ToolButton type="series" icon={Layers} label="Ser" selectedTool={selectedTool} onPointerDown={handleToolPointerDown} />
            <ToolButton type="parallel" icon={Box} label="Par" selectedTool={selectedTool} onPointerDown={handleToolPointerDown} />
          </div>
        </footer>

        {/* Multimeter Overlay */}
        <div 
          className={`fixed inset-x-0 bottom-0 lg:left-auto lg:inset-y-0 lg:right-0 lg:w-80 glass-card rounded-t-[2.5rem] lg:rounded-none z-[60] transition-transform duration-500 border-t lg:border-t-0 lg:border-l border-white/10
          ${showMultimeterMobile || selectedId !== 'root' ? 'translate-y-0 lg:translate-x-0' : 'translate-y-full lg:translate-x-full'}`}
          data-no-pan="true"
        >
          <div className="h-full flex flex-col p-6 overflow-y-auto">
             <div className="flex items-center justify-between mb-8">
               <div className="flex items-center gap-3">
                 <Activity className="text-red-500 animate-pulse" />
                 <h2 className="text-sm font-black uppercase tracking-widest">Diagnostic Pro</h2>
               </div>
               <button onClick={() => {setShowMultimeterMobile(false); setSelectedId('root');}} className="p-2 glass-card rounded-full"><X size={16}/></button>
             </div>

             {selectedNode ? (
               <div className="space-y-6">
                 <div className="glass-card p-6 rounded-3xl">
                    <p className="text-[10px] uppercase font-bold text-white/30 tracking-widest mb-1">Active Component</p>
                    <h3 className="text-xl font-black italic">{selectedNode.name}</h3>
                    <div className="mt-4 grid grid-cols-2 gap-4">
                       <div className="flex flex-col">
                         <span className="text-[9px] text-indigo-300 font-bold uppercase">Potential</span>
                         <span className="text-lg font-mono text-white">{selectedNode.v.toFixed(2)}V</span>
                       </div>
                       <div className="flex flex-col">
                         <span className="text-[9px] text-emerald-300 font-bold uppercase">Current</span>
                         <span className="text-lg font-mono text-white">{selectedNode.i.toFixed(2)}A</span>
                       </div>
                    </div>
                 </div>

                 <div className="grid grid-cols-1 gap-4">
                   <div className="glass-card p-4 rounded-2xl flex justify-between items-center">
                     <span className="text-xs text-white/40 font-bold">Impedance</span>
                     <span className="text-md font-mono text-blue-400">{selectedNode.req > 999 ? '∞' : selectedNode.req.toFixed(1)}Ω</span>
                   </div>
                   <div className="glass-card p-4 rounded-2xl flex justify-between items-center">
                     <span className="text-xs text-white/40 font-bold">Dissipation</span>
                     <span className="text-md font-mono text-purple-400">{(selectedNode.v * selectedNode.i).toFixed(1)}W</span>
                   </div>
                 </div>

                 {(selectedNode.type === 'resistor' || selectedNode.type === 'bulb') && (
                   <div className="glass-card p-6 rounded-3xl">
                     <label className="text-[10px] text-white/40 uppercase font-black block mb-4">Calibrate Resistance (Ω)</label>
                     <input 
                        type="range" min="1" max="100" step="1" 
                        value={selectedNode.resistance} 
                        onChange={(e) => setCircuitTemplate(prev => updateNode(prev, selectedNode.id, { resistance: Number(e.target.value) }))}
                        className="w-full accent-indigo-500 h-2 bg-white/5 rounded-full mb-2"
                     />
                     <div className="flex justify-between text-xs font-mono text-white/60">
                       <span>1Ω</span>
                       <span className="text-indigo-400 font-bold">{selectedNode.resistance}Ω</span>
                       <span>100Ω</span>
                     </div>
                   </div>
                 )}
               </div>
             ) : (
               <div className="flex-1 flex flex-col items-center justify-center opacity-30 text-center">
                 <Info size={48} className="mb-4" />
                 <p className="text-sm font-bold">Probe a component to start real-time telemetry</p>
               </div>
             )}

             <div className="mt-auto pt-8 flex items-center justify-center gap-2 text-[8px] font-bold text-white/20 uppercase tracking-[0.3em]">
               Secure Signal <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" /> Link Stable
             </div>
          </div>
        </div>

      </div>
    </div>
  );
}
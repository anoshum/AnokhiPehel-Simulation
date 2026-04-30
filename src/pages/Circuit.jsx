import React, { useState, useMemo, useEffect } from 'react';
import { 
  Zap, Settings, Trash2, Box, Layers, 
  Activity, ToggleRight, MousePointer2,
  Lightbulb, AlertTriangle, Hand,
  Maximize, Minimize, Moon, Sun,
  ZoomIn, ZoomOut
} from 'lucide-react';

// --- CSS for Electron Flow Animation ---
const styles = `
  @keyframes flow-horizontal {
    to { stroke-dashoffset: -20; }
  }
  @keyframes flow-vertical {
    to { stroke-dashoffset: -20; }
  }
  .wire-flow {
    animation: flow-horizontal var(--speed, 1s) linear infinite;
  }
  .wire-flow-v {
    animation: flow-vertical var(--speed, 1s) linear infinite;
  }
  .paused {
    animation-play-state: paused;
  }
  .no-scrollbar::-webkit-scrollbar {
    display: none;
  }
  .no-scrollbar {
    -ms-overflow-style: none;
    scrollbar-width: none;
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
  const speed = isFlowing ? Math.max(0.2, 2 / i) : 0; 
  return (
    <div className={`flex items-center justify-center shrink-0 ${horizontal ? 'w-4 md:w-8 h-2' : 'h-4 md:h-8 w-2'}`}>
      <svg width={horizontal ? "100%" : "4"} height={horizontal ? "4" : "100%"} className="overflow-visible">
        <line 
          x1="0" y1="0" x2={horizontal ? "100%" : "0"} y2={horizontal ? "0" : "100%"} 
          stroke={isFlowing ? "#fbbf24" : "#94a3b8"} strokeWidth="4" strokeLinecap="round" strokeDasharray="8,8"
          className={`${horizontal ? 'wire-flow' : 'wire-flow-v'} ${!isFlowing ? 'paused' : ''}`}
          style={{ '--speed': `${speed}s` }}
        />
      </svg>
    </div>
  );
};

const DropZone = ({ parentId, index, onDropComplete, isVisible, selectedTool, clearTool, isDraggingAny }) => {
  const [isOver, setIsOver] = useState(false);

  const handleDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; setIsOver(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setIsOver(false); };
  const handleDrop = (e) => {
    e.preventDefault(); e.stopPropagation(); setIsOver(false);
    const type = e.dataTransfer.getData('component_type');
    if (type) onDropComplete(parentId, index, type);
  };
  const handleClick = (e) => {
    e.stopPropagation();
    if (selectedTool) { onDropComplete(parentId, index, selectedTool); clearTool(); }
  };

  if (!isVisible) return null;
  return (
    <div className="relative group p-1 md:p-2 flex items-center justify-center z-20 shrink-0" data-no-pan="true">
      <div 
        data-dropzone="true"
        data-parent-id={parentId}
        data-index={index}
        onDragEnter={(e) => { e.preventDefault(); setIsOver(true); }}
        onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} onClick={handleClick}
        className={`transition-all duration-200 flex items-center justify-center relative
          ${isOver || selectedTool || isDraggingAny ? 'w-10 h-10 md:w-16 md:h-16 bg-indigo-500/20 border-indigo-400 scale-110 shadow-lg' : 'w-6 h-6 md:w-10 md:h-10 bg-slate-100 border-slate-300 hover:bg-indigo-50 hover:border-indigo-300'}
          border-2 border-dashed rounded-lg cursor-pointer m-0.5 md:m-1`}
      >
        <div className="absolute -inset-4 md:-inset-6 z-0 pointer-events-auto" /> 
        <div className={`w-2 h-2 md:w-3 md:h-3 rounded-full relative z-10 ${isOver || selectedTool || isDraggingAny ? 'bg-indigo-500 animate-ping' : 'bg-slate-300 group-hover:bg-indigo-400'}`} />
      </div>
    </div>
  );
};

const ToolButton = ({ type, icon: Icon, label, selectedTool, onSelect, setIsDragging, setTouchDrag }) => (
  <div 
    draggable 
    onDragStart={(e) => {
      e.dataTransfer.setData('component_type', type);
      e.dataTransfer.effectAllowed = 'copy';
      setTimeout(() => setIsDragging(true), 10);
      onSelect(null);
    }}
    onDragEnd={() => setIsDragging(false)}
    onTouchStart={(e) => {
      const touch = e.touches[0];
      setTouchDrag({ 
        type, startX: touch.clientX, startY: touch.clientY, 
        x: touch.clientX, y: touch.clientY, isDragging: false 
      });
    }}
    onClick={() => onSelect(selectedTool === type ? null : type)}
    className={`border rounded-lg p-2 md:p-3 flex flex-col items-center justify-center cursor-grab active:cursor-grabbing transition-colors shrink-0 min-w-[64px] md:min-w-[80px] select-none touch-pan-x
      ${selectedTool === type ? 'bg-indigo-100 dark:bg-indigo-600 border-indigo-400 ring-2 ring-indigo-400 ring-offset-1 ring-offset-white dark:ring-offset-slate-800' : 'bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 border-slate-300 dark:border-slate-600 shadow-sm'}`}
  >
    <div className="mb-1 md:mb-2 flex items-center justify-center h-4 md:h-6 pointer-events-none">
      {type === 'resistor' ? <div className="w-6 md:w-8 h-2 md:h-3 bg-orange-300 rounded-full" /> 
       : <Icon size={18} className={type==='bulb'?'text-yellow-500 dark:text-yellow-300':type==='switch'?'text-slate-600 dark:text-slate-300':type==='series'?'text-blue-500 dark:text-blue-300':'text-emerald-500 dark:text-emerald-300'} />}
    </div>
    <span className="text-[9px] md:text-xs font-medium text-slate-700 dark:text-slate-200 text-center leading-tight pointer-events-none">{label}</span>
  </div>
);

// --- Main App ---

export default function App() {
  const [batteryVoltage, setBatteryVoltage] = useState(12);
  const [selectedId, setSelectedId] = useState('root');
  
  // Drag, Drop, and Tools State
  const [isDragging, setIsDragging] = useState(false);
  const [touchDrag, setTouchDrag] = useState(null);
  const [selectedTool, setSelectedTool] = useState(null); 
  
  // Canvas View State (Pan & Zoom)
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [lastPanPos, setLastPanPos] = useState(null);

  // Environment State
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);

  useEffect(() => {
    // Inject Tailwind config just in case the environment loads it dynamically
    if (typeof window !== 'undefined' && window.tailwind) {
      window.tailwind.config = { ...window.tailwind.config, darkMode: 'class' };
    }
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(e => console.error(e));
    else document.exitFullscreen();
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };
  
  const [circuitTemplate, setCircuitTemplate] = useState({
    type: 'series', id: 'root', name: 'Main Loop', children: []
  });

  const circuit = useMemo(() => {
    let req = calculateReq(circuitTemplate);
    let totalI = (req > 0 && req < Infinity) ? batteryVoltage / req : (req === 0 ? 99.99 : 0);
    return calculateVI(circuitTemplate, batteryVoltage, totalI);
  }, [circuitTemplate, batteryVoltage]);

  const isShortCircuit = circuit.i > 50;

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

  const handleDropComplete = (parentId, index, type) => {
    let newNode = { type, id: generateId(), name: `${type.charAt(0).toUpperCase() + type.slice(1)}` };
    if (type === 'resistor') newNode.resistance = 10;
    if (type === 'bulb') newNode.resistance = 15;
    if (type === 'switch') newNode.closed = false;
    if (type === 'series' || type === 'parallel') newNode.children = [];
    setCircuitTemplate(prev => insertNode(prev, parentId, index, newNode));
    setIsDragging(false);
    setSelectedTool(null);
  };

  const removeComponent = (id) => {
    setCircuitTemplate(prev => deleteNode(prev, id));
    if (selectedId === id) setSelectedId('root');
  };

  // --- Pan and Zoom Handlers ---
  const handleWheel = (e) => {
    if (e.deltaY < 0) setZoom(z => Math.min(z + 0.15, 2.5));
    else setZoom(z => Math.max(z - 0.15, 0.4));
  };

  const handlePointerDown = (e) => {
    if (touchDrag?.isDragging || e.target.closest('[data-no-pan="true"]')) return;
    setIsPanning(true);
    setLastPanPos({ x: e.clientX, y: e.clientY });
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!isPanning || !lastPanPos) return;
    const dx = e.clientX - lastPanPos.x;
    const dy = e.clientY - lastPanPos.y;
    setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
    setLastPanPos({ x: e.clientX, y: e.clientY });
  };

  const handlePointerUp = (e) => {
    setIsPanning(false);
    setLastPanPos(null);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  // --- Mobile Specific Drag for Tools ---
  const handleTouchMove = (e) => {
    if (!touchDrag) return;
    const touch = e.touches[0];
    const dx = touch.clientX - touchDrag.startX;
    const dy = touch.clientY - touchDrag.startY;
    
    if (!touchDrag.isDragging && Math.sqrt(dx*dx + dy*dy) > 10) {
      setTouchDrag(prev => ({ ...prev, isDragging: true, x: touch.clientX, y: touch.clientY }));
      setSelectedTool(null);
    } else if (touchDrag.isDragging) {
      setTouchDrag(prev => ({ ...prev, x: touch.clientX, y: touch.clientY }));
    }
  };

  const handleTouchEnd = (e) => {
    if (!touchDrag) return;
    if (touchDrag.isDragging) {
      const touch = e.changedTouches[0];
      const dropTarget = document.elementFromPoint(touch.clientX, touch.clientY);
      const dropZone = dropTarget?.closest('[data-dropzone="true"]');
      
      if (dropZone) {
        const parentId = dropZone.getAttribute('data-parent-id');
        const index = parseInt(dropZone.getAttribute('data-index'), 10);
        handleDropComplete(parentId, index, touchDrag.type);
      }
    }
    setTouchDrag(null);
  };

  const showDropZones = isDragging || !!selectedTool || touchDrag?.isDragging;

  const renderSimulationNode = (node) => {
    const isSelected = node.id === selectedId;
    const baseClass = `group relative rounded-xl border-2 transition-all cursor-pointer flex flex-col items-center justify-center shadow-sm shrink-0
      ${isSelected ? 'ring-4 ring-indigo-400 border-indigo-500 scale-105 z-20' : 'border-slate-300 hover:border-indigo-300 hover:shadow-md z-10'}`;

    const renderTrashBtn = () => (
      <button 
        onClick={(e) => { e.stopPropagation(); removeComponent(node.id); }} 
        className={`absolute -top-2 -right-2 md:-top-3 md:-right-3 bg-red-500 text-white rounded-full p-1 md:p-1.5 transition-all z-50 shadow-md hover:bg-red-600 hover:scale-110
        ${isSelected ? 'opacity-100' : 'opacity-0 md:group-hover:opacity-100'}`}
      >
        <Trash2 size={12} className="md:w-3.5 md:h-3.5"/>
      </button>
    );

    if (node.type === 'resistor') {
      return (
        <div data-no-pan="true" key={node.id} onClick={(e) => { e.stopPropagation(); setSelectedId(node.id); }} className={`${baseClass} bg-orange-50 w-16 h-12 md:w-24 md:h-20`}>
          {renderTrashBtn()}
          <div className="w-10 md:w-16 h-3 md:h-6 bg-orange-200 rounded-full flex items-center justify-between px-1 md:px-2 border md:border-2 border-orange-400 pointer-events-none">
             <div className="w-[1px] md:w-1 h-full bg-red-500"></div>
             <div className="w-[1px] md:w-1 h-full bg-yellow-500"></div>
             <div className="w-[1px] md:w-1 h-full bg-black"></div>
          </div>
          <span className="text-[8px] md:text-xs font-bold mt-1 md:mt-2 text-slate-700 pointer-events-none">{node.resistance} Ω</span>
        </div>
      );
    }

    if (node.type === 'bulb') {
      const power = (node.v || 0) * (node.i || 0);
      const brightness = Math.min(1, power / 40); 
      const isOn = power > 0.05;
      return (
        <div data-no-pan="true" key={node.id} onClick={(e) => { e.stopPropagation(); setSelectedId(node.id); }} className={`${baseClass} bg-slate-800 w-16 h-16 md:w-24 md:h-24 overflow-hidden`}>
          {renderTrashBtn()}
          <div className="relative flex flex-col items-center justify-center w-full h-full pointer-events-none">
            <div className={`absolute inset-0 transition-opacity duration-300 ${isOn ? 'opacity-100' : 'opacity-0'}`} style={{ background: `radial-gradient(circle, rgba(250,204,21,${brightness * 0.8}) 0%, rgba(0,0,0,0) 70%)` }}></div>
            <Lightbulb size={20} className={`relative z-10 transition-colors duration-300 md:w-7 md:h-7 ${isOn ? 'text-yellow-300' : 'text-slate-500'}`} style={{ filter: isOn ? `drop-shadow(0 0 ${brightness * 10}px #fde047)` : 'none' }} />
            <span className="relative z-10 text-[7px] md:text-[10px] text-slate-300 mt-1 font-mono bg-slate-900/50 px-1 rounded">{power.toFixed(1)} W</span>
          </div>
        </div>
      );
    }

    if (node.type === 'switch') {
      return (
        <div data-no-pan="true" key={node.id} onClick={(e) => { e.stopPropagation(); setSelectedId(node.id); }} className={`${baseClass} bg-slate-50 w-16 h-12 md:w-24 md:h-20`}>
          {renderTrashBtn()}
          <div 
            onClick={(e) => { e.stopPropagation(); setCircuitTemplate(prev => updateNode(prev, node.id, { closed: !node.closed })); }}
            className={`w-8 md:w-14 h-4 md:h-8 rounded-full border md:border-2 flex items-center px-[1px] md:px-1 cursor-pointer transition-colors ${node.closed ? 'bg-green-100 border-green-400' : 'bg-slate-200 border-slate-400'}`}
          >
            <div className={`w-3 h-3 md:w-6 md:h-6 rounded-full shadow-sm transform transition-transform ${node.closed ? 'translate-x-4 md:translate-x-5 bg-green-500' : 'translate-x-0 bg-white'}`}></div>
          </div>
          <span className="text-[8px] md:text-xs font-bold mt-1 md:mt-2 text-slate-600 pointer-events-none">{node.closed ? 'CLOSED' : 'OPEN'}</span>
        </div>
      );
    }

    if (node.type === 'series') {
      const isRoot = node.id === 'root';
      return (
        <div data-no-pan="true" key={node.id} onClick={(e) => { e.stopPropagation(); setSelectedId(node.id); }} className={`${!isRoot ? baseClass + ' bg-blue-50/50 p-2 md:p-4 border-blue-200' : 'flex-1 w-full'} flex items-center min-h-[60px] md:min-h-[100px]`}>
          {!isRoot && (
            <>
              <div className="absolute top-0.5 md:top-1 left-1 md:left-2 text-[6px] md:text-[10px] text-blue-500 font-bold uppercase pointer-events-none">Series</div>
              {renderTrashBtn()}
            </>
          )}
          <div className="flex flex-row items-center w-full justify-center min-w-max px-1 md:px-0">
            <DropZone parentId={node.id} index={0} onDropComplete={handleDropComplete} isVisible={showDropZones} selectedTool={selectedTool} isDraggingAny={showDropZones} clearTool={() => setSelectedTool(null)} />
            {node.children && node.children.map((child, index) => (
              <React.Fragment key={child.id}>
                {renderSimulationNode(child)}
                <DropZone parentId={node.id} index={index + 1} onDropComplete={handleDropComplete} isVisible={showDropZones} selectedTool={selectedTool} isDraggingAny={showDropZones} clearTool={() => setSelectedTool(null)} />
                {index < node.children.length - 1 && !showDropZones && <Wires i={child.i} horizontal={true} />}
              </React.Fragment>
            ))}
            {node.children?.length === 0 && !showDropZones && (
              <div className="text-[8px] md:text-sm text-slate-400 italic bg-white p-1 md:p-2 rounded md:rounded-lg border border-dashed whitespace-nowrap pointer-events-none">Wire</div>
            )}
          </div>
        </div>
      );
    }

    if (node.type === 'parallel') {
      return (
        <div data-no-pan="true" key={node.id} onClick={(e) => { e.stopPropagation(); setSelectedId(node.id); }} className={`${baseClass} bg-emerald-50/50 p-3 md:p-6 border-emerald-200 min-w-[100px] md:min-w-[250px]`}>
          <div className="absolute top-0.5 md:top-1 left-1 md:left-2 text-[6px] md:text-[10px] text-emerald-600 font-bold uppercase pointer-events-none">Parallel</div>
          {renderTrashBtn()}
          <div className="flex flex-col items-center gap-1 md:gap-2 w-full relative mt-2 md:mt-0">
             <div className="absolute left-1 md:left-4 top-0 bottom-0 w-0.5 md:w-1 bg-emerald-300/50 pointer-events-none"></div>
             <div className="absolute right-1 md:right-4 top-0 bottom-0 w-0.5 md:w-1 bg-emerald-300/50 pointer-events-none"></div>

            {node.children && node.children.map((child, index) => (
              <div key={child.id} className="flex items-center w-full px-1 md:px-4 relative group justify-center">
                <Wires i={child.i} horizontal={true} />
                <div className="flex-1 flex justify-center z-10">{renderSimulationNode(child)}</div>
                <Wires i={child.i} horizontal={true} />
              </div>
            ))}
            
            <div className="mt-1 md:mt-4 z-10 bg-white rounded-full p-0.5 md:p-1 shadow-sm border border-emerald-200 flex items-center justify-center">
               <DropZone parentId={node.id} index={node.children ? node.children.length : 0} onDropComplete={handleDropComplete} isVisible={showDropZones} selectedTool={selectedTool} isDraggingAny={showDropZones} clearTool={() => setSelectedTool(null)} />
               {!showDropZones && <span className="text-[8px] md:text-xs text-emerald-600 font-medium px-1 md:px-2 whitespace-nowrap pointer-events-none">+ Branch</span>}
            </div>
          </div>
        </div>
      );
    }
  };

  // The wrapper guarantees Tailwind 'dark:' prefix works perfectly on descendants
  return (
    <div className={isDarkMode ? 'dark' : ''}>
      <div 
        className="h-[100dvh] bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-sans flex flex-col overflow-hidden select-none"
        onDragEnd={() => setIsDragging(false)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => e.preventDefault()}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <style>{styles}</style>
        
        {/* Ghost Mobile Drag Element */}
        {touchDrag?.isDragging && (
          <div 
            className="fixed z-[9999] pointer-events-none p-4 bg-white/90 dark:bg-slate-700/90 rounded-xl border-2 border-indigo-400 shadow-2xl backdrop-blur-sm flex flex-col items-center justify-center transform -translate-x-1/2 -translate-y-[120%]"
            style={{ left: touchDrag.x, top: touchDrag.y }}
          >
            {touchDrag.type === 'resistor' && <div className="w-10 h-3 bg-orange-300 rounded-full mb-1" />}
            {touchDrag.type === 'bulb' && <Lightbulb size={28} className="text-yellow-500 dark:text-yellow-300 mb-1" />}
            {touchDrag.type === 'switch' && <ToggleRight size={28} className="text-slate-600 dark:text-slate-300 mb-1" />}
            {touchDrag.type === 'series' && <Layers size={28} className="text-blue-500 dark:text-blue-300 mb-1" />}
            {touchDrag.type === 'parallel' && <Box size={28} className="text-emerald-500 dark:text-emerald-300 mb-1" />}
            <div className="text-[10px] text-slate-900 dark:text-white uppercase font-bold tracking-wider">{touchDrag.type}</div>
          </div>
        )}

        {/* 1. Header (Always top) */}
        <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-3 md:px-6 py-2 flex items-center justify-between shadow-md z-30 shrink-0 h-12 md:h-16 transition-colors">
          <div className="flex items-center gap-2">
            <div className="bg-amber-500 p-1 md:p-2 rounded-lg text-slate-900 shadow-[0_0_10px_rgba(245,158,11,0.5)]">
              <Zap size={16} fill="currentColor" className="md:w-5 md:h-5"/>
            </div>
            <div>
              <h1 className="text-sm md:text-xl font-bold tracking-tight leading-tight">Circuit Assembler</h1>
              <p className="text-[8px] md:text-xs text-slate-500 dark:text-slate-400 hidden sm:block">Class 10 Physics Virtual Lab</p>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-3" data-no-pan="true">
            {selectedTool && (
              <button onClick={() => setSelectedTool(null)} className="md:hidden bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-3 py-1 rounded-full text-[10px] flex items-center gap-1 border border-slate-300 dark:border-slate-600 shadow-sm active:bg-slate-200 dark:active:bg-slate-600">
                Cancel Tool
              </button>
            )}
            <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-1.5 md:p-2 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
              {isDarkMode ? <Sun size={14} className="md:w-4 md:h-4" /> : <Moon size={14} className="md:w-4 md:h-4" />}
            </button>
            <button onClick={toggleFullscreen} className="p-1.5 md:p-2 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
              {isFullscreen ? <Minimize size={14} className="md:w-4 md:h-4" /> : <Maximize size={14} className="md:w-4 md:h-4" />}
            </button>
          </div>
        </header>

        {/* 2. Mobile Toolbar (Visible ONLY < lg) */}
        <div className="lg:hidden flex flex-col border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shrink-0 shadow-md z-20 transition-colors" data-no-pan="true">
          <div className="flex items-center justify-between p-2 gap-2 bg-slate-50 dark:bg-slate-800/80">
            <div className="flex-1 flex items-center gap-2 bg-white dark:bg-slate-900 rounded-lg px-2 py-1.5 border border-slate-200 dark:border-slate-700 shadow-inner">
               <span className="text-[10px] text-amber-600 dark:text-amber-500 font-bold w-6">{batteryVoltage}V</span>
               <input type="range" min="1" max="100" step="1" value={batteryVoltage} onChange={(e) => setBatteryVoltage(Number(e.target.value))} className="w-full accent-amber-500 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none outline-none" />
            </div>
            <div className={`flex flex-col text-[9px] font-mono leading-tight p-1 rounded border w-20 shrink-0 text-center ${isShortCircuit ? 'bg-red-100 dark:bg-red-900/50 border-red-300 dark:border-red-500' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700'}`}>
              <span className="text-slate-600 dark:text-slate-300">R: {circuit.req > 9999 ? '∞' : circuit.req.toFixed(1)}Ω</span>
              <span className={`${isShortCircuit ? 'text-red-500 dark:text-red-400 animate-pulse font-bold' : 'text-emerald-600 dark:text-emerald-400'}`}>I: {circuit.i > 99 ? '>99' : circuit.i.toFixed(1)}A</span>
            </div>
          </div>
          <div className="flex overflow-x-auto no-scrollbar gap-2 px-2 pb-2">
             <ToolButton type="resistor" label="Resistor" selectedTool={selectedTool} onSelect={setSelectedTool} setIsDragging={setIsDragging} setTouchDrag={setTouchDrag}/>
             <ToolButton type="bulb" icon={Lightbulb} label="Bulb" selectedTool={selectedTool} onSelect={setSelectedTool} setIsDragging={setIsDragging} setTouchDrag={setTouchDrag}/>
             <ToolButton type="switch" icon={ToggleRight} label="Switch" selectedTool={selectedTool} onSelect={setSelectedTool} setIsDragging={setIsDragging} setTouchDrag={setTouchDrag}/>
             <ToolButton type="series" icon={Layers} label="Series" selectedTool={selectedTool} onSelect={setSelectedTool} setIsDragging={setIsDragging} setTouchDrag={setTouchDrag}/>
             <ToolButton type="parallel" icon={Box} label="Parallel" selectedTool={selectedTool} onSelect={setSelectedTool} setIsDragging={setIsDragging} setTouchDrag={setTouchDrag}/>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row flex-1 overflow-hidden relative">
          
          {/* 3. Desktop Sidebar (Visible ONLY >= lg) */}
          <div className="hidden lg:flex w-64 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 p-4 flex-col gap-6 shrink-0 overflow-y-auto z-20 transition-colors" data-no-pan="true">
            <div>
              <h2 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Power Source</h2>
              <div className="bg-slate-50 dark:bg-slate-700 p-4 rounded-xl border border-slate-200 dark:border-slate-600">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200 flex justify-between mb-2">Voltage <span>{batteryVoltage}V</span></label>
                <input type="range" min="1" max="100" step="1" value={batteryVoltage} onChange={(e) => setBatteryVoltage(Number(e.target.value))} className="w-full accent-amber-500" />
              </div>
            </div>

            <div>
              <h2 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 flex items-center justify-between">
                Toolbox <span className="hidden xl:inline-flex text-[9px] font-normal bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 px-1.5 py-0.5 rounded-full items-center gap-1"><Hand size={10}/> Tap or Drag</span>
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <ToolButton type="resistor" label="Resistor" selectedTool={selectedTool} onSelect={setSelectedTool} setIsDragging={setIsDragging} setTouchDrag={setTouchDrag}/>
                <ToolButton type="bulb" icon={Lightbulb} label="Light Bulb" selectedTool={selectedTool} onSelect={setSelectedTool} setIsDragging={setIsDragging} setTouchDrag={setTouchDrag}/>
                <ToolButton type="switch" icon={ToggleRight} label="Switch" selectedTool={selectedTool} onSelect={setSelectedTool} setIsDragging={setIsDragging} setTouchDrag={setTouchDrag}/>
                <div className="col-span-2 grid grid-cols-2 gap-3">
                  <ToolButton type="series" icon={Layers} label="Series Block" selectedTool={selectedTool} onSelect={setSelectedTool} setIsDragging={setIsDragging} setTouchDrag={setTouchDrag}/>
                  <ToolButton type="parallel" icon={Box} label="Parallel Bank" selectedTool={selectedTool} onSelect={setSelectedTool} setIsDragging={setIsDragging} setTouchDrag={setTouchDrag}/>
                </div>
              </div>
            </div>
            
            <div className={`mt-auto p-4 rounded-xl border ${isShortCircuit ? 'bg-red-50 dark:bg-red-900/50 border-red-300 dark:border-red-500 animate-pulse' : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700'}`}>
               <h3 className="text-xs font-bold text-amber-600 dark:text-amber-500 uppercase mb-2 flex items-center justify-between">
                  Total Circuit {isShortCircuit && <span className="text-red-500 dark:text-red-400 flex items-center gap-1"><AlertTriangle size={12}/> Overload</span>}
               </h3>
               <div className="flex justify-between items-end mb-1">
                  <span className="text-sm text-slate-500 dark:text-slate-400">Req</span>
                  <span className="font-mono text-lg text-slate-800 dark:text-slate-100">{circuit.req > 9999 ? '∞' : circuit.req.toFixed(2)} Ω</span>
               </div>
               <div className="flex justify-between items-end">
                  <span className="text-sm text-slate-500 dark:text-slate-400">Current</span>
                  <span className={`font-mono text-lg ${isShortCircuit ? 'text-red-600 dark:text-red-400 font-bold' : 'text-emerald-600 dark:text-emerald-400'}`}>{circuit.i > 99 ? '> 99.9' : circuit.i.toFixed(2)} A</span>
               </div>
            </div>
          </div>

          {/* 4. Center Canvas (Pans and Zooms) */}
          <div 
            className={`flex-1 bg-[url('https://www.transparenttextures.com/patterns/blueprint.png')] bg-slate-100/50 dark:bg-slate-800/50 relative overflow-hidden border-slate-200 dark:border-slate-700 shadow-inner z-0 ${isPanning ? 'cursor-grabbing' : 'cursor-grab'} touch-none`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            onWheel={handleWheel}
          >
            
            {/* Floating Zoom & Pan Controls Overlay */}
            <div className="absolute bottom-4 right-4 flex flex-col gap-2 z-30" data-no-pan="true">
              <button onClick={() => setZoom(z => Math.min(z + 0.15, 2.5))} className="p-2 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-full shadow-lg border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 active:scale-95 transition-all">
                <ZoomIn size={18} />
              </button>
              <div 
                className="p-2 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-full shadow-lg border border-slate-200 dark:border-slate-600 font-mono text-[10px] font-bold text-center w-9 h-9 flex items-center justify-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-600 active:scale-95 transition-all" 
                onClick={resetView}
                title="Reset View"
              >
                {Math.round(zoom * 100)}%
              </div>
              <button onClick={() => setZoom(z => Math.max(z - 0.15, 0.4))} className="p-2 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-full shadow-lg border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 active:scale-95 transition-all">
                <ZoomOut size={18} />
              </button>
            </div>

            {/* Scalable and Pannable Circuit Container */}
            <div 
              style={{ 
                transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${zoom})`, 
                transformOrigin: 'center', 
                transition: isPanning ? 'none' : 'transform 0.15s ease-out' 
              }}
              className="absolute top-1/2 left-1/2 bg-slate-200/50 dark:bg-slate-50/5 p-4 md:p-8 rounded-[1rem] md:rounded-[2rem] border-2 md:border-4 border-slate-300 dark:border-slate-700 shadow-2xl flex flex-row items-center shrink-0"
            >
               {/* Battery Component */}
               <div data-no-pan="true" className="w-10 md:w-24 flex flex-col items-center mr-1 md:mr-4 z-10 shrink-0">
                 <div className="text-amber-500 font-bold mb-1 text-[10px] md:text-base">{batteryVoltage}V</div>
                 <div className={`w-8 h-12 md:w-12 md:h-20 border-2 rounded md:rounded-lg relative flex flex-col overflow-hidden shadow-lg transition-colors ${isShortCircuit ? 'bg-red-900 border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.6)]' : 'bg-slate-200 dark:bg-slate-800 border-slate-400 dark:border-slate-500'}`}>
                    <div className={`h-2 md:h-4 w-full flex items-center justify-center text-[6px] md:text-xs text-slate-800 dark:text-white font-bold ${isShortCircuit ? 'bg-red-700 text-white' : 'bg-slate-300 dark:bg-slate-500'}`}>+</div>
                    <div className={`flex-1 flex items-center justify-center bg-gradient-to-b ${isShortCircuit ? 'from-red-600 to-red-800' : 'from-amber-400 to-amber-600 dark:from-amber-600 dark:to-amber-700'}`}>
                      {isShortCircuit ? <AlertTriangle className="text-red-200 dark:text-red-300 animate-pulse w-3 h-3 md:w-6 md:h-6"/> : <Zap className="text-amber-100 dark:text-amber-300/50 w-3 h-3 md:w-6 md:h-6"/>}
                    </div>
                    <div className={`h-2 md:h-4 w-full flex items-center justify-center text-[6px] md:text-xs text-slate-100 dark:text-white font-bold ${isShortCircuit ? 'bg-red-900' : 'bg-slate-500 dark:bg-slate-800'}`}>-</div>
                 </div>
               </div>

               <div className="absolute left-[40px] md:left-[88px] top-[15%] md:top-[20%] w-4 md:w-8 h-2"><Wires i={circuit.i} horizontal={true}/></div>
               
               {/* Main Assembly Area */}
               <div className="flex-1 bg-white/50 dark:bg-white/10 rounded-xl md:rounded-2xl border border-dashed border-slate-400 dark:border-slate-600 p-2 md:p-6 flex items-center justify-center relative min-h-[100px] md:min-h-[200px]">
                  <div className="absolute -left-0 top-[15%] md:top-[20%] w-full h-[70%] md:h-[60%] border-t-2 md:border-t-4 border-b-2 md:border-b-4 border-l-2 md:border-l-4 border-slate-400/50 dark:border-slate-600/30 rounded-l-xl md:rounded-l-2xl pointer-events-none"></div>
                  {renderSimulationNode(circuit)}
               </div>

               <div className="absolute left-[40px] md:left-[88px] bottom-[15%] md:bottom-[20%] w-4 md:w-8 h-2"><Wires i={circuit.i} horizontal={true}/></div>
            </div>

            {/* Helper overlays */}
            {circuitTemplate.children.length === 0 && !showDropZones && (
              <div className="absolute top-1/4 left-1/2 -translate-x-1/2 flex items-center justify-center pointer-events-none z-10">
                <div className="bg-white/90 dark:bg-slate-900/90 px-4 py-2 md:px-6 md:py-3 rounded-full text-slate-700 dark:text-slate-300 flex items-center gap-2 animate-pulse shadow-xl backdrop-blur-sm text-[10px] md:text-base border border-slate-300 dark:border-slate-700">
                   <MousePointer2 size={14} className="md:w-4 md:h-4"/> Tap/Drag a tool here to start
                </div>
              </div>
            )}
            {selectedTool && (
              <div className="fixed lg:absolute bottom-[16dvh] lg:bottom-4 lg:top-auto top-32 left-1/2 -translate-x-1/2 bg-indigo-600/95 text-white px-4 py-2 rounded-full text-[10px] md:text-sm font-bold shadow-xl backdrop-blur-sm pointer-events-none flex items-center gap-2 z-50 whitespace-nowrap border border-indigo-400">
                 <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-white animate-ping"></div> Tap a dashed box to place {selectedTool}
              </div>
            )}
          </div>

          {/* 5. Right Sidebar / Bottom Panel - Multimeter */}
          <div data-no-pan="true" className={`w-full lg:w-72 bg-white dark:bg-slate-800 flex flex-col shrink-0 z-40 border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-slate-700 transition-all duration-300
                          ${selectedNode ? 'h-[40dvh]' : 'h-[10dvh] min-h-[50px]'} lg:h-full lg:max-h-none lg:min-h-0 relative`}>
            
            <div className="bg-slate-100 dark:bg-slate-700 px-3 md:px-4 py-2 border-b border-slate-200 dark:border-slate-600 flex justify-between items-center shrink-0 cursor-pointer lg:cursor-default" onClick={() => !selectedNode && setSelectedId('root')}>
               <span className="text-[10px] md:text-xs font-bold tracking-wider text-slate-600 dark:text-slate-300 uppercase flex items-center gap-2">
                 Multimeter
                 {!selectedNode && <span className="lg:hidden text-[8px] font-normal text-slate-500 dark:text-slate-400 normal-case bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded">(Tap to open)</span>}
               </span>
               <Activity size={14} className="text-red-500 dark:text-red-400" />
            </div>
               
            <div className="p-3 md:p-4 bg-white dark:bg-slate-800 font-mono flex-1 overflow-y-auto">
              {selectedNode ? (
                <div className="space-y-3 md:space-y-4 max-w-md mx-auto lg:max-w-none">
                   <div className="flex justify-between items-center mb-2 md:mb-4 pb-2 md:pb-4 border-b border-slate-200 dark:border-slate-700">
                     <div>
                       <h4 className="text-xs md:text-sm text-slate-700 dark:text-slate-300 uppercase tracking-widest font-bold">{selectedNode.name}</h4>
                       <span className="text-[9px] md:text-[10px] bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-500 dark:text-slate-400 mt-1 inline-block">{selectedNode.type}</span>
                     </div>
                     <div className="flex gap-2">
                       <button onClick={() => setSelectedId(null)} className="lg:hidden bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 p-1.5 rounded border border-slate-200 dark:border-slate-600">
                         <span className="text-[10px]">Close</span>
                       </button>
                       {selectedNode.id !== 'root' && (
                         <button onClick={() => removeComponent(selectedNode.id)} className="lg:hidden bg-red-50 dark:bg-red-500/10 text-red-500 dark:text-red-400 p-1.5 rounded border border-red-200 dark:border-red-500/30">
                           <Trash2 size={14}/>
                         </button>
                       )}
                     </div>
                   </div>

                   <div className="grid grid-cols-2 lg:grid-cols-1 gap-2">
                     <div className="bg-slate-50 dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-700 flex flex-col lg:flex-row lg:justify-between lg:items-center">
                        <span className="text-slate-500 text-[9px] md:text-xs uppercase">Voltage</span>
                        <span className="text-sm md:text-lg text-amber-600 dark:text-amber-400">{selectedNode.v?.toFixed(2)} V</span>
                     </div>
                     <div className="bg-slate-50 dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-700 flex flex-col lg:flex-row lg:justify-between lg:items-center">
                        <span className="text-slate-500 text-[9px] md:text-xs uppercase">Current</span>
                        <span className="text-sm md:text-lg text-emerald-600 dark:text-emerald-400">{selectedNode.i?.toFixed(2)} A</span>
                     </div>
                     <div className="bg-slate-50 dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-700 flex flex-col lg:flex-row lg:justify-between lg:items-center">
                        <span className="text-slate-500 text-[9px] md:text-xs uppercase">Resistance</span>
                        <span className="text-sm md:text-lg text-blue-600 dark:text-blue-400">{selectedNode.req > 9999 ? '∞' : selectedNode.req?.toFixed(2)} Ω</span>
                     </div>
                     <div className="bg-slate-50 dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-700 flex flex-col lg:flex-row lg:justify-between lg:items-center">
                        <span className="text-slate-500 text-[9px] md:text-xs uppercase">Power</span>
                        <span className="text-sm md:text-lg text-purple-600 dark:text-purple-400">{((selectedNode.v || 0) * (selectedNode.i || 0)).toFixed(2)} W</span>
                     </div>
                   </div>

                   {(selectedNode.type === 'resistor' || selectedNode.type === 'bulb') && (
                     <div className="pt-2">
                       <label className="text-[10px] text-slate-500 dark:text-slate-400 uppercase block mb-1">Edit Resistance (Ω)</label>
                       <input 
                         type="number" min="0.1" step="1" value={selectedNode.resistance}
                         onChange={(e) => setCircuitTemplate(prev => updateNode(prev, selectedNode.id, { resistance: Math.max(0.1, parseFloat(e.target.value) || 0) }))}
                         className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded p-1.5 md:p-2 text-sm text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                       />
                     </div>
                   )}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
                  <MousePointer2 size={16} className="mb-2 opacity-50 md:w-5 md:h-5"/>
                  <p className="text-[10px] md:text-xs text-center">Tap a component<br/>to measure</p>
                </div>
              )}
            </div>
            
            <div className="flex bg-slate-200 dark:bg-slate-700 h-2 md:h-4 shrink-0 pointer-events-none">
               <div className="flex-1 border-r border-slate-300 dark:border-slate-600 flex items-center justify-center"><div className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_5px_#ef4444]"></div></div>
               <div className="flex-1 flex items-center justify-center"><div className="w-1.5 h-1.5 rounded-full bg-slate-800 dark:bg-slate-900 shadow-[0_0_5px_rgba(0,0,0,0.5)]"></div></div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
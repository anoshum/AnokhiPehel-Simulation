import React, { useState, useMemo } from 'react';
import { 
  Zap, Settings, Trash2, Box, Layers, 
  Activity, ToggleRight, MousePointer2,
  Lightbulb, AlertTriangle, Hand
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
  /* Hide scrollbar for cleaner canvas on mobile */
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
    // Base components
  } else if (node.type === 'series') {
    let openCount = node.children.filter(c => calculateReq(c) === Infinity).length;
    
    result.children = node.children.map(child => {
      let childReq = calculateReq(child);
      let childV;
      
      if (req === Infinity) {
        childV = (childReq === Infinity && openCount > 0) ? vIn / openCount : 0;
      } else {
        childV = iIn * childReq;
      }
      return calculateVI(child, childV, iIn);
    });
  } else if (node.type === 'parallel') {
    result.children = node.children.map(child => {
      let childReq = calculateReq(child);
      let childI = 0;
      
      if (childReq === 0) {
        childI = req === 0 ? iIn : iIn; 
      } else if (childReq < Infinity) {
        childI = vIn / childReq;
      }
      return calculateVI(child, vIn, childI);
    });
  }
  return result;
};

// Tree manipulators
const insertNode = (node, parentId, index, newNode) => {
  if (node.id === parentId) {
    const newChildren = [...(node.children || [])];
    newChildren.splice(index, 0, newNode);
    return { ...node, children: newChildren };
  }
  if (node.children) {
    return { ...node, children: node.children.map(c => insertNode(c, parentId, index, newNode)) };
  }
  return node;
};

const deleteNode = (node, id) => {
  if (node.children) {
    return {
      ...node,
      children: node.children.filter(c => c.id !== id).map(c => deleteNode(c, id))
    };
  }
  return node;
};

const updateNode = (node, id, updates) => {
  if (node.id === id) return { ...node, ...updates };
  if (node.children) {
    return { ...node, children: node.children.map(c => updateNode(c, id, updates)) };
  }
  return node;
};

// --- Components ---

const Wires = ({ i, horizontal = true }) => {
  const isFlowing = i > 0.001;
  const speed = isFlowing ? Math.max(0.2, 2 / i) : 0; 

  return (
    <div className={`flex items-center justify-center ${horizontal ? 'w-6 md:w-8 h-2' : 'h-6 md:h-8 w-2'}`}>
      <svg width={horizontal ? "100%" : "4"} height={horizontal ? "4" : "100%"} className="overflow-visible">
        <line 
          x1="0" y1="0" 
          x2={horizontal ? "100%" : "0"} 
          y2={horizontal ? "0" : "100%"} 
          stroke={isFlowing ? "#fbbf24" : "#94a3b8"} 
          strokeWidth="4" 
          strokeLinecap="round"
          strokeDasharray="8,8"
          className={`${horizontal ? 'wire-flow' : 'wire-flow-v'} ${!isFlowing ? 'paused' : ''}`}
          style={{ '--speed': `${speed}s` }}
        />
      </svg>
    </div>
  );
};

const DropZone = ({ parentId, index, onDropComplete, isVisible, selectedTool, clearTool }) => {
  const [isOver, setIsOver] = useState(false);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsOver(true);
  };
  const handleDragLeave = () => setIsOver(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setIsOver(false);
    const type = e.dataTransfer.getData('component_type');
    if (type) onDropComplete(parentId, index, type);
  };

  const handleClick = (e) => {
    e.stopPropagation();
    if (selectedTool) {
      onDropComplete(parentId, index, selectedTool);
      clearTool();
    }
  };

  if (!isVisible) return null;

  return (
    <div 
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
      className={`transition-all duration-200 flex items-center justify-center
        ${isOver || selectedTool ? 'w-12 h-12 md:w-16 md:h-16 bg-indigo-500/20 border-indigo-400 scale-110 shadow-lg' : 'w-8 h-8 bg-slate-100 border-slate-300'}
        border-2 border-dashed rounded-lg cursor-pointer z-10 m-1`}
    >
      <div className={`w-3 h-3 rounded-full ${isOver || selectedTool ? 'bg-indigo-400 animate-ping' : 'bg-slate-300'}`} />
    </div>
  );
};

export default function Circuit() {
  const [batteryVoltage, setBatteryVoltage] = useState(12);
  const [selectedId, setSelectedId] = useState('root');
  const [isDragging, setIsDragging] = useState(false);
  const [selectedTool, setSelectedTool] = useState(null); // For Tap-to-Place mobile support
  
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

  // Handlers
  const handleDragStart = (e, type) => {
    e.dataTransfer.setData('component_type', type);
    setIsDragging(true);
    setSelectedTool(null);
  };

  const toggleToolSelection = (type) => {
    setSelectedTool(prev => prev === type ? null : type);
  };

  const handleDropComplete = (parentId, index, type) => {
    let newNode = { type, id: generateId(), name: `${type.charAt(0).toUpperCase() + type.slice(1)}` };
    
    if (type === 'resistor') newNode.resistance = 10;
    if (type === 'bulb') newNode.resistance = 15;
    if (type === 'switch') newNode.closed = false;
    if (type === 'series' || type === 'parallel') newNode.children = [];

    setCircuitTemplate(prev => insertNode(prev, parentId, index, newNode));
    setIsDragging(false);
  };

  const toggleSwitch = (id, currentState) => {
    setCircuitTemplate(prev => updateNode(prev, id, { closed: !currentState }));
  };

  const removeComponent = (id) => {
    setCircuitTemplate(prev => deleteNode(prev, id));
    if (selectedId === id) setSelectedId('root');
  };

  const showDropZones = isDragging || !!selectedTool;

  // Renderer
  const renderSimulationNode = (node) => {
    const isSelected = node.id === selectedId;
    const baseClass = `group relative rounded-xl border-2 transition-all cursor-pointer flex flex-col items-center justify-center shadow-sm shrink-0
      ${isSelected ? 'ring-4 ring-indigo-400 border-indigo-500 scale-105 z-20' : 'border-slate-300 hover:border-indigo-300 hover:shadow-md z-10'}`;

    // Trash button logic: Visible on hover (desktop) OR when selected (mobile)
    const renderTrashBtn = () => (
      <button 
        onClick={(e) => { e.stopPropagation(); removeComponent(node.id); }} 
        className={`absolute -top-3 -right-3 bg-red-500 text-white rounded-full p-1.5 transition-all z-50 shadow-md hover:bg-red-600 hover:scale-110
        ${isSelected ? 'opacity-100' : 'opacity-0 md:group-hover:opacity-100'}`}
      >
        <Trash2 size={14}/>
      </button>
    );

    if (node.type === 'resistor') {
      return (
        <div key={node.id} onClick={(e) => { e.stopPropagation(); setSelectedId(node.id); }} className={`${baseClass} bg-orange-50 w-20 h-16 md:w-24 md:h-20`}>
          {renderTrashBtn()}
          <div className="w-12 md:w-16 h-4 md:h-6 bg-orange-200 rounded-full flex items-center justify-between px-1 md:px-2 border-2 border-orange-400">
             <div className="w-0.5 md:w-1 h-full bg-red-500"></div>
             <div className="w-0.5 md:w-1 h-full bg-yellow-500"></div>
             <div className="w-0.5 md:w-1 h-full bg-black"></div>
          </div>
          <span className="text-[10px] md:text-xs font-bold mt-1 md:mt-2 text-slate-700">{node.resistance} Ω</span>
        </div>
      );
    }

    if (node.type === 'bulb') {
      const power = (node.v || 0) * (node.i || 0);
      const brightness = Math.min(1, power / 40); 
      const isOn = power > 0.05;

      return (
        <div key={node.id} onClick={(e) => { e.stopPropagation(); setSelectedId(node.id); }} className={`${baseClass} bg-slate-800 w-20 h-20 md:w-24 md:h-24 overflow-hidden`}>
          {renderTrashBtn()}
          <div className="relative flex flex-col items-center justify-center w-full h-full">
            <div className={`absolute inset-0 transition-opacity duration-300 ${isOn ? 'opacity-100' : 'opacity-0'}`} style={{ background: `radial-gradient(circle, rgba(250,204,21,${brightness * 0.8}) 0%, rgba(0,0,0,0) 70%)` }}></div>
            <Lightbulb size={28} className={`relative z-10 transition-colors duration-300 ${isOn ? 'text-yellow-300' : 'text-slate-500'}`} style={{ filter: isOn ? `drop-shadow(0 0 ${brightness * 10}px #fde047)` : 'none' }} />
            <span className="relative z-10 text-[9px] md:text-[10px] text-slate-300 mt-1 md:mt-2 font-mono bg-slate-900/50 px-1 rounded">{power.toFixed(1)} W</span>
          </div>
        </div>
      );
    }

    if (node.type === 'switch') {
      return (
        <div key={node.id} onClick={(e) => { e.stopPropagation(); setSelectedId(node.id); }} className={`${baseClass} bg-slate-50 w-20 h-16 md:w-24 md:h-20`}>
          {renderTrashBtn()}
          <div 
            onClick={(e) => { e.stopPropagation(); toggleSwitch(node.id, node.closed); }}
            className={`w-10 md:w-14 h-6 md:h-8 rounded-full border-2 flex items-center px-0.5 md:px-1 cursor-pointer transition-colors ${node.closed ? 'bg-green-100 border-green-400' : 'bg-slate-200 border-slate-400'}`}
          >
            <div className={`w-4 h-4 md:w-6 md:h-6 rounded-full shadow-sm transform transition-transform ${node.closed ? 'translate-x-4 md:translate-x-5 bg-green-500' : 'translate-x-0 bg-white'}`}></div>
          </div>
          <span className="text-[9px] md:text-xs font-bold mt-1 md:mt-2 text-slate-600">{node.closed ? 'CLOSED' : 'OPEN'}</span>
        </div>
      );
    }

    if (node.type === 'series') {
      const isRoot = node.id === 'root';
      return (
        <div key={node.id} onClick={(e) => { e.stopPropagation(); setSelectedId(node.id); }} className={`${!isRoot ? baseClass + ' bg-blue-50/50 p-3 md:p-4 border-blue-200' : 'flex-1 w-full'} flex items-center min-h-[80px] md:min-h-[100px]`}>
          {!isRoot && (
            <>
              <div className="absolute top-0.5 md:top-1 left-2 text-[8px] md:text-[10px] text-blue-500 font-bold uppercase">Series</div>
              {renderTrashBtn()}
            </>
          )}
          <div className="flex flex-row items-center w-full justify-center min-w-max px-2 md:px-0">
            <DropZone parentId={node.id} index={0} onDropComplete={handleDropComplete} isVisible={showDropZones} selectedTool={selectedTool} clearTool={() => setSelectedTool(null)} />
            
            {node.children && node.children.map((child, index) => (
              <React.Fragment key={child.id}>
                {renderSimulationNode(child)}
                <DropZone parentId={node.id} index={index + 1} onDropComplete={handleDropComplete} isVisible={showDropZones} selectedTool={selectedTool} clearTool={() => setSelectedTool(null)} />
                {index < node.children.length - 1 && !showDropZones && <Wires i={child.i} horizontal={true} />}
              </React.Fragment>
            ))}

            {node.children?.length === 0 && !showDropZones && (
              <div className="text-[10px] md:text-sm text-slate-400 italic bg-white p-1 md:p-2 rounded-lg border border-dashed whitespace-nowrap">Wire</div>
            )}
          </div>
        </div>
      );
    }

    if (node.type === 'parallel') {
      return (
        <div key={node.id} onClick={(e) => { e.stopPropagation(); setSelectedId(node.id); }} className={`${baseClass} bg-emerald-50/50 p-4 md:p-6 border-emerald-200 min-w-[150px] md:min-w-[250px]`}>
          <div className="absolute top-0.5 md:top-1 left-2 text-[8px] md:text-[10px] text-emerald-600 font-bold uppercase">Parallel</div>
          {renderTrashBtn()}
          <div className="flex flex-col items-center gap-2 w-full relative mt-2 md:mt-0">
             {/* Left and Right Rails */}
             <div className="absolute left-2 md:left-4 top-0 bottom-0 w-1 bg-emerald-300/50"></div>
             <div className="absolute right-2 md:right-4 top-0 bottom-0 w-1 bg-emerald-300/50"></div>

            {node.children && node.children.map((child, index) => (
              <div key={child.id} className="flex items-center w-full px-2 md:px-4 relative group justify-center">
                <Wires i={child.i} horizontal={true} />
                <div className="flex-1 flex justify-center z-10">
                  {renderSimulationNode(child)}
                </div>
                <Wires i={child.i} horizontal={true} />
              </div>
            ))}
            
            <div className="mt-2 md:mt-4 z-10 bg-white rounded-full p-1 shadow-sm border border-emerald-200 flex items-center justify-center">
               <DropZone parentId={node.id} index={node.children ? node.children.length : 0} onDropComplete={handleDropComplete} isVisible={showDropZones} selectedTool={selectedTool} clearTool={() => setSelectedTool(null)} />
               {!showDropZones && <span className="text-[10px] md:text-xs text-emerald-600 font-medium px-1 md:px-2 whitespace-nowrap">+ Branch</span>}
            </div>
          </div>
        </div>
      );
    }
  };

  return (
    <div className="h-screen bg-slate-900 text-slate-100 font-sans flex flex-col overflow-hidden" onDragEnd={() => setIsDragging(false)}>
      <style>{styles}</style>
      
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 px-4 md:px-6 py-2 md:py-3 flex items-center justify-between shadow-md z-30 shrink-0">
        <div className="flex items-center gap-2 md:gap-3">
          <div className="bg-amber-500 p-1.5 md:p-2 rounded-lg text-slate-900 shadow-[0_0_15px_rgba(245,158,11,0.5)]">
            <Zap size={18} fill="currentColor" />
          </div>
          <div>
            <h1 className="text-lg md:text-xl font-bold tracking-tight leading-tight">Circuit Assembler</h1>
            <p className="text-[10px] md:text-xs text-slate-400">Class 10 Physics Simulation</p>
          </div>
        </div>
        {selectedTool && (
          <button onClick={() => setSelectedTool(null)} className="md:hidden bg-slate-700 text-slate-300 px-3 py-1 rounded-full text-xs flex items-center gap-1 border border-slate-600">
            Cancel Tool
          </button>
        )}
      </header>

      {/* Main Layout Area - Flex Col on Mobile, Flex Row on Desktop */}
      <div className="flex flex-col lg:flex-row flex-1 overflow-y-auto lg:overflow-hidden relative">
        
        {/* Left Sidebar / Top Bar - Toolbox */}
        <div className="w-full lg:w-64 bg-slate-800 lg:border-r border-b lg:border-b-0 border-slate-700 p-4 flex flex-col lg:gap-6 shrink-0 lg:overflow-y-auto z-20 shadow-md lg:shadow-none">
          
          <div className="flex flex-col sm:flex-row lg:flex-col gap-4 lg:gap-6">
            {/* Power Source */}
            <div className="flex-1 lg:flex-none">
              <h2 className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 md:mb-3">Power Source</h2>
              <div className="bg-slate-700 p-3 md:p-4 rounded-xl border border-slate-600">
                <label className="text-xs md:text-sm font-medium text-slate-200 flex justify-between mb-2">
                  Voltage <span>{batteryVoltage}V</span>
                </label>
                <input 
                  type="range" min="1" max="100" step="1" 
                  value={batteryVoltage} 
                  onChange={(e) => setBatteryVoltage(Number(e.target.value))}
                  className="w-full accent-amber-500"
                />
              </div>
            </div>

            {/* Toolbox Items */}
            <div className="flex-1 lg:flex-none">
              <h2 className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 md:mb-3 flex items-center justify-between">
                Toolbox 
                <span className="hidden md:inline-flex text-[9px] font-normal bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded-full items-center gap-1">
                   <Hand size={10}/> Tap or Drag
                </span>
              </h2>
              {/* Grid adjusts for mobile horizontal view vs desktop vertical */}
              <div className="grid grid-cols-4 sm:grid-cols-4 lg:grid-cols-2 gap-2 md:gap-3">
                <div 
                  draggable onDragStart={(e) => handleDragStart(e, 'resistor')} onDragEnd={() => setIsDragging(false)}
                  onClick={() => toggleToolSelection('resistor')}
                  className={`border rounded-lg p-2 md:p-3 flex flex-col items-center cursor-grab active:cursor-grabbing transition-colors
                    ${selectedTool === 'resistor' ? 'bg-indigo-600 border-indigo-400 ring-2 ring-indigo-400 ring-offset-1 ring-offset-slate-800' : 'bg-slate-700 hover:bg-slate-600 border-slate-600'}`}
                >
                  <div className="w-6 md:w-8 h-2 md:h-3 bg-orange-300 rounded-full mb-1 md:mb-2"></div>
                  <span className="text-[9px] md:text-xs font-medium text-slate-200">Resistor</span>
                </div>

                <div 
                  draggable onDragStart={(e) => handleDragStart(e, 'bulb')} onDragEnd={() => setIsDragging(false)}
                  onClick={() => toggleToolSelection('bulb')}
                  className={`border rounded-lg p-2 md:p-3 flex flex-col items-center cursor-grab active:cursor-grabbing transition-colors
                    ${selectedTool === 'bulb' ? 'bg-indigo-600 border-indigo-400 ring-2 ring-indigo-400 ring-offset-1 ring-offset-slate-800' : 'bg-slate-700 hover:bg-slate-600 border-slate-600'}`}
                >
                  <Lightbulb size={16} className="text-yellow-300 mb-1 md:mb-2 md:w-5 md:h-5" />
                  <span className="text-[9px] md:text-xs font-medium text-slate-200">Bulb</span>
                </div>
                
                <div 
                  draggable onDragStart={(e) => handleDragStart(e, 'switch')} onDragEnd={() => setIsDragging(false)}
                  onClick={() => toggleToolSelection('switch')}
                  className={`border rounded-lg p-2 md:p-3 flex flex-col items-center cursor-grab active:cursor-grabbing transition-colors
                    ${selectedTool === 'switch' ? 'bg-indigo-600 border-indigo-400 ring-2 ring-indigo-400 ring-offset-1 ring-offset-slate-800' : 'bg-slate-700 hover:bg-slate-600 border-slate-600'}`}
                >
                  <ToggleRight size={16} className="text-slate-300 mb-1 md:mb-2 md:w-5 md:h-5" />
                  <span className="text-[9px] md:text-xs font-medium text-slate-200">Switch</span>
                </div>

                <div 
                  draggable onDragStart={(e) => handleDragStart(e, 'series')} onDragEnd={() => setIsDragging(false)}
                  onClick={() => toggleToolSelection('series')}
                  className={`border rounded-lg p-2 md:p-3 flex flex-col items-center cursor-grab active:cursor-grabbing transition-colors lg:col-span-2
                    ${selectedTool === 'series' ? 'bg-indigo-600 border-indigo-400 ring-2 ring-indigo-400 ring-offset-1 ring-offset-slate-800' : 'bg-slate-700 hover:bg-slate-600 border-slate-600'}`}
                >
                  <Layers size={16} className="text-blue-300 mb-1 md:mb-2 md:w-4 md:h-4" />
                  <span className="text-[9px] md:text-xs font-medium text-slate-200 text-center leading-tight">Series<span className="hidden lg:inline"> Block</span></span>
                </div>

                <div 
                  draggable onDragStart={(e) => handleDragStart(e, 'parallel')} onDragEnd={() => setIsDragging(false)}
                  onClick={() => toggleToolSelection('parallel')}
                  className={`border rounded-lg p-2 md:p-3 flex flex-col items-center cursor-grab active:cursor-grabbing transition-colors lg:col-span-2
                    ${selectedTool === 'parallel' ? 'bg-indigo-600 border-indigo-400 ring-2 ring-indigo-400 ring-offset-1 ring-offset-slate-800' : 'bg-slate-700 hover:bg-slate-600 border-slate-600'}`}
                >
                  <Box size={16} className="text-emerald-300 mb-1 md:mb-2 md:w-4 md:h-4" />
                  <span className="text-[9px] md:text-xs font-medium text-slate-200 text-center leading-tight">Parallel<span className="hidden lg:inline"> Bank</span></span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Main Circuit Stats - Hidden on very small heights, visible otherwise */}
          <div className={`hidden sm:block lg:mt-auto p-3 md:p-4 rounded-xl border ${isShortCircuit ? 'bg-red-900/50 border-red-500 animate-pulse' : 'bg-slate-900 border-slate-700'} mt-4`}>
             <h3 className="text-[10px] md:text-xs font-bold text-amber-500 uppercase mb-2 flex items-center justify-between">
                Total Circuit
                {isShortCircuit && <span className="text-red-400 flex items-center gap-1"><AlertTriangle size={10} md:size={12}/> Overload</span>}
             </h3>
             <div className="flex justify-between items-end mb-1">
                <span className="text-xs md:text-sm text-slate-400">Req</span>
                <span className="font-mono text-sm md:text-lg">{circuit.req > 9999 ? '∞' : circuit.req.toFixed(2)} Ω</span>
             </div>
             <div className="flex justify-between items-end">
                <span className="text-xs md:text-sm text-slate-400">Current</span>
                <span className={`font-mono text-sm md:text-lg ${isShortCircuit ? 'text-red-400 font-bold' : 'text-emerald-400'}`}>
                  {circuit.i > 99 ? '> 99.9' : circuit.i.toFixed(2)} A
                </span>
             </div>
          </div>
        </div>

        {/* Center Canvas - Assembly Board */}
        {/* On mobile, this scrolls horizontally if the circuit gets too wide */}
        <div className="flex-1 bg-[url('https://www.transparenttextures.com/patterns/blueprint.png')] bg-slate-800/50 relative overflow-auto p-4 md:p-8 flex items-start md:items-center justify-start lg:justify-center border-b lg:border-b-0 lg:border-r border-slate-700 shadow-inner min-h-[350px]">
          
          {/* The Circuit Loop */}
          <div className="bg-slate-50/5 p-4 md:p-8 rounded-[2rem] border-4 border-slate-700 shadow-2xl flex flex-row items-center relative min-w-max md:min-w-[800px] min-h-[250px] md:min-h-[400px] mx-auto transition-all">
             
             {/* Battery Component (Fixed) */}
             <div className="w-16 md:w-24 flex flex-col items-center mr-2 md:mr-4 z-10 shrink-0">
               <div className="text-amber-400 font-bold mb-1 md:mb-2 text-sm md:text-base">{batteryVoltage}V</div>
               <div className={`w-10 h-16 md:w-12 md:h-20 border-2 rounded-lg relative flex flex-col overflow-hidden shadow-lg transition-colors ${isShortCircuit ? 'bg-red-900 border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.6)]' : 'bg-slate-800 border-slate-500'}`}>
                  <div className={`h-3 md:h-4 w-full flex items-center justify-center text-[10px] md:text-xs text-white font-bold ${isShortCircuit ? 'bg-red-700' : 'bg-slate-500'}`}>+</div>
                  <div className={`flex-1 flex items-center justify-center bg-gradient-to-b ${isShortCircuit ? 'from-red-600 to-red-800' : 'from-amber-600 to-amber-700'}`}>
                    {isShortCircuit ? <AlertTriangle className="text-red-300 animate-pulse w-4 h-4 md:w-6 md:h-6"/> : <Zap className="text-amber-300/50 w-4 h-4 md:w-6 md:h-6"/>}
                  </div>
                  <div className={`h-3 md:h-4 w-full flex items-center justify-center text-[10px] md:text-xs text-white font-bold ${isShortCircuit ? 'bg-red-900' : 'bg-slate-800'}`}>-</div>
               </div>
             </div>

             {/* Wire from Battery Top */}
             <div className="absolute left-[60px] md:left-[88px] top-[15%] md:top-[20%] w-6 md:w-8 h-2">
                <Wires i={circuit.i} horizontal={true}/>
             </div>
             
             {/* Main Assembly Area */}
             <div className="flex-1 bg-white/10 rounded-2xl border-2 border-dashed border-slate-600 p-3 md:p-6 flex items-center justify-center relative min-h-[150px] md:min-h-[200px]">
                {/* Visual circuit loop connections */}
                <div className="absolute -left-0 top-[15%] md:top-[20%] w-full h-[70%] md:h-[60%] border-t-4 border-b-4 border-l-4 border-slate-600/30 rounded-l-2xl pointer-events-none"></div>
                {renderSimulationNode(circuit)}
             </div>

             {/* Wire back to Battery Bottom */}
             <div className="absolute left-[60px] md:left-[88px] bottom-[15%] md:bottom-[20%] w-6 md:w-8 h-2">
                <Wires i={circuit.i} horizontal={true}/>
             </div>
          </div>

          {/* Helper overlays */}
          {circuitTemplate.children.length === 0 && !showDropZones && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-slate-900/80 px-4 py-2 md:px-6 md:py-3 rounded-full text-slate-300 flex items-center gap-2 animate-pulse shadow-lg backdrop-blur-sm text-xs md:text-base">
                 <MousePointer2 size={16}/> Tap tools to build circuit
              </div>
            </div>
          )}
          {selectedTool && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-indigo-600/90 text-white px-4 py-2 rounded-full text-xs md:text-sm font-medium shadow-lg backdrop-blur-sm pointer-events-none flex items-center gap-2 z-50 whitespace-nowrap">
               <div className="w-2 h-2 rounded-full bg-white animate-ping"></div>
               Tap a dashed box to place {selectedTool}
            </div>
          )}
        </div>

        {/* Right Sidebar / Bottom Bar - Multimeter */}
        <div className="w-full lg:w-72 bg-slate-800 p-4 flex flex-col shrink-0">
          <div className="bg-slate-900 border-2 border-slate-600 rounded-xl overflow-hidden shadow-xl">
             <div className="bg-slate-700 px-3 md:px-4 py-2 border-b border-slate-600 flex justify-between items-center">
               <span className="text-[10px] md:text-xs font-bold tracking-wider text-slate-300 uppercase">Multimeter</span>
               <Activity size={14} className="text-red-400" />
             </div>
             
             <div className="p-3 md:p-4 bg-slate-800 font-mono">
                {selectedNode ? (
                  <div className="space-y-3 md:space-y-4">
                     <div className="text-center mb-2 md:mb-4 pb-2 md:pb-4 border-b border-slate-700">
                       <h4 className="text-xs md:text-sm text-slate-400 uppercase tracking-widest">{selectedNode.name}</h4>
                       <span className="text-[9px] md:text-[10px] bg-slate-700 px-2 py-1 rounded text-slate-300 mt-1 inline-block">{selectedNode.type}</span>
                     </div>

                     <div className="grid grid-cols-2 lg:grid-cols-1 gap-2 md:gap-3">
                       <div className="bg-slate-900 p-2 md:p-3 rounded border border-slate-700 flex flex-col lg:flex-row lg:justify-between lg:items-center">
                          <span className="text-slate-500 text-[10px] md:text-sm">Voltage (V)</span>
                          <span className="text-sm md:text-xl text-amber-400">{selectedNode.v?.toFixed(2)} V</span>
                       </div>
                       
                       <div className="bg-slate-900 p-2 md:p-3 rounded border border-slate-700 flex flex-col lg:flex-row lg:justify-between lg:items-center">
                          <span className="text-slate-500 text-[10px] md:text-sm">Current (I)</span>
                          <span className="text-sm md:text-xl text-emerald-400">{selectedNode.i?.toFixed(2)} A</span>
                       </div>

                       <div className="bg-slate-900 p-2 md:p-3 rounded border border-slate-700 flex flex-col lg:flex-row lg:justify-between lg:items-center">
                          <span className="text-slate-500 text-[10px] md:text-sm">Resistance (R)</span>
                          <span className="text-sm md:text-xl text-blue-400">
                            {selectedNode.req > 9999 ? '∞' : selectedNode.req?.toFixed(2)} Ω
                          </span>
                       </div>

                       <div className="bg-slate-900 p-2 md:p-3 rounded border border-slate-700 flex flex-col lg:flex-row lg:justify-between lg:items-center">
                          <span className="text-slate-500 text-[10px] md:text-sm">Power (W)</span>
                          <span className="text-sm md:text-xl text-purple-400">
                            {((selectedNode.v || 0) * (selectedNode.i || 0)).toFixed(2)} W
                          </span>
                       </div>
                     </div>

                     {(selectedNode.type === 'resistor' || selectedNode.type === 'bulb') && (
                       <div className="mt-3 md:mt-4 pt-3 md:pt-4 border-t border-slate-700">
                         <label className="text-[10px] md:text-xs text-slate-400 uppercase block mb-1 md:mb-2">Edit Resistance (Ω)</label>
                         <input 
                           type="number" min="0.1" step="1"
                           value={selectedNode.resistance}
                           onChange={(e) => setCircuitTemplate(prev => updateNode(prev, selectedNode.id, { resistance: Math.max(0.1, parseFloat(e.target.value) || 0) }))}
                           className="w-full bg-slate-900 border border-slate-600 rounded p-1.5 md:p-2 text-sm md:text-base text-white outline-none focus:border-indigo-500"
                         />
                       </div>
                     )}

                     {selectedNode.id !== 'root' && (
                       <div className="mt-4 md:mt-6 pt-3 md:pt-4 border-t border-slate-700">
                         <button 
                           onClick={() => removeComponent(selectedNode.id)}
                           className="w-full flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 py-1.5 md:py-2 rounded transition-colors text-xs md:text-sm font-medium"
                         >
                           <Trash2 size={14}/> Remove
                         </button>
                       </div>
                     )}
                  </div>
                ) : (
                  <div className="py-8 md:py-12 text-center text-slate-500 flex flex-col items-center">
                    <MousePointer2 size={20} className="mb-2 opacity-50 md:w-6 md:h-6"/>
                    <p className="text-xs md:text-sm">Tap a component<br/>to measure</p>
                  </div>
                )}
             </div>
             
             {/* Probe aesthetics */}
             <div className="flex bg-slate-700 h-4 md:h-6">
                <div className="flex-1 border-r border-slate-600 flex items-center justify-center"><div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-red-500 shadow-[0_0_5px_#ef4444]"></div></div>
                <div className="flex-1 flex items-center justify-center"><div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-slate-900 shadow-[0_0_5px_#000]"></div></div>
             </div>
          </div>

          {/* Guide Hidden on mobile to save space, visible on Desktop */}
          <div className="hidden lg:block mt-6 bg-slate-700/50 p-4 rounded-xl border border-slate-600/50 text-xs text-slate-300">
            <h4 className="font-bold mb-2 flex items-center gap-1 text-slate-200"><Settings size={14}/> Lab Guide</h4>
            <ul className="space-y-2 pl-4 list-disc marker:text-indigo-400">
              <li><strong>Tap</strong> or <strong>Drag</strong> tools into dashed boxes.</li>
              <li>Toggle switches to cause an <strong>Open Circuit</strong>.</li>
              <li>Watch out for <strong>Short Circuits</strong>!</li>
              <li>Tap placed components to measure them.</li>
            </ul>
          </div>
        </div>

      </div>
    </div>
  );
}
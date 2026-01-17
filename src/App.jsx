import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Pause, 
  Battery, 
  BatteryCharging, 
  Box, 
  RotateCcw,
  Plus,
  Minus,
  Database,
  PackagePlus,
  Zap,
  Activity,
  Map as MapIcon,
  Cpu,
  Gamepad2,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Gauge
} from 'lucide-react';

// --- A* ALGORITHM (Enhanced for Visualization) ---
class Node {
  constructor(x, y, parent = null) {
    this.x = x;
    this.y = y;
    this.parent = parent;
    this.g = 0; 
    this.h = 0; 
    this.f = 0; 
  }
}

const findPath = (start, end, gridRows, gridCols, obstacles) => {
  if (!start || !end) return { path: [], visited: [] };
  
  const openList = [];
  const closedList = new Set();
  const visitedForViz = []; // To store order of visitation
  
  const startNode = new Node(start.x, start.y);
  const endNode = new Node(end.x, end.y);
  
  openList.push(startNode);
  
  while (openList.length > 0) {
    let lowestIndex = 0;
    for (let i = 1; i < openList.length; i++) {
      if (openList[i].f < openList[lowestIndex].f) {
        lowestIndex = i;
      }
    }
    
    let currentNode = openList[lowestIndex];
    visitedForViz.push({x: currentNode.x, y: currentNode.y}); // Track for visualization

    // Success
    if (currentNode.x === endNode.x && currentNode.y === endNode.y) {
      let curr = currentNode;
      let ret = [];
      while (curr.parent) {
        ret.push({ x: curr.x, y: curr.y });
        curr = curr.parent;
      }
      return { path: ret.reverse(), visited: visitedForViz };
    }
    
    openList.splice(lowestIndex, 1);
    closedList.add(`${currentNode.x},${currentNode.y}`);
    
    const neighbors = [{x:0, y:-1}, {x:0, y:1}, {x:-1, y:0}, {x:1, y:0}];
    
    for (const nb of neighbors) {
      const neighborX = currentNode.x + nb.x;
      const neighborY = currentNode.y + nb.y;
      
      if (neighborX < 0 || neighborX >= gridCols || neighborY < 0 || neighborY >= gridRows) continue;
      if (obstacles.has(`${neighborX},${neighborY}`)) continue;
      if (closedList.has(`${neighborX},${neighborY}`)) continue;
      
      const gScore = currentNode.g + 1;
      let gScoreIsBest = false;
      const existingNode = openList.find(n => n.x === neighborX && n.y === neighborY);
      
      if (!existingNode) {
        gScoreIsBest = true;
        const newNode = new Node(neighborX, neighborY, currentNode);
        newNode.g = gScore;
        newNode.h = Math.abs(neighborX - endNode.x) + Math.abs(neighborY - endNode.y);
        newNode.f = newNode.g + newNode.h;
        openList.push(newNode);
      } else if (gScore < existingNode.g) {
        gScoreIsBest = true;
        existingNode.parent = currentNode;
        existingNode.g = gScore;
        existingNode.f = existingNode.g + existingNode.h;
      }
    }
  }
  return { path: [], visited: visitedForViz }; 
};

// --- CONSTANTS ---
const TILE_SIZE = 34; // Slightly smaller for better fit
const BATTERY_COST = 0.2; 
const CHARGE_RATE = 5;

// Data Definitions
const INITIAL_ITEMS = [
  { id: 'i1', name: 'Alpha-Red', uid: 'A-1', shelfId: 'shelf-1', color: 'bg-red-500' },
  { id: 'i2', name: 'Beta-Blue', uid: 'B-2', shelfId: 'shelf-2', color: 'bg-blue-500' },
  { id: 'i3', name: 'Gamma-Grn', uid: 'C-3', shelfId: 'shelf-3', color: 'bg-green-500' },
];

export default function App() {
  // --- UI STATE ---
  const [rows, setRows] = useState(10);
  const [cols, setCols] = useState(15);
  const [obstacles, setObstacles] = useState(new Set());
  const [editMode, setEditMode] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState([]);
  
  // NEW: Visualization & Controls
  const [showScan, setShowScan] = useState(false);
  const [speed, setSpeed] = useState(200);
  const [manualMode, setManualMode] = useState(false);
  const [stats, setStats] = useState({ distance: 0, jobs: 0, charges: 0 });

  // Robot State Ref
  const robotRef = useRef({
    x: 0,
    y: 0,
    battery: 100,
    state: 'IDLE',
    heldItem: null,
    path: [],
    visitedNodes: [], // For A* viz
    waitTicks: 0,
    queue: [...INITIAL_ITEMS]
  });

  // Render State
  const [renderBot, setRenderBot] = useState({...robotRef.current});
  const logsEndRef = useRef(null);
  
  // Fixed Locations
  const chargePoint = { x: 0, y: 0 };
  const pickupPoint = { x: 0, y: Math.floor(rows/2) };
  
  // Dynamic Shelves
  const getShelves = (r, c) => [
    { id: 'shelf-1', uid: 'A-1', x: c-2, y: 1, color: 'border-red-500 text-red-500', baseColor: 'bg-red-500' },
    { id: 'shelf-2', uid: 'B-2', x: c-2, y: Math.floor(r/2), color: 'border-blue-500 text-blue-500', baseColor: 'bg-blue-500' },
    { id: 'shelf-3', uid: 'C-3', x: c-2, y: r-2, color: 'border-green-500 text-green-500', baseColor: 'bg-green-500' }
  ];
  const shelves = getShelves(rows, cols);

  const addLog = (msg) => {
    setLogs(prev => [...prev.slice(-14), `[${new Date().toLocaleTimeString().split(' ')[0]}] ${msg}`]);
  };

  useEffect(() => { logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [logs]);

  // --- ENGINE LOOP ---
  useEffect(() => {
    if (!isRunning || manualMode) return;

    const interval = setInterval(() => {
      const bot = robotRef.current;
      let updated = false;

      // 0. Handle Wait Timers
      if (bot.waitTicks > 0) {
        bot.waitTicks--;
        if (bot.waitTicks === 0) {
          if (bot.state === 'PICKING') {
            const item = bot.queue.shift();
            bot.heldItem = item;
            addLog(`Picked up ${item.name}. Calculating path...`);
            
            const shelf = shelves.find(s => s.id === item.shelfId);
            const { path, visited } = findPath(bot, shelf, rows, cols, obstacles);
            
            if(path.length > 0) {
              bot.path = path;
              bot.visitedNodes = visited;
              bot.state = 'MOVING';
            } else {
              addLog("Error: No path to shelf!");
              bot.state = 'IDLE';
            }
          } 
          else if (bot.state === 'DROPPING') {
            addLog(`Delivered to ${bot.heldItem.uid}. Mission Success.`);
            setStats(s => ({...s, jobs: s.jobs + 1}));
            bot.heldItem = null;
            bot.visitedNodes = [];
            bot.state = 'IDLE';
          }
        }
        setRenderBot({...bot});
        return;
      }

      // 1. Charging Logic
      if (bot.state === 'CHARGING') {
        if (bot.battery >= 100) {
          bot.battery = 100;
          bot.state = 'IDLE';
          setStats(s => ({...s, charges: s.charges + 1}));
          addLog("Fully Charged. Resuming ops.");
        } else {
          bot.battery += CHARGE_RATE;
        }
        updated = true;
      }

      // 2. Moving Logic
      else if (bot.state === 'MOVING' && bot.path.length > 0) {
        bot.battery -= BATTERY_COST;
        const nextStep = bot.path[0];
        bot.x = nextStep.x;
        bot.y = nextStep.y;
        bot.path.shift();
        setStats(s => ({...s, distance: s.distance + 1}));
        
        if (bot.battery < 5 && bot.heldItem === null) {
          addLog("CRITICAL BATTERY. Emergency Reroute.");
          const { path, visited } = findPath(bot, chargePoint, rows, cols, obstacles);
          bot.path = path;
          bot.visitedNodes = visited;
        }
        
        if (bot.path.length === 0) handleArrival(bot);
        updated = true;
      }

      // 3. Decision Logic
      else if (bot.state === 'IDLE') {
        decideNextMove(bot);
        updated = true;
      }

      if (updated) setRenderBot({...bot});
    }, speed); // Dynamic Speed

    return () => clearInterval(interval);
  }, [isRunning, rows, cols, obstacles, speed, manualMode]);

  // --- LOGIC HELPERS ---
  const decideNextMove = (bot) => {
    // A. At charger?
    if (bot.x === chargePoint.x && bot.y === chargePoint.y && bot.battery < 90) {
      bot.state = 'CHARGING';
      addLog("Charging initiated...");
      return;
    }

    // B. Have work?
    if (bot.queue.length > 0) {
      const nextItem = bot.queue[0];
      const shelf = shelves.find(s => s.id === nextItem.shelfId);
      
      const estDist = (Math.abs(bot.x - pickupPoint.x) + Math.abs(bot.y - pickupPoint.y)) + 
                      (Math.abs(pickupPoint.x - shelf.x) + Math.abs(pickupPoint.y - shelf.y)) +
                      (Math.abs(shelf.x - chargePoint.x) + Math.abs(shelf.y - chargePoint.y));
      const needed = estDist * BATTERY_COST + 15;

      if (bot.battery < needed) {
        addLog(`Battery Low (${Math.round(bot.battery)}%). Requesting Charge.`);
        goToCharge(bot);
      } else {
        addLog(`Processing Job: ${nextItem.name}`);
        const { path, visited } = findPath(bot, pickupPoint, rows, cols, obstacles);
        if (path.length > 0) {
          bot.path = path;
          bot.visitedNodes = visited;
          bot.state = 'MOVING';
        } else {
          addLog("Error: Pickup blocked!");
        }
      }
    } else {
      if (bot.x !== chargePoint.x || bot.y !== chargePoint.y) {
        addLog("Queue empty. Returning to base.");
        goToCharge(bot);
      }
    }
  };

  const goToCharge = (bot) => {
    const { path, visited } = findPath(bot, chargePoint, rows, cols, obstacles);
    if (path.length > 0) {
      bot.path = path;
      bot.visitedNodes = visited;
      bot.state = 'MOVING';
    }
  };

  const handleArrival = (bot) => {
    if (bot.x === pickupPoint.x && bot.y === pickupPoint.y && bot.queue.length > 0 && !bot.heldItem) {
      bot.state = 'PICKING';
      bot.waitTicks = 3;
      addLog("Arrived at Pickup. Identifying Object...");
    }
    else if (bot.heldItem) {
      const targetShelf = shelves.find(s => s.id === bot.heldItem.shelfId);
      if (bot.x === targetShelf.x && bot.y === targetShelf.y) {
        bot.state = 'DROPPING';
        bot.waitTicks = 3;
        addLog(`Aligning with Shelf ${targetShelf.uid}...`);
      }
    }
    else if (bot.x === chargePoint.x && bot.y === chargePoint.y) {
      bot.battery < 100 ? (bot.state = 'CHARGING') : (bot.state = 'IDLE');
      if(bot.state === 'CHARGING') addLog("Docked successfully.");
    }
    else {
      bot.state = 'IDLE';
    }
  };

  // --- MANUAL CONTROL ---
  const handleManualMove = (dx, dy) => {
    const bot = robotRef.current;
    const nx = bot.x + dx;
    const ny = bot.y + dy;
    
    if (nx >= 0 && nx < cols && ny >= 0 && ny < rows && !obstacles.has(`${nx},${ny}`)) {
      bot.x = nx;
      bot.y = ny;
      bot.battery -= BATTERY_COST;
      setRenderBot({...bot});
    }
  };

  const toggleObstacle = (x, y) => {
    const key = `${x},${y}`;
    if ((x===chargePoint.x && y===chargePoint.y) || (x===pickupPoint.x && y===pickupPoint.y)) return;
    if (shelves.some(s => s.x === x && s.y === y)) return;
    const newSet = new Set(obstacles);
    newSet.has(key) ? newSet.delete(key) : newSet.add(key);
    setObstacles(newSet);
  };

  const addRandomJob = () => {
    const types = [
       { name: 'Alpha-Red', uid: 'A-1', shelfId: 'shelf-1', color: 'bg-red-500' },
       { name: 'Beta-Blue', uid: 'B-2', shelfId: 'shelf-2', color: 'bg-blue-500' },
       { name: 'Gamma-Grn', uid: 'C-3', shelfId: 'shelf-3', color: 'bg-green-500' },
    ];
    const lastItem = robotRef.current.queue[robotRef.current.queue.length - 1];
    let availableTypes = types;
    if (lastItem) availableTypes = types.filter(t => t.shelfId !== lastItem.shelfId);
    if (availableTypes.length === 0) availableTypes = types;
    const newItem = { ...availableTypes[Math.floor(Math.random() * availableTypes.length)], id: `new-${Date.now()}` };
    robotRef.current.queue.push(newItem);
    setRenderBot({...robotRef.current});
    addLog(`System Input: ${newItem.name}`);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-sans flex flex-col items-center p-4">
      {/* --- HEADER --- */}
      <div className="w-full max-w-7xl mb-4 flex justify-between items-center bg-gray-900 p-4 rounded-xl border border-gray-800 shadow-xl">
         <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
               <Database className="text-blue-500"/> AWMS <span className="text-gray-500">DASHBOARD v2.0</span>
            </h1>
         </div>
         <div className="flex gap-4">
            {/* Battery Indicator */}
            <div className={`flex items-center gap-3 px-4 py-2 rounded-lg border ${renderBot.battery < 20 ? 'bg-red-900/20 border-red-500' : 'bg-gray-800 border-gray-700'}`}>
               <div className="text-right">
                  <div className="text-[10px] text-gray-400 uppercase">Energy</div>
                  <div className="font-mono font-bold">{Math.round(renderBot.battery)}%</div>
               </div>
               {renderBot.state === 'CHARGING' ? <BatteryCharging className="text-green-400 animate-pulse"/> : <Battery className={renderBot.battery < 20 ? 'text-red-500' : 'text-green-500'}/>}
            </div>
            
            {/* Main Toggle */}
            <button 
               onClick={() => {
                 setIsRunning(!isRunning); 
                 if(!isRunning) setManualMode(false);
               }}
               className={`px-6 py-2 rounded-lg font-bold flex items-center gap-2 transition-all ${isRunning ? 'bg-red-600 hover:bg-red-700 shadow-lg shadow-red-900/20' : 'bg-green-600 hover:bg-green-700 shadow-lg shadow-green-900/20'}`}
            >
               {isRunning ? <><Pause size={18}/> STOP AI</> : <><Play size={18}/> START AI</>}
            </button>
         </div>
      </div>

      <div className="w-full max-w-7xl flex flex-col lg:flex-row gap-6">
        
        {/* --- LEFT SIDEBAR (Controls) --- */}
        <div className="lg:w-80 flex flex-col gap-4">
           
           {/* Telemetry Card (NEW) */}
           <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
             <h3 className="text-xs font-bold text-blue-400 uppercase mb-3 flex items-center gap-2"><Activity size={14}/> Live Analytics</h3>
             <div className="grid grid-cols-2 gap-2">
               <div className="bg-gray-800 p-2 rounded">
                 <div className="text-[10px] text-gray-500">Distance</div>
                 <div className="text-lg font-mono">{stats.distance}m</div>
               </div>
               <div className="bg-gray-800 p-2 rounded">
                 <div className="text-[10px] text-gray-500">Jobs Done</div>
                 <div className="text-lg font-mono text-green-400">{stats.jobs}</div>
               </div>
               <div className="bg-gray-800 p-2 rounded">
                 <div className="text-[10px] text-gray-500">Charge Cycles</div>
                 <div className="text-lg font-mono text-yellow-500">{stats.charges}</div>
               </div>
               <div className="bg-gray-800 p-2 rounded">
                 <div className="text-[10px] text-gray-500">Status</div>
                 <div className={`text-xs font-bold ${renderBot.state === 'IDLE' ? 'text-gray-400' : 'text-blue-400 animate-pulse'}`}>{renderBot.state}</div>
               </div>
             </div>
           </div>

           {/* Settings Card */}
           <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 space-y-4">
              <h3 className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2"><Cpu size={14}/> System Control</h3>
              
              {/* Grid Size Controls (ADDED BACK) */}
              <div className="flex gap-2 mb-2">
                <div className="flex-1 bg-gray-800 p-2 rounded flex flex-col items-center">
                    <span className="text-[10px] text-gray-500 uppercase">Cols</span>
                    <div className="flex items-center gap-2">
                        <button disabled={isRunning} onClick={()=>setCols(c=>Math.max(5,c-1))} className="hover:text-blue-400 disabled:opacity-30"><Minus size={12}/></button>
                        <span className="font-mono font-bold text-sm">{cols}</span>
                        <button disabled={isRunning} onClick={()=>setCols(c=>Math.min(25,c+1))} className="hover:text-blue-400 disabled:opacity-30"><Plus size={12}/></button>
                    </div>
                </div>
                <div className="flex-1 bg-gray-800 p-2 rounded flex flex-col items-center">
                    <span className="text-[10px] text-gray-500 uppercase">Rows</span>
                    <div className="flex items-center gap-2">
                        <button disabled={isRunning} onClick={()=>setRows(r=>Math.max(5,r-1))} className="hover:text-blue-400 disabled:opacity-30"><Minus size={12}/></button>
                        <span className="font-mono font-bold text-sm">{rows}</span>
                        <button disabled={isRunning} onClick={()=>setRows(r=>Math.min(20,r+1))} className="hover:text-blue-400 disabled:opacity-30"><Plus size={12}/></button>
                    </div>
                </div>
              </div>

              {/* Simulation Speed Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Sim Speed</span>
                  <span>{speed}ms</span>
                </div>
                <input 
                  type="range" min="50" max="800" step="50" 
                  value={speed} onChange={(e) => setSpeed(Number(e.target.value))}
                  className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-[8px] text-gray-600">
                   <span>Fast</span>
                   <span>Slow</span>
                </div>
              </div>

              {/* Toggles */}
              <div className="flex flex-col gap-2">
                <button 
                  onClick={() => setShowScan(!showScan)}
                  className={`w-full py-2 text-xs font-bold rounded flex items-center justify-center gap-2 border transition-all ${showScan ? 'bg-purple-900/30 border-purple-500 text-purple-400' : 'bg-gray-800 border-gray-700 text-gray-400'}`}
                >
                  <MapIcon size={14}/> {showScan ? 'HIDE A* SCAN' : 'SHOW A* SCAN'}
                </button>

                <button 
                  onClick={() => setEditMode(!editMode)}
                  className={`w-full py-2 text-xs font-bold rounded flex items-center justify-center gap-2 border transition-all ${editMode ? 'bg-yellow-900/30 border-yellow-500 text-yellow-500' : 'bg-gray-800 border-gray-700 text-gray-400'}`}
                >
                  {editMode ? 'DONE EDITING' : 'EDIT MAP'}
                </button>
                
                <button 
                  onClick={() => {
                    setManualMode(!manualMode);
                    setIsRunning(false); // Stop AI when manual
                  }}
                  className={`w-full py-2 text-xs font-bold rounded flex items-center justify-center gap-2 border transition-all ${manualMode ? 'bg-orange-900/30 border-orange-500 text-orange-400' : 'bg-gray-800 border-gray-700 text-gray-400'}`}
                >
                  <Gamepad2 size={14}/> {manualMode ? 'MANUAL: ON' : 'MANUAL: OFF'}
                </button>
              </div>
           </div>

           {/* Manual Controls (Conditional) */}
           {manualMode && (
             <div className="bg-gray-900 rounded-xl p-4 border border-orange-500/30 shadow-lg shadow-orange-900/10">
               <div className="text-xs text-orange-400 mb-2 text-center uppercase font-bold">Teleoperation</div>
               <div className="flex flex-col items-center gap-2">
                 <button onClick={() => handleManualMove(0, -1)} className="p-2 bg-gray-800 hover:bg-orange-600 rounded"><ArrowUp size={16}/></button>
                 <div className="flex gap-2">
                   <button onClick={() => handleManualMove(-1, 0)} className="p-2 bg-gray-800 hover:bg-orange-600 rounded"><ArrowLeft size={16}/></button>
                   <button onClick={() => handleManualMove(0, 1)} className="p-2 bg-gray-800 hover:bg-orange-600 rounded"><ArrowDown size={16}/></button>
                   <button onClick={() => handleManualMove(1, 0)} className="p-2 bg-gray-800 hover:bg-orange-600 rounded"><ArrowRight size={16}/></button>
                 </div>
               </div>
             </div>
           )}

           {/* Job Queue */}
           <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 flex flex-col gap-3 flex-1 min-h-[150px]">
              <div className="flex justify-between items-center border-b border-gray-800 pb-2">
                 <h3 className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2"><Box size={14}/> Queue</h3>
                 <span className="text-[10px] bg-gray-800 px-2 py-0.5 rounded text-gray-400">{robotRef.current.queue.length}</span>
              </div>
              
              <div className="space-y-2 flex-1 overflow-y-auto max-h-40">
                 {robotRef.current.queue.length === 0 && !renderBot.heldItem && <div className="text-xs text-gray-600 italic text-center mt-4">System Idle</div>}
                 
                 {renderBot.heldItem && (
                    <div className="p-2 bg-blue-900/20 border-l-2 border-blue-500 rounded-r flex items-center justify-between">
                       <span className="text-xs font-bold text-blue-200">{renderBot.heldItem.name}</span>
                       <span className="text-[10px] text-blue-400 animate-pulse">EXECUTING</span>
                    </div>
                 )}
                 {robotRef.current.queue.map(item => (
                    <div key={item.id} className="p-2 bg-gray-800/50 border-l-2 border-gray-600 rounded-r flex items-center justify-between opacity-70">
                       <span className="text-xs text-gray-300">{item.name}</span>
                       <span className="text-[10px] text-gray-500">{item.uid}</span>
                    </div>
                 ))}
              </div>

              <button 
                onClick={addRandomJob}
                className="w-full py-2 text-xs font-bold bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-400 rounded flex items-center justify-center gap-2 transition-colors mt-auto"
              >
                <PackagePlus size={14} /> NEW ORDER
              </button>
           </div>
        </div>

        {/* --- MAIN CANVAS --- */}
        <div className="flex-1 flex flex-col gap-4">
          
          {/* Grid Container */}
          <div className="flex-1 bg-gray-900 rounded-xl border border-gray-800 p-8 flex items-center justify-center overflow-auto shadow-inner relative group">
             
             {/* Dynamic Grid */}
             <div 
               className="relative grid gap-px bg-gray-800 border border-gray-700 shadow-2xl p-1"
               style={{
                 gridTemplateColumns: `repeat(${cols}, ${TILE_SIZE}px)`,
                 gridTemplateRows: `repeat(${rows}, ${TILE_SIZE}px)`
               }}
             >
                {Array.from({length: rows}).map((_, y) => (
                   Array.from({length: cols}).map((_, x) => {
                      const isWall = obstacles.has(`${x},${y}`);
                      const isRobot = renderBot.x === x && renderBot.y === y;
                      const isPath = renderBot.path.some(p => p.x === x && p.y === y);
                      const isVisited = showScan && renderBot.visitedNodes.some(v => v.x === x && v.y === y);
                      const shelf = shelves.find(s => s.x === x && s.y === y);
                      const isStart = x === chargePoint.x && y === chargePoint.y;
                      const isPickup = x === pickupPoint.x && y === pickupPoint.y;

                      return (
                         <div 
                           key={`${x}-${y}`} 
                           onClick={() => editMode && toggleObstacle(x,y)}
                           className={`
                             relative flex items-center justify-center transition-colors duration-300
                             ${isWall ? 'bg-gray-600 shadow-inner' : 'bg-gray-950'}
                             ${editMode && !isWall && !shelf && !isStart && !isPickup ? 'hover:bg-gray-800 cursor-pointer' : ''}
                             ${isPath && !isRobot ? 'bg-blue-500/20' : ''}
                             ${isVisited && !isPath && !isRobot && !isWall ? 'bg-yellow-500/10' : ''}
                           `}
                           style={{ width: TILE_SIZE, height: TILE_SIZE }}
                         >
                            {/* Visited Scan Dot */}
                            {isVisited && !isPath && !isRobot && <div className="w-1 h-1 bg-yellow-500/30 rounded-full"></div>}

                            {/* Path Dot */}
                            {isPath && !isRobot && <div className="w-1.5 h-1.5 bg-blue-500/50 rounded-full"></div>}

                            {/* Markers */}
                            {isStart && <BatteryCharging size={18} className="text-green-600"/>}
                            
                            {isPickup && (
                              <div className="relative w-full h-full flex items-center justify-center bg-yellow-900/10 border border-yellow-900/30">
                                 <Box size={16} className="text-yellow-600"/>
                                 {robotRef.current.queue.length > 0 && (
                                   <div className="absolute -top-2 -right-2 bg-yellow-500 text-black text-[9px] w-4 h-4 flex items-center justify-center rounded-full font-bold shadow-sm">
                                     {robotRef.current.queue.length}
                                   </div>
                                 )}
                              </div>
                            )}
                            
                            {shelf && (
                               <div className={`w-full h-full border-2 ${shelf.color} bg-gray-900 flex flex-col items-center justify-center relative overflow-hidden`}>
                                  <div className={`absolute inset-0 ${shelf.baseColor} opacity-10`}></div>
                                  <span className="text-[9px] font-bold z-10">{shelf.uid}</span>
                               </div>
                            )}

                            {/* Robot - With Transition */}
                            <div 
                              className={`absolute inset-0 flex items-center justify-center z-20 pointer-events-none transition-all duration-300 ease-linear`}
                              style={{ 
                                transform: isRobot ? 'scale(1)' : 'scale(0)',
                                opacity: isRobot ? 1 : 0
                              }}
                            >
                               {isRobot && (
                                 <div className="w-[80%] h-[80%] bg-blue-500 rounded shadow-lg shadow-blue-500/50 flex items-center justify-center relative">
                                    {renderBot.heldItem && <div className={`absolute -top-2 -right-2 w-3 h-3 rounded-full ${renderBot.heldItem.color} border border-white shadow-sm z-30`}></div>}
                                    <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
                                 </div>
                               )}
                            </div>
                         </div>
                      );
                   })
                ))}
             </div>
          </div>

          {/* Terminal / Logs */}
          <div className="h-32 bg-black rounded-xl border border-gray-800 p-3 font-mono text-[10px] text-green-400 overflow-y-auto shadow-inner">
              {logs.map((l,i) => <div key={i} className="mb-0.5 border-l-2 border-green-900 pl-2 opacity-80 hover:opacity-100">{l}</div>)}
              <div ref={logsEndRef}/>
           </div>

        </div>
      </div>
    </div>
  );
}
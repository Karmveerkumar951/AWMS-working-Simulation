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
  PackagePlus
} from 'lucide-react';

// --- A* ALGORITHM (Pure Logic) ---
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
  if (!start || !end) return [];
  const openList = [];
  const closedList = new Set();
  
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
    
    // Success
    if (currentNode.x === endNode.x && currentNode.y === endNode.y) {
      let curr = currentNode;
      let ret = [];
      while (curr.parent) {
        ret.push({ x: curr.x, y: curr.y });
        curr = curr.parent;
      }
      return ret.reverse();
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
  return []; 
};

// --- CONSTANTS ---
const TILE_SIZE = 36;
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
  
  // We use a Ref for the robot logic to avoid React Render Cycles causing crashes
  const robotRef = useRef({
    x: 0,
    y: 0,
    battery: 100,
    state: 'IDLE', // IDLE, MOVING, PICKING, DROPPING, CHARGING
    heldItem: null,
    path: [],
    waitTicks: 0, // For pauses (picking/dropping) instead of setTimeout
    queue: [...INITIAL_ITEMS]
  });

  // This state is JUST for rendering the screen
  const [renderBot, setRenderBot] = useState({...robotRef.current});

  const logsEndRef = useRef(null);
  
  // Fixed Locations
  const chargePoint = { x: 0, y: 0 };
  const pickupPoint = { x: 0, y: Math.floor(rows/2) };
  
  // Dynamic Shelves based on grid size
  const getShelves = (r, c) => [
    { id: 'shelf-1', uid: 'A-1', x: c-2, y: 1, color: 'border-red-500 text-red-500', baseColor: 'bg-red-500' },
    { id: 'shelf-2', uid: 'B-2', x: c-2, y: Math.floor(r/2), color: 'border-blue-500 text-blue-500', baseColor: 'bg-blue-500' },
    { id: 'shelf-3', uid: 'C-3', x: c-2, y: r-2, color: 'border-green-500 text-green-500', baseColor: 'bg-green-500' }
  ];
  
  const shelves = getShelves(rows, cols);

  const addLog = (msg) => {
    setLogs(prev => [...prev.slice(-14), `[${new Date().toLocaleTimeString().split(' ')[0]}] ${msg}`]);
  };

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // --- ENGINE LOOP ---
  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      const bot = robotRef.current; // Direct access to mutable state
      let updated = false;

      // 0. Handle Wait Timers (Picking/Dropping simulation)
      if (bot.waitTicks > 0) {
        bot.waitTicks--;
        if (bot.waitTicks === 0) {
          // Action complete
          if (bot.state === 'PICKING') {
            const item = bot.queue.shift(); // Remove from queue
            bot.heldItem = item;
            addLog(`Picked up ${item.name}. Pathing to Shelf...`);
            
            // Plan to Shelf
            const shelf = shelves.find(s => s.id === item.shelfId);
            const path = findPath(bot, shelf, rows, cols, obstacles);
            if(path.length > 0) {
              bot.path = path;
              bot.state = 'MOVING';
            } else {
              addLog("Error: No path to shelf!");
              bot.state = 'IDLE';
            }
          } 
          else if (bot.state === 'DROPPING') {
            addLog(`Delivered ${bot.heldItem.name} to ${bot.heldItem.uid}.`);
            bot.heldItem = null;
            bot.state = 'IDLE'; // Will trigger next decision next tick
          }
        }
        setRenderBot({...bot}); // Update UI
        return;
      }

      // 1. Charging Logic
      if (bot.state === 'CHARGING') {
        if (bot.battery >= 100) {
          bot.battery = 100;
          bot.state = 'IDLE';
          addLog("Charged. Resuming.");
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
        
        // Critical Battery Check
        if (bot.battery < 5 && bot.heldItem === null) {
          addLog("CRITICAL BATTERY. Aborting to Charger.");
          const chargePath = findPath(bot, chargePoint, rows, cols, obstacles);
          bot.path = chargePath;
          // Stay in MOVING state, just changed path
        }
        
        // Arrival
        if (bot.path.length === 0) {
          handleArrival(bot);
        }
        updated = true;
      }

      // 3. Decision Logic (Brain)
      else if (bot.state === 'IDLE') {
        decideNextMove(bot);
        updated = true;
      }

      if (updated) setRenderBot({...bot}); // Sync to React State for render
    }, 200); // Speed

    return () => clearInterval(interval);
  }, [isRunning, rows, cols, obstacles]);

  // --- DECISION FUNCTIONS ---
  
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
      
      // Battery Check: Pickup + Shelf + Return
      const estDist = (Math.abs(bot.x - pickupPoint.x) + Math.abs(bot.y - pickupPoint.y)) + 
                      (Math.abs(pickupPoint.x - shelf.x) + Math.abs(pickupPoint.y - shelf.y)) +
                      (Math.abs(shelf.x - chargePoint.x) + Math.abs(shelf.y - chargePoint.y));
      
      const needed = estDist * BATTERY_COST + 15; // Buffer

      if (bot.battery < needed) {
        addLog(`Battery Low for Mission (${Math.round(bot.battery)}% < ${Math.round(needed)}%). returning to charge.`);
        goToCharge(bot);
      } else {
        // Go to Pickup
        addLog(`Mission: Get ${nextItem.name}`);
        const path = findPath(bot, pickupPoint, rows, cols, obstacles);
        if (path.length > 0) {
          bot.path = path;
          bot.state = 'MOVING';
        } else {
          addLog("Error: Pickup path blocked.");
        }
      }
    } else {
      // C. No work. Go home if not there.
      if (bot.x !== chargePoint.x || bot.y !== chargePoint.y) {
        addLog("All tasks done. Returning to base.");
        goToCharge(bot);
      }
    }
  };

  const goToCharge = (bot) => {
    const path = findPath(bot, chargePoint, rows, cols, obstacles);
    if (path.length > 0) {
      bot.path = path;
      bot.state = 'MOVING';
    }
  };

  const handleArrival = (bot) => {
    // Where did we arrive?
    
    // 1. At Pickup?
    if (bot.x === pickupPoint.x && bot.y === pickupPoint.y && bot.queue.length > 0 && !bot.heldItem) {
      bot.state = 'PICKING';
      bot.waitTicks = 3; // Wait 3 ticks (approx 1 sec)
      addLog("Arrived at Pickup. Loading...");
    }
    // 2. At Shelf?
    else if (bot.heldItem) {
      const targetShelf = shelves.find(s => s.id === bot.heldItem.shelfId);
      if (bot.x === targetShelf.x && bot.y === targetShelf.y) {
        bot.state = 'DROPPING';
        bot.waitTicks = 3;
        addLog(`Arrived at Shelf ${targetShelf.uid}. Unloading...`);
      }
    }
    // 3. At Charger?
    else if (bot.x === chargePoint.x && bot.y === chargePoint.y) {
      if (bot.battery < 100) {
        bot.state = 'CHARGING';
        addLog("Docked. Charging...");
      } else {
        bot.state = 'IDLE';
      }
    }
    // 4. Just an intermediate stop?
    else {
      bot.state = 'IDLE';
    }
  };


  // --- USER INTERACTION ---
  const toggleObstacle = (x, y) => {
    const key = `${x},${y}`;
    // Protect zones
    if ((x===chargePoint.x && y===chargePoint.y) || (x===pickupPoint.x && y===pickupPoint.y)) return;
    if (shelves.some(s => s.x === x && s.y === y)) return;

    const newSet = new Set(obstacles);
    if (newSet.has(key)) newSet.delete(key);
    else newSet.add(key);
    setObstacles(newSet);
  };

  const resetSim = () => {
    setIsRunning(false);
    robotRef.current = {
      x: 0,
      y: 0,
      battery: 100,
      state: 'IDLE',
      heldItem: null,
      path: [],
      waitTicks: 0,
      queue: [...INITIAL_ITEMS]
    };
    setRenderBot({...robotRef.current});
    setLogs(['System Reset.']);
  };

  // --- UPDATED ADD RANDOM JOB LOGIC ---
  const addRandomJob = () => {
    const types = [
       { name: 'Alpha-Red', uid: 'A-1', shelfId: 'shelf-1', color: 'bg-red-500' },
       { name: 'Beta-Blue', uid: 'B-2', shelfId: 'shelf-2', color: 'bg-blue-500' },
       { name: 'Gamma-Grn', uid: 'C-3', shelfId: 'shelf-3', color: 'bg-green-500' },
    ];
    
    // Logic: Look at the LAST item in the queue.
    // We want the new item to have a DIFFERENT shelfId than the last item.
    // This forces rotation/variety.
    
    const lastItem = robotRef.current.queue[robotRef.current.queue.length - 1];
    let availableTypes = types;

    if (lastItem) {
        // Filter out the shelf of the last item
        availableTypes = types.filter(t => t.shelfId !== lastItem.shelfId);
    }
    
    // Safety check: if queue was empty, or logic fail, use all types
    if (availableTypes.length === 0) availableTypes = types;

    const randomType = availableTypes[Math.floor(Math.random() * availableTypes.length)];
    
    const newItem = {
      ...randomType,
      id: `new-${Date.now()}`,
    };
    
    robotRef.current.queue.push(newItem);
    setRenderBot({...robotRef.current}); // Force update
    addLog(`User added: ${newItem.name}`);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-sans flex flex-col items-center p-4">
      {/* Header */}
      <div className="w-full max-w-6xl mb-4 flex justify-between items-center bg-gray-900 p-4 rounded-xl border border-gray-800 shadow-xl">
         <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
               <Database className="text-blue-500"/> 
               AWMS <span className="text-gray-500">CONTROL</span>
            </h1>
         </div>
         <div className="flex gap-4">
            <div className={`flex items-center gap-3 px-4 py-2 rounded-lg border ${renderBot.battery < 20 ? 'bg-red-900/20 border-red-500' : 'bg-gray-800 border-gray-700'}`}>
               <div className="text-right">
                  <div className="text-[10px] text-gray-400 uppercase">Battery</div>
                  <div className="font-mono font-bold">{Math.round(renderBot.battery)}%</div>
               </div>
               {renderBot.state === 'CHARGING' ? <BatteryCharging className="text-green-400 animate-pulse"/> : <Battery className={renderBot.battery < 20 ? 'text-red-500' : 'text-green-500'}/>}
            </div>
            <button 
               onClick={() => setIsRunning(!isRunning)}
               className={`px-6 py-2 rounded-lg font-bold flex items-center gap-2 transition-all ${isRunning ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}
            >
               {isRunning ? <><Pause size={18}/> STOP</> : <><Play size={18}/> START</>}
            </button>
         </div>
      </div>

      <div className="w-full max-w-6xl flex flex-col md:flex-row gap-6">
        {/* Sidebar */}
        <div className="md:w-72 flex flex-col gap-4">
           
           {/* Controls */}
           <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 space-y-3">
              <h3 className="text-xs font-bold text-gray-500 uppercase">Warehouse Grid</h3>
              
              {/* Rows and Cols Controls */}
              <div className="flex justify-between items-center text-sm bg-gray-800/50 p-2 rounded">
                 <span className="text-gray-300">Width (Cols)</span>
                 <div className="flex gap-2 items-center">
                    <span className="font-mono w-6 text-center">{cols}</span>
                    <button disabled={isRunning} onClick={()=>setCols(c=>Math.max(5,c-1))} className="p-1 bg-gray-700 rounded hover:bg-gray-600 disabled:opacity-30"><Minus size={12}/></button>
                    <button disabled={isRunning} onClick={()=>setCols(c=>Math.min(25,c+1))} className="p-1 bg-gray-700 rounded hover:bg-gray-600 disabled:opacity-30"><Plus size={12}/></button>
                 </div>
              </div>

              <div className="flex justify-between items-center text-sm bg-gray-800/50 p-2 rounded">
                 <span className="text-gray-300">Height (Rows)</span>
                 <div className="flex gap-2 items-center">
                    <span className="font-mono w-6 text-center">{rows}</span>
                    <button disabled={isRunning} onClick={()=>setRows(r=>Math.max(5,r-1))} className="p-1 bg-gray-700 rounded hover:bg-gray-600 disabled:opacity-30"><Minus size={12}/></button>
                    <button disabled={isRunning} onClick={()=>setRows(r=>Math.min(20,r+1))} className="p-1 bg-gray-700 rounded hover:bg-gray-600 disabled:opacity-30"><Plus size={12}/></button>
                 </div>
              </div>

              <div className="h-px bg-gray-800 my-2"></div>

              <button 
                 onClick={() => setEditMode(!editMode)}
                 className={`w-full py-2 text-xs font-bold rounded flex items-center justify-center gap-2 border transition-all ${editMode ? 'bg-yellow-900/50 border-yellow-600 text-yellow-500' : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'}`}
              >
                 {editMode ? 'DONE EDITING' : 'ADD OBSTACLES'}
              </button>
              <button onClick={resetSim} className="w-full py-2 text-xs font-bold bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded text-gray-300 flex items-center justify-center gap-2">
                 <RotateCcw size={14}/> RESET SYSTEM
              </button>
           </div>

           {/* Queue Card */}
           <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 flex flex-col gap-3">
              <div className="flex justify-between items-center">
                 <h3 className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2"><Box size={14}/> Job Queue</h3>
                 <span className="text-xs bg-gray-800 px-2 py-0.5 rounded text-gray-400">{robotRef.current.queue.length} Pending</span>
              </div>
              
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                 {robotRef.current.queue.length === 0 && !renderBot.heldItem && <div className="text-xs text-gray-600 italic py-2 text-center">No pending jobs</div>}
                 
                 {renderBot.heldItem && (
                    <div className="p-2 bg-blue-900/30 border border-blue-500/50 rounded flex items-center gap-2 animate-pulse">
                       <div className={`w-2 h-2 rounded-full ${renderBot.heldItem.color}`}></div>
                       <div className="text-xs">
                          <span className="block font-bold text-white">ACTIVE: {renderBot.heldItem.name}</span>
                       </div>
                    </div>
                 )}
                 {robotRef.current.queue.map(item => (
                    <div key={item.id} className="p-2 bg-gray-800 rounded flex items-center justify-between opacity-80">
                       <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${item.color}`}></div>
                          <span className="text-xs font-mono">{item.name}</span>
                       </div>
                       <span className="text-[10px] text-gray-500">{item.uid}</span>
                    </div>
                 ))}
              </div>

              {/* Add Object Button */}
              <button 
                onClick={addRandomJob}
                className="w-full py-2 text-xs font-bold bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-400 rounded flex items-center justify-center gap-2 transition-colors"
              >
                <PackagePlus size={14} /> ADD RANDOM JOB
              </button>
           </div>
           
           {/* Terminal */}
           <div className="flex-1 bg-black rounded-xl border border-gray-800 p-3 font-mono text-[10px] text-green-400 overflow-y-auto max-h-[250px] shadow-inner">
              {logs.map((l,i) => <div key={i} className="mb-1 border-l border-green-900 pl-2">{l}</div>)}
              <div ref={logsEndRef}/>
           </div>
        </div>

        {/* Main Canvas */}
        <div className="flex-1 bg-gray-900 rounded-xl border border-gray-800 p-6 flex items-center justify-center overflow-auto shadow-inner relative">
           
           {/* Legend */}
           <div className="absolute top-4 left-4 flex flex-col gap-2 pointer-events-none z-10">
              <div className="flex items-center gap-2 bg-black/60 p-1.5 rounded backdrop-blur-sm border border-gray-700">
                <div className="w-3 h-3 bg-blue-500 rounded-sm"></div> <span className="text-[10px] text-gray-300">Robot</span>
              </div>
              <div className="flex items-center gap-2 bg-black/60 p-1.5 rounded backdrop-blur-sm border border-gray-700">
                <div className="w-3 h-3 bg-blue-900/50 border border-blue-500/30"></div> <span className="text-[10px] text-gray-300">Path</span>
              </div>
           </div>

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
                    const shelf = shelves.find(s => s.x === x && s.y === y);
                    const isStart = x === chargePoint.x && y === chargePoint.y;
                    const isPickup = x === pickupPoint.x && y === pickupPoint.y;

                    return (
                       <div 
                         key={`${x}-${y}`} 
                         onClick={() => editMode && toggleObstacle(x,y)}
                         className={`
                           w-[36px] h-[36px] relative flex items-center justify-center
                           ${isWall ? 'bg-gray-600' : 'bg-gray-950'}
                           ${editMode && !isWall && !shelf && !isStart && !isPickup ? 'hover:bg-gray-800 cursor-pointer' : ''}
                           ${isPath && !isRobot ? 'bg-blue-900/30' : ''}
                         `}
                       >
                          {/* Markers */}
                          {isStart && <BatteryCharging size={16} className="text-green-600 opacity-50"/>}
                          
                          {/* Pickup Zone with Count */}
                          {isPickup && (
                            <div className="relative w-full h-full flex items-center justify-center bg-yellow-900/10">
                               <Box size={16} className="text-yellow-600 opacity-50"/>
                               {robotRef.current.queue.length > 0 && (
                                 <div className="absolute -top-1 -right-1 bg-yellow-500 text-black text-[8px] w-3 h-3 flex items-center justify-center rounded-full font-bold">
                                   {robotRef.current.queue.length}
                                 </div>
                               )}
                            </div>
                          )}
                          
                          {/* Shelf */}
                          {shelf && (
                             <div className={`w-full h-full border ${shelf.color} bg-gray-900 flex flex-col items-center justify-center relative overflow-hidden group`}>
                                <div className={`absolute inset-0 ${shelf.baseColor} opacity-5 group-hover:opacity-10`}></div>
                                <div className="text-[8px] font-bold z-10">{shelf.uid}</div>
                                <div className="w-4 h-0.5 bg-current opacity-50 z-10"></div>
                             </div>
                          )}

                          {/* Robot */}
                          {isRobot && (
                             <div className="absolute inset-0 flex items-center justify-center z-20">
                                <div className="w-6 h-6 bg-blue-500 rounded-sm shadow-lg shadow-blue-500/50 flex items-center justify-center transition-transform duration-300">
                                   {renderBot.heldItem && <div className={`w-3 h-3 rounded-full ${renderBot.heldItem.color} border border-white shadow-sm`}></div>}
                                   {!renderBot.heldItem && <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>}
                                </div>
                             </div>
                          )}
                       </div>
                    );
                 })
              ))}
           </div>
        </div>
      </div>
    </div>
  );
}
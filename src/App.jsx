import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, Html, useCursor } from '@react-three/drei';
import * as THREE from 'three';
import { 
  Play, Pause, Battery, BatteryCharging, Box, 
  Plus, Minus, Database, Activity, 
  Map as MapIcon, Gamepad2, ArrowUp, ArrowDown, ArrowLeft, ArrowRight,
  RotateCcw
} from 'lucide-react';

// --- A* ALGORITHM (Fixed & Optimized) ---
class Node {
  constructor(x, y, parent = null) {
    this.x = x; this.y = y; this.parent = parent;
    this.g = 0; this.h = 0; this.f = 0; 
  }
}

const findPath = (start, end, gridRows, gridCols, obstacles) => {
  if (!start || !end) return { path: [], visited: [] };
  
  const openList = [];
  const closedList = new Set();
  const visitedForViz = [];
  
  const startNode = new Node(start.x, start.y);
  const endNode = new Node(end.x, end.y);
  
  openList.push(startNode);
  
  while (openList.length > 0) {
    let lowestIndex = 0;
    for (let i = 1; i < openList.length; i++) {
      if (openList[i].f < openList[lowestIndex].f) lowestIndex = i;
    }
    
    let currentNode = openList[lowestIndex];
    visitedForViz.push({x: currentNode.x, y: currentNode.y});

    // Check Goal
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
      const nx = currentNode.x + nb.x;
      const ny = currentNode.y + nb.y;
      
      if (nx >= 0 && nx < gridCols && ny >= 0 && ny < gridRows && !obstacles.has(`${nx},${ny}`) && !closedList.has(`${nx},${ny}`)) {
        const gScore = currentNode.g + 1;
        let gScoreIsBest = false;
        const existing = openList.find(n => n.x === nx && n.y === ny);
        
        if (!existing) {
          gScoreIsBest = true;
          const newNode = new Node(nx, ny, currentNode);
          newNode.g = gScore;
          newNode.h = Math.abs(nx - endNode.x) + Math.abs(ny - endNode.y);
          newNode.f = newNode.g + newNode.h;
          openList.push(newNode);
        } else if (gScore < existing.g) {
          gScoreIsBest = true;
          existing.parent = currentNode;
          existing.g = gScore;
          existing.f = existing.g + existing.h;
        }
      }
    }
  }
  return { path: [], visited: visitedForViz }; 
};

// --- CONSTANTS ---
const BATTERY_COST = 0.2; 
const CHARGE_RATE = 5;

// --- 3D COMPONENTS ---
const FloorTile = ({ x, y, isWall, isPath, isVisited, isStart, isPickup, onClick, editMode, showScan }) => {
  const [hovered, setHover] = useState(false);
  useCursor(hovered && editMode);

  // Color Logic
  let color = "#1f2937"; // Default Floor (Gray-900)
  
  if (isWall) {
    color = "#4b5563"; // Wall (Gray-600)
  } else if (isPath) {
    // GREEN for Path (when scan is on), Blue otherwise
    color = showScan ? "#22c55e" : "#1e3a8a"; 
  } else if (isVisited && showScan) {
    // RED for Scanned/Visited but discarded
    color = "#b91c1c"; 
  } else if (hovered && editMode) {
    color = "#374151"; // Hover effect
  }

  const height = isWall ? 1 : 0.1;
  const yPos = isWall ? 0.5 : 0;

  return (
    <mesh 
      position={[x, yPos, y]} 
      onClick={(e) => { e.stopPropagation(); onClick(x, y); }}
      onPointerOver={() => setHover(true)}
      onPointerOut={() => setHover(false)}
    >
      <boxGeometry args={[0.95, height, 0.95]} />
      <meshStandardMaterial color={color} />
      
      {/* Markers */}
      {isStart && !isWall && <Html position={[0,0.2,0]} center transform sprite><div className="text-green-500 font-bold text-xs bg-black/50 px-1 rounded border border-green-500">BASE</div></Html>}
      {isPickup && !isWall && <Html position={[0,0.2,0]} center transform sprite><div className="text-yellow-500 font-bold text-xs bg-black/50 px-1 rounded border border-yellow-500">PICKUP</div></Html>}
    </mesh>
  );
};

const Robot3D = ({ x, y, heldItem }) => {
  const meshRef = useRef();
  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.position.x = THREE.MathUtils.lerp(meshRef.current.position.x, x, delta * 5);
      meshRef.current.position.z = THREE.MathUtils.lerp(meshRef.current.position.z, y, delta * 5);
    }
  });

  return (
    <group ref={meshRef} position={[x, 0.3, y]}>
      {/* Body */}
      <mesh position={[0, 0.25, 0]}>
        <boxGeometry args={[0.6, 0.3, 0.8]} />
        <meshStandardMaterial color="#3b82f6" />
      </mesh>
      {/* Wheels */}
      {[ [0.35, 0.25], [-0.35, 0.25], [0.35, -0.25], [-0.35, -0.25] ].map((pos, i) => (
         <mesh key={i} position={[pos[0], 0.1, pos[1]]} rotation={[0, 0, Math.PI/2]}>
            <cylinderGeometry args={[0.15, 0.15, 0.1, 16]} />
            <meshStandardMaterial color="#111" />
         </mesh>
      ))}
      {/* Sensor */}
      <mesh position={[0, 0.5, -0.2]}>
         <boxGeometry args={[0.2, 0.2, 0.2]} />
         <meshStandardMaterial color="#60a5fa" />
      </mesh>
      {/* Cargo */}
      {heldItem && (
        <group position={[0, 0.6, 0.1]}>
           <mesh>
             <boxGeometry args={[0.4, 0.4, 0.4]} />
             <meshStandardMaterial color={heldItem.color === 'bg-red-500' ? '#ef4444' : heldItem.color === 'bg-blue-500' ? '#3b82f6' : '#22c55e'} />
           </mesh>
        </group>
      )}
    </group>
  );
};

const Shelf3D = ({ x, y, uid, colorStr }) => {
  const color = colorStr.includes('red') ? '#ef4444' : colorStr.includes('blue') ? '#3b82f6' : '#22c55e';
  return (
    <group position={[x, 0, y]}>
      <mesh position={[0, 0.2, 0]}><boxGeometry args={[0.9, 0.05, 0.9]} /><meshStandardMaterial color={color} /></mesh>
      <mesh position={[0, 0.6, 0]}><boxGeometry args={[0.9, 0.05, 0.9]} /><meshStandardMaterial color={color} /></mesh>
      <mesh position={[0, 1.0, 0]}><boxGeometry args={[0.9, 0.05, 0.9]} /><meshStandardMaterial color={color} /></mesh>
      <mesh position={[0.4, 0.5, 0.4]}><boxGeometry args={[0.05, 1, 0.05]} /><meshStandardMaterial color="#333" /></mesh>
      <mesh position={[-0.4, 0.5, 0.4]}><boxGeometry args={[0.05, 1, 0.05]} /><meshStandardMaterial color="#333" /></mesh>
      <mesh position={[0.4, 0.5, -0.4]}><boxGeometry args={[0.05, 1, 0.05]} /><meshStandardMaterial color="#333" /></mesh>
      <mesh position={[-0.4, 0.5, -0.4]}><boxGeometry args={[0.05, 1, 0.05]} /><meshStandardMaterial color="#333" /></mesh>
      <Text position={[0, 1.3, 0]} fontSize={0.4} color="white" anchorX="center" anchorY="middle">
        {uid}
      </Text>
    </group>
  );
};

// --- MAIN APP ---

export default function App() {
  const [rows, setRows] = useState(10);
  const [cols, setCols] = useState(15);
  const [obstacles, setObstacles] = useState(new Set());
  const [editMode, setEditMode] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState(["System Ready."]);
  const [showScan, setShowScan] = useState(false);
  const [speed, setSpeed] = useState(200);
  const [manualMode, setManualMode] = useState(false);
  const [stats, setStats] = useState({ distance: 0, jobs: 0, charges: 0 });

  const initialItems = [
    { id: 'i1', name: 'Alpha-Red', uid: 'A-1', shelfId: 'shelf-1', color: 'bg-red-500' },
    { id: 'i2', name: 'Beta-Blue', uid: 'B-2', shelfId: 'shelf-2', color: 'bg-blue-500' },
    { id: 'i3', name: 'Gamma-Grn', uid: 'C-3', shelfId: 'shelf-3', color: 'bg-green-500' },
  ];

  const robotRef = useRef({
    x: 0, y: 0, battery: 100, state: 'IDLE', heldItem: null, path: [], visitedNodes: [], waitTicks: 0,
    queue: [...initialItems]
  });

  const [renderBot, setRenderBot] = useState({...robotRef.current});
  const logsEndRef = useRef(null);
  
  const chargePoint = { x: 0, y: 0 };
  const pickupPoint = { x: 0, y: Math.floor(rows/2) };
  
  const shelves = useMemo(() => [
    { id: 'shelf-1', uid: 'A-1', x: cols-2, y: 1, color: 'bg-red-500' },
    { id: 'shelf-2', uid: 'B-2', x: cols-2, y: Math.floor(rows/2), color: 'bg-blue-500' },
    { id: 'shelf-3', uid: 'C-3', x: cols-2, y: rows-2, color: 'bg-green-500' }
  ], [rows, cols]);

  const addLog = (msg) => {
    setLogs(prev => [...prev.slice(-19), `[${new Date().toLocaleTimeString().split(' ')[0]}] ${msg}`]);
  };

  useEffect(() => { logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [logs]);

  // Main Loop
  useEffect(() => {
    if (!isRunning || manualMode) return;
    const interval = setInterval(() => {
      const bot = robotRef.current;
      let updated = false;

      // Waiting logic
      if (bot.waitTicks > 0) {
        bot.waitTicks--;
        if (bot.waitTicks === 0) {
          if (bot.state === 'PICKING') {
            const item = bot.queue.shift();
            bot.heldItem = item;
            addLog(`Picked up ${item.name}. Routing...`);
            const shelf = shelves.find(s => s.id === item.shelfId);
            const { path, visited } = findPath(bot, shelf, rows, cols, obstacles);
            if(path.length) { bot.path = path; bot.visitedNodes = visited; bot.state = 'MOVING'; }
            else { addLog("Path blocked!"); bot.state = 'IDLE'; }
          } else if (bot.state === 'DROPPING') {
            addLog(`Delivered to ${bot.heldItem.uid}.`);
            setStats(s => ({...s, jobs: s.jobs + 1}));
            bot.heldItem = null; bot.visitedNodes = []; bot.state = 'IDLE';
          }
        }
        setRenderBot({...bot}); return;
      }

      // Charging Logic
      if (bot.state === 'CHARGING') {
        if (bot.battery >= 100) {
          bot.battery = 100; bot.state = 'IDLE';
          setStats(s => ({...s, charges: s.charges + 1}));
          addLog("Charged. Resuming.");
        } else bot.battery += CHARGE_RATE;
        updated = true;
      } 
      // Movement Logic
      else if (bot.state === 'MOVING' && bot.path.length > 0) {
        bot.battery -= BATTERY_COST;
        const next = bot.path.shift();
        bot.x = next.x; bot.y = next.y;
        setStats(s => ({...s, distance: s.distance + 1}));
        if (bot.battery < 10 && !bot.heldItem) {
          addLog("LOW BATTERY. Rerouting.");
          const { path, visited } = findPath(bot, chargePoint, rows, cols, obstacles);
          bot.path = path; bot.visitedNodes = visited;
        }
        if (bot.path.length === 0) handleArrival(bot);
        updated = true;
      } 
      // Decision Logic
      else if (bot.state === 'IDLE') {
        decideNextMove(bot);
        updated = true;
      }
      if (updated) setRenderBot({...bot});
    }, speed);
    return () => clearInterval(interval);
  }, [isRunning, rows, cols, obstacles, speed, manualMode, shelves]);

  const decideNextMove = (bot) => {
    if (bot.x === chargePoint.x && bot.y === chargePoint.y && bot.battery < 90) {
      bot.state = 'CHARGING'; return;
    }
    if (bot.queue.length > 0) {
      const nextItem = bot.queue[0];
      const shelf = shelves.find(s => s.id === nextItem.shelfId);
      const dist = (Math.abs(bot.x - pickupPoint.x) + Math.abs(bot.y - pickupPoint.y)) + 
                   (Math.abs(pickupPoint.x - shelf.x) + Math.abs(pickupPoint.y - shelf.y)) +
                   (Math.abs(shelf.x - chargePoint.x) + Math.abs(shelf.y - chargePoint.y));
      
      if (bot.battery < dist * BATTERY_COST + 15) {
        addLog(`Need Charge for mission. Returning.`);
        goToCharge(bot);
      } else {
        addLog(`Starting Job: ${nextItem.name}`);
        const { path, visited } = findPath(bot, pickupPoint, rows, cols, obstacles);
        if (path.length) { bot.path = path; bot.visitedNodes = visited; bot.state = 'MOVING'; }
        else addLog("Cannot reach pickup!");
      }
    } else if (bot.x !== 0 || bot.y !== 0) {
      addLog("No Jobs. Returning Base.");
      goToCharge(bot);
    }
  };

  const goToCharge = (bot) => {
    const { path, visited } = findPath(bot, chargePoint, rows, cols, obstacles);
    if(path.length) { bot.path = path; bot.visitedNodes = visited; bot.state = 'MOVING'; }
  };

  const handleArrival = (bot) => {
    if (bot.x === pickupPoint.x && bot.y === pickupPoint.y && bot.queue.length > 0 && !bot.heldItem) {
      bot.state = 'PICKING'; bot.waitTicks = 3;
    } else if (bot.heldItem) {
      const shelf = shelves.find(s => s.id === bot.heldItem.shelfId);
      if (bot.x === shelf.x && bot.y === shelf.y) {
        bot.state = 'DROPPING'; bot.waitTicks = 3;
      }
    } else if (bot.x === 0 && bot.y === 0) {
      bot.state = bot.battery < 100 ? 'CHARGING' : 'IDLE';
    } else bot.state = 'IDLE';
  };

  const toggleObstacle = (x, y) => {
    if ((x===0&&y===0) || (x===pickupPoint.x&&y===pickupPoint.y)) return;
    if (shelves.some(s => s.x===x && s.y===y)) return;
    const key = `${x},${y}`;
    const newSet = new Set(obstacles);
    newSet.has(key) ? newSet.delete(key) : newSet.add(key);
    setObstacles(newSet);
  };

  const resetSystem = () => {
    setIsRunning(false);
    setManualMode(false);
    setObstacles(new Set()); // Clear Obstacles
    
    // Reset Robot & Queue
    robotRef.current = {
      x: 0, y: 0, battery: 100, state: 'IDLE', heldItem: null, path: [], visitedNodes: [], waitTicks: 0,
      queue: [...initialItems]
    };
    
    setRenderBot({...robotRef.current});
    setLogs(["System Reset."]);
    setStats({ distance: 0, jobs: 0, charges: 0 });
  };

  const addRandomJob = () => {
    const types = [
       { name: 'Alpha-Red', uid: 'A-1', shelfId: 'shelf-1', color: 'bg-red-500' },
       { name: 'Beta-Blue', uid: 'B-2', shelfId: 'shelf-2', color: 'bg-blue-500' },
       { name: 'Gamma-Grn', uid: 'C-3', shelfId: 'shelf-3', color: 'bg-green-500' },
    ];
    const last = robotRef.current.queue[robotRef.current.queue.length - 1];
    let avail = types;
    if (last) avail = types.filter(t => t.shelfId !== last.shelfId);
    if (!avail.length) avail = types;
    const item = { ...avail[Math.floor(Math.random()*avail.length)], id: `new-${Date.now()}` };
    robotRef.current.queue.push(item);
    setRenderBot({...robotRef.current});
    addLog(`User Added: ${item.name}`);
  };

  // Manual Control
  const handleManualMove = (dx, dy) => {
    const bot = robotRef.current;
    const nx = bot.x + dx, ny = bot.y + dy;
    if (nx>=0 && nx<cols && ny>=0 && ny<rows && !obstacles.has(`${nx},${ny}`)) {
      bot.x = nx; bot.y = ny; bot.battery -= BATTERY_COST;
      setRenderBot({...bot});
    }
  };

  return (
    <div className="h-screen w-full bg-gray-950 flex flex-col overflow-hidden text-gray-100 font-sans">
      
      {/* 3D CANVAS LAYER */}
      <div className="absolute inset-0 z-0">
        <Canvas camera={{ position: [5, 10, 10], fov: 50 }}>
          <ambientLight intensity={0.6} />
          <directionalLight position={[10, 20, 10]} intensity={1.5} />
          <OrbitControls target={[cols/2, 0, rows/2]} />
          
          <group position={[0.5, 0, 0.5]}>
             {Array.from({length: rows}).map((_, y) => (
                Array.from({length: cols}).map((_, x) => {
                   const isWall = obstacles.has(`${x},${y}`);
                   const isPath = renderBot.path.some(p => p.x === x && p.y === y);
                   const isVisited = showScan && renderBot.visitedNodes.some(v => v.x === x && v.y === y);
                   const isStart = x === 0 && y === 0;
                   const isPickup = x === pickupPoint.x && y === pickupPoint.y;
                   const shelf = shelves.find(s => s.x === x && s.y === y);

                   return (
                     <React.Fragment key={`${x}-${y}`}>
                       <FloorTile 
                         x={x} y={y} 
                         isWall={isWall} 
                         isPath={isPath} 
                         isVisited={isVisited}
                         isStart={isStart}
                         isPickup={isPickup}
                         onClick={toggleObstacle}
                         editMode={editMode}
                         showScan={showScan}
                       />
                       {shelf && <Shelf3D x={x} y={y} uid={shelf.uid} colorStr={shelf.color} />}
                     </React.Fragment>
                   )
                })
             ))}
             
             {/* Robot */}
             <Robot3D x={renderBot.x} y={renderBot.y} heldItem={renderBot.heldItem} />
          </group>

        </Canvas>
      </div>

      {/* UI OVERLAY LAYER */}
      <div className="absolute inset-0 z-10 pointer-events-none p-4 flex flex-col justify-between">
         
         {/* HEADER */}
         <div className="pointer-events-auto flex justify-between items-start">
            <div className="bg-gray-900/90 backdrop-blur border border-gray-700 p-4 rounded-xl shadow-2xl">
              <h1 className="text-xl font-bold flex items-center gap-2">
                 <Database className="text-blue-500"/> AWMS <span className="text-gray-500">3D COMMANDER</span>
              </h1>
            </div>

            <div className="flex flex-col items-end gap-2">
               <div className="bg-gray-900/90 backdrop-blur border border-gray-700 p-2 rounded-xl flex gap-4 shadow-xl">
                  <div className="flex items-center gap-2 px-2">
                     <span className="text-xs text-gray-400">ENERGY</span>
                     <div className={`font-mono font-bold ${renderBot.battery < 20 ? 'text-red-500' : 'text-green-500'}`}>{Math.round(renderBot.battery)}%</div>
                     {renderBot.state === 'CHARGING' ? <BatteryCharging size={16} className="text-green-400 animate-pulse"/> : <Battery size={16} className={renderBot.battery < 20 ? 'text-red-500' : 'text-green-500'}/>}
                  </div>
                  <button 
                     onClick={() => { setIsRunning(!isRunning); if(!isRunning) setManualMode(false); }}
                     className={`px-4 py-1 rounded-lg font-bold flex items-center gap-2 transition-all ${isRunning ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}
                  >
                     {isRunning ? <><Pause size={14}/> STOP</> : <><Play size={14}/> START</>}
                  </button>
               </div>
               
               {/* Analytics */}
               <div className="bg-gray-900/90 backdrop-blur border border-gray-700 p-3 rounded-xl shadow-xl w-48">
                 <h3 className="text-[10px] font-bold text-blue-400 uppercase mb-2 flex items-center gap-2"><Activity size={10}/> Telemetry</h3>
                 <div className="grid grid-cols-2 gap-2 text-xs">
                   <div><div className="text-gray-500 text-[9px]">Odometer</div><div className="font-mono">{stats.distance}m</div></div>
                   <div><div className="text-gray-500 text-[9px]">Jobs</div><div className="font-mono text-green-400">{stats.jobs}</div></div>
                 </div>
               </div>
            </div>
         </div>

         {/* BOTTOM CONTROLS */}
         <div className="pointer-events-auto flex gap-4 items-end">
            
            {/* Sidebar Controls */}
            <div className="bg-gray-900/90 backdrop-blur border border-gray-700 p-4 rounded-xl shadow-2xl w-72 space-y-4 max-h-[60vh] overflow-y-auto">
               
               {/* Grid Size */}
               <div className="flex gap-2">
                  <div className="flex-1 bg-gray-800 p-1.5 rounded flex flex-col items-center">
                      <span className="text-[9px] text-gray-500 uppercase">Cols</span>
                      <div className="flex items-center gap-2">
                          <button disabled={isRunning} onClick={()=>setCols(c=>Math.max(5,c-1))} className="hover:text-blue-400 disabled:opacity-30"><Minus size={10}/></button>
                          <span className="font-mono font-bold text-xs">{cols}</span>
                          <button disabled={isRunning} onClick={()=>setCols(c=>Math.min(25,c+1))} className="hover:text-blue-400 disabled:opacity-30"><Plus size={10}/></button>
                      </div>
                  </div>
                  <div className="flex-1 bg-gray-800 p-1.5 rounded flex flex-col items-center">
                      <span className="text-[9px] text-gray-500 uppercase">Rows</span>
                      <div className="flex items-center gap-2">
                          <button disabled={isRunning} onClick={()=>setRows(r=>Math.max(5,r-1))} className="hover:text-blue-400 disabled:opacity-30"><Minus size={10}/></button>
                          <span className="font-mono font-bold text-xs">{rows}</span>
                          <button disabled={isRunning} onClick={()=>setRows(r=>Math.min(20,r+1))} className="hover:text-blue-400 disabled:opacity-30"><Plus size={10}/></button>
                      </div>
                  </div>
               </div>

               {/* Speed */}
               <div className="space-y-1">
                 <div className="flex justify-between text-[10px] text-gray-400"><span>Sim Speed</span><span>{speed}ms</span></div>
                 <input type="range" min="50" max="800" step="50" value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="w-full h-1 bg-gray-700 rounded-lg cursor-pointer" />
               </div>

               {/* Buttons */}
               <div className="grid grid-cols-2 gap-2">
                 <button onClick={() => setShowScan(!showScan)} className={`py-2 text-[10px] font-bold rounded border ${showScan ? 'bg-purple-900/50 border-purple-500 text-purple-300' : 'bg-gray-800 border-gray-600 text-gray-400'}`}>
                    <MapIcon size={12} className="inline mr-1"/> {showScan ? 'HIDE A*' : 'SHOW A*'}
                 </button>
                 <button onClick={() => setEditMode(!editMode)} className={`py-2 text-[10px] font-bold rounded border ${editMode ? 'bg-yellow-900/50 border-yellow-500 text-yellow-300' : 'bg-gray-800 border-gray-600 text-gray-400'}`}>
                    {editMode ? 'DONE' : 'EDIT MAP'}
                 </button>
                 <button onClick={() => { setManualMode(!manualMode); setIsRunning(false); }} className={`col-span-2 py-2 text-[10px] font-bold rounded border ${manualMode ? 'bg-orange-900/50 border-orange-500 text-orange-300' : 'bg-gray-800 border-gray-600 text-gray-400'}`}>
                    <Gamepad2 size={12} className="inline mr-1"/> {manualMode ? 'MANUAL: ON' : 'MANUAL: OFF'}
                 </button>
                 {/* RESTART BUTTON */}
                 <button onClick={resetSystem} className={`col-span-2 py-2 text-[10px] font-bold rounded border bg-red-900/20 border-red-500/50 text-red-400 hover:bg-red-900/40`}>
                    <RotateCcw size={12} className="inline mr-1"/> FULL RESET
                 </button>
               </div>
               
               {/* Manual Keys */}
               {manualMode && (
                 <div className="flex justify-center gap-1">
                    <button onClick={() => handleManualMove(-1, 0)} className="p-2 bg-gray-800 rounded"><ArrowLeft size={14}/></button>
                    <div className="flex flex-col gap-1">
                      <button onClick={() => handleManualMove(0, -1)} className="p-2 bg-gray-800 rounded"><ArrowUp size={14}/></button>
                      <button onClick={() => handleManualMove(0, 1)} className="p-2 bg-gray-800 rounded"><ArrowDown size={14}/></button>
                    </div>
                    <button onClick={() => handleManualMove(1, 0)} className="p-2 bg-gray-800 rounded"><ArrowRight size={14}/></button>
                 </div>
               )}

            </div>

            {/* Queue & Logs */}
            <div className="flex-1 bg-gray-900/90 backdrop-blur border border-gray-700 p-4 rounded-xl shadow-2xl h-48 flex gap-4">
               {/* Queue List */}
               <div className="w-48 flex flex-col gap-2 border-r border-gray-700 pr-4">
                  <div className="flex justify-between items-center"><span className="text-xs font-bold text-gray-500 uppercase">Queue</span><span className="text-[10px] bg-gray-800 px-1 rounded">{robotRef.current.queue.length}</span></div>
                  <div className="flex-1 overflow-y-auto space-y-1">
                     {renderBot.heldItem && <div className="text-[10px] bg-blue-900/30 text-blue-300 p-1 rounded border border-blue-500/30 animate-pulse">Running: {renderBot.heldItem.name}</div>}
                     {robotRef.current.queue.map(i => <div key={i.id} className="text-[10px] bg-gray-800 text-gray-400 p-1 rounded flex justify-between"><span>{i.name}</span><span>{i.uid}</span></div>)}
                  </div>
                  <button onClick={addRandomJob} className="py-1 text-[10px] font-bold bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded hover:bg-blue-600/30">+ JOB</button>
               </div>
               {/* Logs */}
               <div className="flex-1 overflow-y-auto font-mono text-[10px] text-green-400 space-y-0.5">
                  {logs.map((l, i) => <div key={i} className="border-l border-green-900 pl-2">{l}</div>)}
                  <div ref={logsEndRef}/>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}
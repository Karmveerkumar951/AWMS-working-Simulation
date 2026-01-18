import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Canvas, useFrame, extend } from '@react-three/fiber';
import { OrbitControls, Text, Html, useCursor, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { 
  Play, Pause, Battery, BatteryCharging, Box, 
  Plus, Minus, Database, Activity, Zap,
  Map as MapIcon, Gamepad2, ArrowUp, ArrowDown, ArrowLeft, ArrowRight,
  RotateCcw, Package, Target, History,
  Settings, Layers, BarChart3, Clock, Thermometer, Wifi, Cpu,
  BrickWall, MapPin, Library, Maximize, Move
} from 'lucide-react';

// Extend with performance optimizations
extend({ THREE });

// --- CONSTANTS & CONFIG ---
const CONFIG = {
  BATTERY_COST: 0.15,
  CHARGE_RATE: 6,
  LOW_BATTERY_THRESHOLD: 15,
  BATTERY_CRITICAL: 5,
  MAX_GRID_SIZE: 30,
  MIN_GRID_SIZE: 6,
  PATH_COLORS: {
    visited: '#dc2626',
    path: '#22c55e',
    alternative: '#3b82f6',
    charging: '#f59e0b'
  },
  SHELF_HEIGHTS: [0.3, 0.9, 1.5],
  TILE_SIZE: 1
};

// --- ALGORITHMS ---

class BinaryHeap {
  constructor(scoreFn = node => node.f) {
    this.content = [];
    this.scoreFn = scoreFn;
  }

  push(node) {
    this.content.push(node);
    this.sinkDown(this.content.length - 1);
  }

  pop() {
    const result = this.content[0];
    const end = this.content.pop();
    if (this.content.length > 0) {
      this.content[0] = end;
      this.bubbleUp(0);
    }
    return result;
  }

  sinkDown(n) {
    const element = this.content[n];
    while (n > 0) {
      const parentN = ((n + 1) >> 1) - 1;
      const parent = this.content[parentN];
      if (this.scoreFn(element) >= this.scoreFn(parent)) break;
      this.content[parentN] = element;
      this.content[n] = parent;
      n = parentN;
    }
  }

  bubbleUp(n) {
    const length = this.content.length;
    const element = this.content[n];
    const elemScore = this.scoreFn(element);

    while (true) {
      const child2N = (n + 1) << 1;
      const child1N = child2N - 1;
      let swap = null;
      let child1Score;

      if (child1N < length) {
        const child1 = this.content[child1N];
        child1Score = this.scoreFn(child1);
        if (child1Score < elemScore) swap = child1N;
      }

      if (child2N < length) {
        const child2 = this.content[child2N];
        const child2Score = this.scoreFn(child2);
        if (child2Score < (swap === null ? elemScore : child1Score)) swap = child2N;
      }

      if (swap === null) break;
      this.content[n] = this.content[swap];
      this.content[swap] = element;
      n = swap;
    }
  }

  size() { return this.content.length; }
  isEmpty() { return this.content.length === 0; }
}

class PathNode {
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
  if (!start || !end) return { path: [], visited: [], cost: 0 };
  
  const openSet = new BinaryHeap(node => node.f);
  const closedSet = new Map();
  const visitedForViz = [];
  
  const startNode = new PathNode(start.x, start.y);
  const endNode = new PathNode(end.x, end.y);
  
  openSet.push(startNode);
  
  while (!openSet.isEmpty()) {
    const currentNode = openSet.pop();
    visitedForViz.push({ x: currentNode.x, y: currentNode.y });

    if (currentNode.x === endNode.x && currentNode.y === endNode.y) {
      let path = [];
      let current = currentNode;
      let totalCost = 0;
      while (current.parent) {
        path.push({ x: current.x, y: current.y });
        totalCost += 1;
        current = current.parent;
      }
      return { 
        path: path.reverse(), 
        visited: visitedForViz,
        cost: totalCost
      };
    }

    const key = `${currentNode.x},${currentNode.y}`;
    closedSet.set(key, currentNode);

    const neighbors = [
      { dx: 0, dy: -1 },
      { dx: 0, dy: 1 },
      { dx: -1, dy: 0 },
      { dx: 1, dy: 0 }
    ];

    for (const neighbor of neighbors) {
      const nx = currentNode.x + neighbor.dx;
      const ny = currentNode.y + neighbor.dy;
      const nKey = `${nx},${ny}`;

      if (nx < 0 || nx >= gridCols || ny < 0 || ny >= gridRows) continue;
      if (obstacles.has(nKey)) continue;
      if (closedSet.has(nKey)) continue;

      const tentativeG = currentNode.g + 1;
      let neighborNode = Array.from(openSet.content).find(n => n.x === nx && n.y === ny);

      if (!neighborNode) {
        neighborNode = new PathNode(nx, ny, currentNode);
        neighborNode.g = tentativeG;
        neighborNode.h = Math.abs(nx - endNode.x) + Math.abs(ny - endNode.y);
        neighborNode.f = neighborNode.g + neighborNode.h;
        openSet.push(neighborNode);
      } else if (tentativeG < neighborNode.g) {
        neighborNode.parent = currentNode;
        neighborNode.g = tentativeG;
        neighborNode.f = neighborNode.g + neighborNode.h;
      }
    }
  }
  return { path: [], visited: visitedForViz, cost: 0 };
};

// --- ENHANCED 3D COMPONENTS ---
const FloorTile = React.memo(({ 
  x, y, isWall, isPath, isVisited, isStart, isPickup, 
  isCharging, onClick, editMode, showScan, tileSize = 1 
}) => {
  const [hovered, setHover] = useState(false);
  useCursor(hovered && editMode);
  const meshRef = useRef();

  // Advanced color logic with gradients
  let color = "#111827"; // Dark slate
  let emissive = "#000000";
  let emissiveIntensity = 0;

  if (isWall) {
    color = "#4b5563";
  } else if (isPath && showScan) {
    color = CONFIG.PATH_COLORS.path;
    emissive = CONFIG.PATH_COLORS.path;
    emissiveIntensity = 0.3;
  } else if (isPath) {
    color = "#1e40af";
  } else if (isVisited && showScan) {
    color = CONFIG.PATH_COLORS.visited;
  } else if (isCharging) {
    color = CONFIG.PATH_COLORS.charging;
    emissive = CONFIG.PATH_COLORS.charging;
    emissiveIntensity = 0.2;
  } else if (hovered && editMode) {
    color = "#374151";
    emissive = "#60a5fa";
    emissiveIntensity = 0.1;
  }

  const height = isWall ? 0.8 : 0.05;
  const yPos = isWall ? height / 2 : 0;

  // Animate path tiles
  useFrame((state) => {
    if (meshRef.current && (isPath || isVisited) && showScan) {
      meshRef.current.position.y = yPos + Math.sin(state.clock.elapsedTime * 3 + x + y) * 0.02;
    }
  });

  return (
    <mesh 
      ref={meshRef}
      position={[x * tileSize, yPos, y * tileSize]} 
      onClick={(e) => { e.stopPropagation(); onClick(x, y); }}
      onPointerOver={() => setHover(true)}
      onPointerOut={() => setHover(false)}
      castShadow
      receiveShadow
    >
      <boxGeometry args={[tileSize * 0.95, height, tileSize * 0.95]} />
      <meshStandardMaterial 
        color={color}
        emissive={emissive}
        emissiveIntensity={emissiveIntensity}
        roughness={0.7}
        metalness={0.1}
      />
      
      {isStart && !isWall && (
        <Html position={[0, height + 0.2, 0]} center transform sprite>
          <div className="text-green-400 font-bold text-xs bg-black/70 px-2 py-1 rounded-lg border border-green-500 shadow-lg flex items-center gap-1">
            <Zap size={10} /> BASE
          </div>
        </Html>
      )}
      {isPickup && !isWall && (
        <Html position={[0, height + 0.2, 0]} center transform sprite>
          <div className="text-yellow-400 font-bold text-xs bg-black/70 px-2 py-1 rounded-lg border border-yellow-500 shadow-lg flex items-center gap-1">
            <Package size={10} /> PICKUP
          </div>
        </Html>
      )}
      {isCharging && !isWall && (
        <Html position={[0, height + 0.1, 0]} center transform sprite>
          <div className="text-orange-400 font-bold text-[10px] bg-black/70 px-1 py-0.5 rounded border border-orange-500">
            ⚡
          </div>
        </Html>
      )}
    </mesh>
  );
});

// Enhanced Robot with animations
const Robot3D = React.memo(({ x, y, heldItem, battery, isMoving }) => {
  const groupRef = useRef();
  const wheelRefs = useMemo(() => [React.createRef(), React.createRef(), React.createRef(), React.createRef()], []);
  const antennaRef = useRef();

  useFrame((state, delta) => {
    if (groupRef.current) {
      // Smooth movement
      groupRef.current.position.x = THREE.MathUtils.lerp(
        groupRef.current.position.x, 
        x * CONFIG.TILE_SIZE, 
        delta * 8
      );
      groupRef.current.position.z = THREE.MathUtils.lerp(
        groupRef.current.position.z, 
        y * CONFIG.TILE_SIZE, 
        delta * 8
      );
      
      // Rotate wheels when moving
      if (isMoving) {
        wheelRefs.forEach(wheel => {
          if (wheel.current) {
            wheel.current.rotation.x += delta * 10;
          }
        });
      }
      
      // Bounce antenna
      if (antennaRef.current) {
        antennaRef.current.position.y = 0.8 + Math.sin(state.clock.elapsedTime * 5) * 0.05;
      }
    }
  });

  return (
    <group ref={groupRef} position={[x * CONFIG.TILE_SIZE, 0.4, y * CONFIG.TILE_SIZE]}>
      {/* Robot Body */}
      <mesh castShadow>
        <boxGeometry args={[0.7, 0.35, 0.9]} />
        <meshStandardMaterial 
          color={battery < CONFIG.BATTERY_CRITICAL ? "#ef4444" : "#3b82f6"} 
          metalness={0.3}
          roughness={0.4}
        />
      </mesh>
      
      {/* Wheels */}
      {[[0.4, -0.3], [-0.4, -0.3], [0.4, 0.3], [-0.4, 0.3]].map((pos, i) => (
        <mesh 
          key={i} 
          ref={wheelRefs[i]}
          position={[pos[0], -0.05, pos[1]]} 
          rotation={[0, 0, Math.PI / 2]}
          castShadow
        >
          <cylinderGeometry args={[0.12, 0.12, 0.15, 16]} />
          <meshStandardMaterial color="#111" roughness={0.9} />
        </mesh>
      ))}
      
      {/* Sensor Array */}
      <mesh position={[0, 0.4, -0.35]}>
        <boxGeometry args={[0.25, 0.15, 0.2]} />
        <meshStandardMaterial color="#60a5fa" emissive="#60a5fa" emissiveIntensity={0.3} />
      </mesh>
      
      {/* Antenna */}
      <mesh ref={antennaRef} position={[0, 0.8, 0.1]}>
        <cylinderGeometry args={[0.02, 0.02, 0.3, 8]} />
        <meshStandardMaterial color="#93c5fd" />
      </mesh>
      
      {/* Status LED */}
      <pointLight 
        position={[0.3, 0.4, -0.4]} 
        color={battery < CONFIG.LOW_BATTERY_THRESHOLD ? "#ef4444" : "#22c55e"} 
        intensity={0.5}
        distance={0.5}
      />
      
      {/* Cargo */}
      {heldItem && (
        <group position={[0, 0.7, 0.2]}>
          <mesh castShadow>
            <boxGeometry args={[0.45, 0.45, 0.45]} />
            <meshStandardMaterial 
              color={
                heldItem.color === 'bg-red-500' ? '#ef4444' : 
                heldItem.color === 'bg-blue-500' ? '#3b82f6' : 
                '#22c55e'
              }
              metalness={0.2}
              roughness={0.5}
            />
          </mesh>
          <Text 
            position={[0, 0.3, 0.25]} 
            fontSize={0.2} 
            color="white" 
            anchorX="center" 
            anchorY="middle"
          >
            {heldItem.uid}
          </Text>
        </group>
      )}
      
      {/* Battery indicator on robot */}
      <Html position={[0, 1.2, 0]} center>
        <div className={`text-xs font-bold px-2 py-0.5 rounded-full ${battery < 20 ? 'bg-red-900/80 text-red-300' : 'bg-green-900/80 text-green-300'}`}>
          {Math.round(battery)}%
        </div>
      </Html>
    </group>
  );
});

// Enhanced Shelf with interactive elements
const Shelf3D = React.memo(({ x, y, uid, colorStr, items = [], isSelected = false }) => {
  const color = colorStr.includes('red') ? '#ef4444' : 
                colorStr.includes('blue') ? '#3b82f6' : 
                '#22c55e';
  
  const [hovered, setHover] = useState(false);
  useCursor(hovered);

  return (
    <group 
      position={[x * CONFIG.TILE_SIZE, 0, y * CONFIG.TILE_SIZE]}
      onPointerOver={() => setHover(true)}
      onPointerOut={() => setHover(false)}
    >
      {/* Shelf Structure */}
      {CONFIG.SHELF_HEIGHTS.map((height, i) => (
        <mesh key={`shelf-${i}`} position={[0, height, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.85, 0.05, 0.85]} />
          <meshStandardMaterial 
            color={color} 
            emissive={isSelected || hovered ? color : '#000'}
            emissiveIntensity={isSelected ? 0.5 : hovered ? 0.2 : 0}
          />
        </mesh>
      ))}
      
      {/* Vertical Supports */}
      {[[0.4, 0.4], [-0.4, 0.4], [0.4, -0.4], [-0.4, -0.4]].map((pos, i) => (
        <mesh key={`support-${i}`} position={[pos[0], 0.75, pos[1]]} castShadow>
          <boxGeometry args={[0.05, 1.5, 0.05]} />
          <meshStandardMaterial color="#333" />
        </mesh>
      ))}
      
      {/* Items on shelves */}
      {items.map((item, idx) => (
        <mesh 
          key={`item-${idx}`} 
          position={[(idx % 2 - 0.5) * 0.3, CONFIG.SHELF_HEIGHTS[Math.floor(idx / 2)] + 0.1, 0]}
          castShadow
        >
          <boxGeometry args={[0.25, 0.25, 0.25]} />
          <meshStandardMaterial 
            color={item.color === 'bg-red-500' ? '#ef4444' : 
                   item.color === 'bg-blue-500' ? '#3b82f6' : 
                   '#22c55e'}
          />
        </mesh>
      ))}
      
      {/* Shelf Label */}
      <Text 
        position={[0, 1.8, 0]} 
        fontSize={0.35} 
        color="white" 
        anchorX="center" 
        anchorY="middle"
        outlineWidth={0.02}
        outlineColor="#000"
      >
        {uid}
      </Text>
      
      {/* Stock indicator */}
      <Html position={[0, 0.3, 0.5]} center>
        <div className="text-[10px] bg-black/70 text-white px-1.5 py-0.5 rounded">
          Stock: {items.length}
        </div>
      </Html>
    </group>
  );
});

// Particle System for effects
const ParticleSystem = ({ position, color = '#3b82f6', count = 20 }) => {
  const particlesRef = useRef();
  const particles = useMemo(() => {
    const temp = [];
    for (let i = 0; i < count; i++) {
      temp.push({
        position: new THREE.Vector3(
          (Math.random() - 0.5) * 2,
          Math.random() * 2,
          (Math.random() - 0.5) * 2
        ),
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 0.02,
          Math.random() * 0.03,
          (Math.random() - 0.5) * 0.02
        ),
        life: 1
      });
    }
    return temp;
  }, [count]);

  useFrame(() => {
    if (particlesRef.current) {
      particles.forEach((p, i) => {
        p.position.add(p.velocity);
        p.life -= 0.01;
        if (p.life <= 0) {
          p.position.set(
            (Math.random() - 0.5) * 2,
            Math.random() * 2,
            (Math.random() - 0.5) * 2
          );
          p.life = 1;
        }
        if (particlesRef.current.children[i]) {
            particlesRef.current.children[i].position.copy(p.position);
            particlesRef.current.children[i].scale.setScalar(p.life);
        }
      });
    }
  });

  return (
    <group ref={particlesRef} position={position}>
      {particles.map((_, i) => (
        <mesh key={i}>
          <sphereGeometry args={[0.05, 8, 8]} />
          <meshBasicMaterial color={color} transparent opacity={0.6} />
        </mesh>
      ))}
    </group>
  );
};

// --- MAIN APP COMPONENT ---
export default function EnhancedAWMS3D() {
  // Enhanced state management
  const [gridConfig, setGridConfig] = useState({ rows: 12, cols: 18 });
  const [obstacles, setObstacles] = useState(new Set());
  const [editMode, setEditMode] = useState(false);
  const [placementMode, setPlacementMode] = useState('WALL'); // 'WALL' | 'PICKUP' | 'SHELF'
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState(["🚀 AWMS 3D Commander Initialized", "✅ Systems Online", "🤖 Robot Ready"]);
  const [showScan, setShowScan] = useState(true);
  const [speed, setSpeed] = useState(150);
  const [manualMode, setManualMode] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(true);
  const [theme, setTheme] = useState('dark');

  // Dynamic Pickup Point
  const [pickupPoint, setPickupPoint] = useState({ x: Math.floor(18/3), y: Math.floor(12/2) });
  const chargePoint = { x: 0, y: 0 }; // Keep base at 0,0 for now

  const [stats, setStats] = useState({ 
    distance: 0, 
    jobs: 0, 
    charges: 0, 
    efficiency: 100,
    avgTimePerJob: 0,
    batteryConsumed: 0
  });

  const [performanceState, setPerformanceState] = useState({
    fps: 60,
    memory: 'Normal',
    lastUpdate: Date.now()
  });

  // Enhanced robot state with more properties
  const robotRef = useRef({
    x: 0, 
    y: 0, 
    battery: 100, 
    state: 'IDLE', 
    heldItem: null, 
    path: [], 
    visitedNodes: [], 
    waitTicks: 0,
    queue: [],
    history: [],
    temperature: 32,
    signalStrength: 100,
    currentTask: null,
    lastChargeTime: Date.now(),
    totalDistance: 0
  });

  const [renderBot, setRenderBot] = useState({...robotRef.current});
  const logsEndRef = useRef(null);
  const canvasRef = useRef();
  
  // Enhanced shelves with stock management
  const [shelves, setShelves] = useState(() => [
    { 
      id: 'shelf-1', 
      uid: 'A-1', 
      x: 15, 
      y: 2, 
      color: 'bg-red-500',
      items: [
        { id: 'i1', name: 'Alpha-Red', uid: 'A-1', color: 'bg-red-500' },
        { id: 'i4', name: 'Delta-Red', uid: 'D-4', color: 'bg-red-500' }
      ]
    },
    { 
      id: 'shelf-2', 
      uid: 'B-2', 
      x: 15, 
      y: 6, 
      color: 'bg-blue-500',
      items: [
        { id: 'i2', name: 'Beta-Blue', uid: 'B-2', color: 'bg-blue-500' },
        { id: 'i5', name: 'Epsilon-Blue', uid: 'E-5', color: 'bg-blue-500' }
      ]
    },
    { 
      id: 'shelf-3', 
      uid: 'C-3', 
      x: 15, 
      y: 9, 
      color: 'bg-green-500',
      items: [
        { id: 'i3', name: 'Gamma-Grn', uid: 'C-3', color: 'bg-green-500' },
        { id: 'i6', name: 'Zeta-Grn', uid: 'Z-6', color: 'bg-green-500' }
      ]
    }
  ]);

  // Initialize robot queue
  useEffect(() => {
    robotRef.current.queue = [
      { id: 'i1', name: 'Alpha-Red', uid: 'A-1', shelfId: 'shelf-1', color: 'bg-red-500' },
      { id: 'i2', name: 'Beta-Blue', uid: 'B-2', shelfId: 'shelf-2', color: 'bg-blue-500' },
      { id: 'i3', name: 'Gamma-Grn', uid: 'C-3', shelfId: 'shelf-3', color: 'bg-green-500' },
    ];
    setRenderBot({...robotRef.current});
  }, []);

  // Performance monitoring
  useEffect(() => {
    let frameCount = 0;
    let lastTime = performance.now();
    
    const monitor = () => {
      frameCount++;
      const currentTime = performance.now();
      if (currentTime - lastTime >= 1000) {
        setPerformanceState(prev => ({
          ...prev,
          fps: Math.round((frameCount * 1000) / (currentTime - lastTime)),
          lastUpdate: Date.now()
        }));
        frameCount = 0;
        lastTime = currentTime;
      }
      requestAnimationFrame(monitor);
    };
    
    const id = requestAnimationFrame(monitor);
    return () => cancelAnimationFrame(id);
  }, []);

  // Enhanced logging with types
  const addLog = useCallback((msg, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const icons = {
      info: 'ℹ️',
      success: '✅',
      warning: '⚠️',
      error: '❌',
      robot: '🤖',
      battery: '🔋'
    };
    
    setLogs(prev => [...prev.slice(-24), `${icons[type] || '📝'} [${timestamp}] ${msg}`]);
  }, []);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Main simulation loop
  useEffect(() => {
    if (!isRunning || manualMode) return;

    const interval = setInterval(() => {
      const bot = robotRef.current;
      let updated = false;

      // Update robot metrics
      if (bot.state !== 'CHARGING') {
        bot.temperature = Math.min(80, 30 + (bot.totalDistance / 10));
        bot.signalStrength = Math.max(50, 100 - (bot.totalDistance / 20));
      }

      // Waiting logic
      if (bot.waitTicks > 0) {
        bot.waitTicks--;
        if (bot.waitTicks === 0) {
          if (bot.state === 'PICKING') {
            const item = bot.queue.shift();
            bot.heldItem = item;
            bot.currentTask = `Delivering ${item.name} to ${item.uid}`;
            addLog(`Picked up ${item.name}`, 'success');
            
            const shelf = shelves.find(s => s.id === item.shelfId);
            const { path, visited, cost } = findPath(bot, shelf, gridConfig.rows, gridConfig.cols, obstacles);
            
            if (path.length) { 
              bot.path = path; 
              bot.visitedNodes = visited;
              bot.state = 'MOVING';
              addLog(`Route calculated (${cost} tiles)`, 'info');
            } else { 
              addLog("Path blocked! Task queued.", 'error');
              bot.queue.unshift(item);
              bot.state = 'IDLE';
            }
          } else if (bot.state === 'DROPPING') {
            const shelfIndex = shelves.findIndex(s => s.id === bot.heldItem.shelfId);
            if (shelfIndex !== -1) {
              const newShelves = [...shelves];
              newShelves[shelfIndex].items.push(bot.heldItem);
              setShelves(newShelves);
            }
            
            addLog(`Delivered ${bot.heldItem.name} to ${bot.heldItem.uid}`, 'success');
            setStats(s => ({
              ...s, 
              jobs: s.jobs + 1,
              avgTimePerJob: Math.round(((s.avgTimePerJob * s.jobs) + (Date.now() - bot.lastChargeTime)) / (s.jobs + 1))
            }));
            
            bot.history.push({
              item: bot.heldItem,
              time: Date.now(),
              energyUsed: 100 - bot.battery
            });
            
            bot.heldItem = null;
            bot.visitedNodes = [];
            bot.state = 'IDLE';
            bot.currentTask = null;
          }
        }
        setRenderBot({...bot});
        return;
      }

      // Charging logic with animation
      if (bot.state === 'CHARGING') {
        if (bot.battery >= 100) {
          bot.battery = 100;
          bot.state = 'IDLE';
          setStats(s => ({...s, charges: s.charges + 1}));
          addLog("Battery fully charged", 'battery');
        } else {
          bot.battery = Math.min(100, bot.battery + CONFIG.CHARGE_RATE);
          updated = true;
        }
      } 
      // Movement logic
      else if (bot.state === 'MOVING' && bot.path.length > 0) {
        const energyCost = CONFIG.BATTERY_COST * (1 + bot.temperature / 100);
        bot.battery -= energyCost;
        setStats(s => ({...s, batteryConsumed: s.batteryConsumed + energyCost}));
        
        const next = bot.path.shift();
        bot.x = next.x;
        bot.y = next.y;
        bot.totalDistance += 1;
        
        setStats(s => ({...s, distance: s.distance + 1}));

        // Dynamic rerouting based on battery
        if (bot.battery < CONFIG.LOW_BATTERY_THRESHOLD && !bot.heldItem) {
          addLog("Low battery! Rerouting to charge station", 'warning');
          const { path, visited } = findPath(bot, chargePoint, gridConfig.rows, gridConfig.cols, obstacles);
          bot.path = path;
          bot.visitedNodes = visited;
        }

        if (bot.path.length === 0) {
          handleArrival(bot);
        }
        updated = true;
      } 
      // Decision logic
      else if (bot.state === 'IDLE') {
        decideNextMove(bot);
        updated = true;
      }

      // Update efficiency
      if (updated) {
        const efficiency = Math.round((bot.totalDistance / Math.max(1, stats.batteryConsumed)) * 100);
        setStats(s => ({...s, efficiency: Math.min(100, efficiency)}));
        setRenderBot({...bot});
      }
    }, speed);

    return () => clearInterval(interval);
  }, [isRunning, gridConfig, obstacles, speed, manualMode, shelves, stats.batteryConsumed, pickupPoint]);

  const decideNextMove = (bot) => {
    // Check if at base and needs charge
    if (bot.x === chargePoint.x && bot.y === chargePoint.y && bot.battery < 90) {
      bot.state = 'CHARGING';
      bot.lastChargeTime = Date.now();
      addLog("Starting charge cycle", 'battery');
      return;
    }

    // Process next job if available
    if (bot.queue.length > 0) {
      const nextItem = bot.queue[0];
      const shelf = shelves.find(s => s.id === nextItem.shelfId);
      
      if (!shelf) {
        addLog(`Shelf for ${nextItem.name} not found!`, 'error');
        bot.queue.shift();
        return;
      }

      // Calculate required energy with safety margin
      const estimatedEnergy = (
        Math.abs(bot.x - pickupPoint.x) + Math.abs(bot.y - pickupPoint.y) +
        Math.abs(pickupPoint.x - shelf.x) + Math.abs(pickupPoint.y - shelf.y) +
        Math.abs(shelf.x - chargePoint.x) + Math.abs(shelf.y - chargePoint.y)
      ) * CONFIG.BATTERY_COST * 1.2;

      if (bot.battery < estimatedEnergy + 15) {
        addLog(`Insufficient battery (${Math.round(bot.battery)}%) for mission. Returning to base.`, 'warning');
        goToCharge(bot);
      } else {
        addLog(`Starting job: ${nextItem.name}`, 'robot');
        bot.currentTask = `Fetching ${nextItem.name}`;
        const { path, visited, cost } = findPath(bot, pickupPoint, gridConfig.rows, gridConfig.cols, obstacles);
        if (path.length) { 
          bot.path = path; 
          bot.visitedNodes = visited;
          bot.state = 'MOVING';
        } else {
          addLog("Cannot reach pickup point!", 'error');
        }
      }
    } else if (bot.x !== chargePoint.x || bot.y !== chargePoint.y) {
      addLog("No jobs in queue. Returning to base", 'info');
      goToCharge(bot);
    }
  };

  const goToCharge = (bot) => {
    const { path, visited } = findPath(bot, chargePoint, gridConfig.rows, gridConfig.cols, obstacles);
    if (path.length) { 
      bot.path = path; 
      bot.visitedNodes = visited;
      bot.state = 'MOVING';
    }
  };

  const handleArrival = (bot) => {
    if (bot.x === pickupPoint.x && bot.y === pickupPoint.y && bot.queue.length > 0 && !bot.heldItem) {
      bot.state = 'PICKING';
      bot.waitTicks = 2;
    } else if (bot.heldItem) {
      const shelf = shelves.find(s => s.id === bot.heldItem.shelfId);
      if (shelf && bot.x === shelf.x && bot.y === shelf.y) {
        bot.state = 'DROPPING';
        bot.waitTicks = 2;
      }
    } else if (bot.x === chargePoint.x && bot.y === chargePoint.y) {
      bot.state = bot.battery < 100 ? 'CHARGING' : 'IDLE';
    } else {
      bot.state = 'IDLE';
    }
  };

  // --- NEW INTERACTION LOGIC ---
  const handleTileClick = (x, y) => {
    if (!editMode) return;
    
    // Prevent modifying base station
    if (x === 0 && y === 0) {
      addLog("Cannot modify Base Station", 'error');
      return;
    }

    if (placementMode === 'WALL') {
      // Logic for Walls
      if (x === pickupPoint.x && y === pickupPoint.y) return;
      if (shelves.some(s => s.x === x && s.y === y)) return;
      
      const key = `${x},${y}`;
      const newSet = new Set(obstacles);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      setObstacles(newSet);
    } 
    else if (placementMode === 'PICKUP') {
      // Logic for Pickup Point
      const key = `${x},${y}`;
      if (obstacles.has(key)) {
        addLog("Cannot place Pickup on Wall", 'warning');
        return;
      }
      if (shelves.some(s => s.x === x && s.y === y)) {
        addLog("Cannot place Pickup on Shelf", 'warning');
        return;
      }
      setPickupPoint({x, y});
      addLog(`Pickup Point moved to (${x}, ${y})`, 'success');
    }
    else if (placementMode === 'SHELF') {
      // Logic for Shelves
      const key = `${x},${y}`;
      if (obstacles.has(key)) {
        addLog("Cannot place Shelf on Wall", 'warning');
        return;
      }
      if (x === pickupPoint.x && y === pickupPoint.y) {
        addLog("Cannot place Shelf on Pickup Point", 'warning');
        return;
      }

      // Check if shelf exists here
      const existingShelfIndex = shelves.findIndex(s => s.x === x && s.y === y);
      
      if (existingShelfIndex >= 0) {
        // Remove shelf
        const newShelves = [...shelves];
        const removed = newShelves.splice(existingShelfIndex, 1)[0];
        setShelves(newShelves);
        addLog(`Removed Shelf ${removed.uid}`, 'info');
      } else {
        // --- SHELF LIMIT & DUPLICATE PREVENTION LOGIC ---
        if (shelves.length >= 3) {
            addLog("Max 3 shelves reached! Remove one to relocate.", 'error');
            return;
        }

        // Define specific distinct types
        const SHELF_TYPES = [
          { color: 'bg-red-500', letter: 'A' },
          { color: 'bg-blue-500', letter: 'B' },
          { color: 'bg-green-500', letter: 'C' }
        ];

        // Determine which colors are currently on the map
        const existingColors = new Set(shelves.map(s => s.color));
        
        // Find the first color from our list that isn't on the map
        const nextType = SHELF_TYPES.find(t => !existingColors.has(t.color));

        if (nextType) {
            const idNum = Math.floor(Math.random() * 1000);
            const newShelf = {
              id: `shelf-${idNum}`,
              uid: `${nextType.letter}-${idNum}`,
              x, y,
              color: nextType.color,
              items: [] // Empty shelf initially
            };
            setShelves([...shelves, newShelf]);
            addLog(`Added ${nextType.letter} Shelf at (${x}, ${y})`, 'success');
        } else {
            // Should theoretically not happen if limit is 3 and types are 3
            addLog("No more unique shelf types available.", 'error');
        }
      }
    }
  };

  const resetSystem = () => {
    setIsRunning(false);
    setManualMode(false);
    setObstacles(new Set());
    
    robotRef.current = {
      x: 0, y: 0, battery: 100, state: 'IDLE', heldItem: null, 
      path: [], visitedNodes: [], waitTicks: 0, queue: [],
      history: [], temperature: 32, signalStrength: 100,
      currentTask: null, lastChargeTime: Date.now(), totalDistance: 0
    };
    
    // Reset Pickup
    setPickupPoint({ x: Math.floor(gridConfig.cols/3), y: Math.floor(gridConfig.rows/2) });

    // Reinitialize queue and shelves
    setShelves([
      { id: 's1', uid: 'A-1', x: gridConfig.cols-3, y: 2, color: 'bg-red-500', items: [] },
      { id: 's2', uid: 'B-2', x: gridConfig.cols-3, y: 6, color: 'bg-blue-500', items: [] },
      { id: 's3', uid: 'C-3', x: gridConfig.cols-3, y: 9, color: 'bg-green-500', items: [] }
    ]);

    robotRef.current.queue = [];
    
    setRenderBot({...robotRef.current});
    setLogs(["🔄 System Reset", "🤖 Robot Ready", "✅ All Systems Online"]);
    setStats({ 
      distance: 0, 
      jobs: 0, 
      charges: 0, 
      efficiency: 100,
      avgTimePerJob: 0,
      batteryConsumed: 0
    });
  };

  const addRandomJob = () => {
    if (shelves.length === 0) {
      addLog("No shelves available!", 'error');
      return;
    }
    const randomShelf = shelves[Math.floor(Math.random() * shelves.length)];
    
    const item = { 
      id: `job-${Date.now()}`,
      name: `Package-${Math.floor(Math.random()*100)}`,
      uid: randomShelf.uid,
      shelfId: randomShelf.id,
      color: randomShelf.color
    };
    
    robotRef.current.queue.push(item);
    setRenderBot({...robotRef.current});
    addLog(`Added job: ${item.name}`, 'success');
  };

  const removeJob = (jobId) => {
    const index = robotRef.current.queue.findIndex(j => j.id === jobId);
    if (index > -1) {
      const removed = robotRef.current.queue.splice(index, 1)[0];
      setRenderBot({...robotRef.current});
      addLog(`Removed job: ${removed.name}`, 'info');
    }
  };

  const handleManualMove = (dx, dy) => {
    const bot = robotRef.current;
    const nx = bot.x + dx, ny = bot.y + dy;
    const key = `${nx},${ny}`;
    
    if (nx >= 0 && nx < gridConfig.cols && ny >= 0 && ny < gridConfig.rows && !obstacles.has(key)) {
      bot.x = nx;
      bot.y = ny;
      bot.battery -= CONFIG.BATTERY_COST;
      bot.totalDistance += 1;
      setStats(s => ({...s, distance: s.distance + 1}));
      setRenderBot({...bot});
      addLog(`Manual move to (${nx}, ${ny})`, 'info');
    } else {
      addLog(`Cannot move to (${nx}, ${ny})`, 'warning');
    }
  };

  const handleGridResize = (newRows, newCols) => {
    if (isRunning) {
      addLog("Stop simulation before resizing grid", 'warning');
      return;
    }
    
    // Adjust obstacles
    const newObstacles = new Set();
    obstacles.forEach(key => {
      const [x, y] = key.split(',').map(Number);
      if (x < newCols && y < newRows) {
        newObstacles.add(key);
      }
    });
    setObstacles(newObstacles);
    
    // Adjust Shelves
    const newShelves = shelves.filter(s => s.x < newCols && s.y < newRows);
    if (newShelves.length !== shelves.length) {
      addLog("Some shelves removed due to resize", 'warning');
      setShelves(newShelves);
    }

    setGridConfig({ rows: newRows, cols: newCols });
    
    // Adjust robot position if out of bounds
    if (robotRef.current.x >= newCols || robotRef.current.y >= newRows) {
      robotRef.current.x = Math.min(robotRef.current.x, newCols - 1);
      robotRef.current.y = Math.min(robotRef.current.y, newRows - 1);
      setRenderBot({...robotRef.current});
    }

    // Adjust Pickup if out of bounds
    if (pickupPoint.x >= newCols || pickupPoint.y >= newRows) {
       setPickupPoint({ x: Math.floor(newCols/2), y: Math.floor(newRows/2) });
    }
  };

  // Render grid tiles with memoization
  const renderTiles = useMemo(() => {
    const tiles = [];
    
    for (let y = 0; y < gridConfig.rows; y++) {
      for (let x = 0; x < gridConfig.cols; x++) {
        const key = `${x},${y}`;
        const isWall = obstacles.has(key);
        const isPath = renderBot.path.some(p => p.x === x && p.y === y);
        const isVisited = showScan && renderBot.visitedNodes.some(v => v.x === x && v.y === y);
        const isStart = x === chargePoint.x && y === chargePoint.y;
        const isPickup = x === pickupPoint.x && y === pickupPoint.y;
        const isCharging = false; 
        
        const shelf = shelves.find(s => s.x === x && s.y === y);

        tiles.push(
          <React.Fragment key={key}>
            <FloorTile 
              x={x}
              y={y}
              isWall={isWall}
              isPath={isPath}
              isVisited={isVisited}
              isStart={isStart}
              isPickup={isPickup}
              isCharging={isCharging}
              onClick={handleTileClick}
              editMode={editMode}
              showScan={showScan}
              tileSize={CONFIG.TILE_SIZE}
            />
            {shelf && (
              <Shelf3D 
                key={`shelf-${shelf.id}`}
                x={shelf.x}
                y={shelf.y}
                uid={shelf.uid}
                colorStr={shelf.color}
                items={shelf.items}
                isSelected={renderBot.heldItem?.shelfId === shelf.id}
              />
            )}
          </React.Fragment>
        );
      }
    }
    
    return tiles;
  }, [gridConfig, obstacles, renderBot, showScan, editMode, shelves, pickupPoint, placementMode]);

  return (
    <div className={`h-screen w-full ${theme === 'dark' ? 'bg-gray-950' : 'bg-gray-100'} flex flex-col overflow-hidden font-sans transition-colors duration-300`}>
      
      {/* TOP HEADER */}
      <div className="flex-none h-16 bg-gray-900/95 border-b border-gray-800 flex items-center justify-between px-6 z-20 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/20 rounded-lg">
            <Database className="text-blue-400" size={20} />
          </div>
          <div>
            <h1 className="text-lg font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              AWMS 3D COMMANDER
            </h1>
            <p className="text-[10px] text-gray-400 uppercase tracking-widest">Autonomous Warehouse System</p>
          </div>
        </div>

        {/* Top Status Bar */}
        <div className="flex items-center gap-6">
           <div className="flex items-center gap-2 px-4 py-1.5 bg-gray-800/50 rounded-full border border-gray-700">
              <div className={`w-2 h-2 rounded-full ${renderBot.state === 'IDLE' ? 'bg-gray-400' : renderBot.state === 'MOVING' ? 'bg-blue-400 animate-pulse' : 'bg-green-400'}`} />
              <span className="text-xs font-mono font-bold text-gray-300">{renderBot.state}</span>
           </div>
           
           <div className="flex items-center gap-2 px-4 py-1.5 bg-gray-800/50 rounded-full border border-gray-700">
              <Battery size={14} className={renderBot.battery < 20 ? 'text-red-400' : 'text-green-400'} />
              <span className={`text-xs font-mono font-bold ${renderBot.battery < 20 ? 'text-red-400' : 'text-green-400'}`}>
                {Math.round(renderBot.battery)}%
              </span>
           </div>
        </div>

        {/* Top Actions */}
        <div className="flex items-center gap-3">
           <button 
              onClick={() => { 
                setIsRunning(!isRunning); 
                if (!isRunning) setManualMode(false);
                addLog(isRunning ? "Simulation paused" : "Simulation started", 'info');
              }}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${
                isRunning 
                  ? 'bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30' 
                  : 'bg-green-500/20 text-green-400 border border-green-500/50 hover:bg-green-500/30'
              }`}
            >
              {isRunning ? <><Pause size={14} /> STOP</> : <><Play size={14} /> START</>}
            </button>
        </div>
      </div>

      {/* MAIN CONTENT SPLIT */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* LEFT: 3D CANVAS */}
        <div className="flex-1 relative bg-black/20">
            {/* FPS Counter */}
            <div className="absolute top-4 left-4 z-10 bg-black/50 backdrop-blur rounded px-2 py-1 text-[10px] font-mono text-green-400 border border-white/10">
              FPS: {performanceState.fps}
            </div>

            <Canvas 
              shadows
              camera={{ position: [8, 15, 8], fov: 45 }}
              gl={{ antialias: true }}
            >
              <color attach="background" args={[theme === 'dark' ? '#030712' : '#f3f4f6']} />
              <ambientLight intensity={0.4} />
              <directionalLight position={[10, 20, 10]} intensity={1.2} castShadow />
              <pointLight position={[0, 10, 0]} intensity={0.5} color="#60a5fa" />
              <Environment preset="city" />
              
              <OrbitControls target={[gridConfig.cols/2, 0, gridConfig.rows/2]} maxPolarAngle={Math.PI / 2} />
              
              <group position={[0.5, 0, 0.5]}>
                {renderTiles}
                <Robot3D x={renderBot.x} y={renderBot.y} heldItem={renderBot.heldItem} battery={renderBot.battery} isMoving={renderBot.state === 'MOVING'} />
                {renderBot.state === 'CHARGING' && <ParticleSystem position={[chargePoint.x, 1, chargePoint.y]} color="#f59e0b" />}
                {renderBot.state === 'DROPPING' && <ParticleSystem position={[renderBot.x, 1.5, renderBot.y]} color="#22c55e" />}
              </group>
              <fog attach="fog" args={[theme === 'dark' ? '#030712' : '#f3f4f6', 20, 50]} />
            </Canvas>
        </div>

        {/* RIGHT: CONTROL SIDEBAR */}
        <div className="w-80 bg-gray-900 border-l border-gray-800 flex flex-col z-10 shadow-2xl">
          
          {/* Scrollable Controls Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            
            {/* 1. Analytics Card */}
            {showAnalytics && (
              <div className="bg-gray-800/40 rounded-xl p-3 border border-gray-700/50">
                <h3 className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Activity size={12} /> Analytics
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-gray-900/50 p-2 rounded text-center">
                    <div className="text-[10px] text-gray-500">Distance</div>
                    <div className="font-mono font-bold">{stats.distance}m</div>
                  </div>
                  <div className="bg-gray-900/50 p-2 rounded text-center">
                    <div className="text-[10px] text-gray-500">Jobs</div>
                    <div className="font-mono font-bold text-green-400">{stats.jobs}</div>
                  </div>
                  <div className="bg-gray-900/50 p-2 rounded text-center">
                    <div className="text-[10px] text-gray-500">Efficiency</div>
                    <div className="font-mono font-bold text-cyan-400">{stats.efficiency}%</div>
                  </div>
                  <div className="bg-gray-900/50 p-2 rounded text-center">
                    <div className="text-[10px] text-gray-500">Avg Time</div>
                    <div className="font-mono font-bold text-yellow-400">{stats.avgTimePerJob}s</div>
                  </div>
                </div>
              </div>
            )}

            {/* 2. Controls Grid */}
            <div>
               <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Editor</h3>
               <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setShowScan(!showScan)} className={`py-2 text-[10px] font-bold rounded border ${showScan ? 'bg-purple-900/30 border-purple-500 text-purple-300' : 'bg-gray-800 border-gray-700 text-gray-400'}`}>
                    {showScan ? 'HIDE PATHS' : 'SHOW PATHS'}
                  </button>
                  <button onClick={() => setEditMode(!editMode)} className={`py-2 text-[10px] font-bold rounded border ${editMode ? 'bg-yellow-900/30 border-yellow-500 text-yellow-300' : 'bg-gray-800 border-gray-700 text-gray-400'}`}>
                    {editMode ? 'EXIT EDIT' : 'EDIT MAP'}
                  </button>
                  <button onClick={() => setManualMode(!manualMode)} className={`py-2 text-[10px] font-bold rounded border ${manualMode ? 'bg-orange-900/30 border-orange-500 text-orange-300' : 'bg-gray-800 border-gray-700 text-gray-400'}`}>
                    MANUAL
                  </button>
                  <button onClick={resetSystem} className="py-2 text-[10px] font-bold rounded border bg-red-900/20 border-red-500/30 text-red-400 hover:bg-red-900/40">
                    RESET
                  </button>
               </div>
            </div>

            {/* 3. Placement Tool (Only when Edit Mode is ON) */}
            {editMode && (
              <>
                <div className="bg-yellow-900/10 border border-yellow-500/20 p-3 rounded-xl">
                   <h3 className="text-xs font-bold text-yellow-400 uppercase tracking-wider mb-2">Placement Tool</h3>
                   <div className="grid grid-cols-3 gap-1">
                      <button 
                        onClick={() => setPlacementMode('WALL')}
                        className={`p-2 rounded text-[10px] font-bold flex flex-col items-center gap-1 ${placementMode === 'WALL' ? 'bg-yellow-500 text-black' : 'bg-gray-800 text-gray-400'}`}
                      >
                        <BrickWall size={14} /> WALL
                      </button>
                      <button 
                        onClick={() => setPlacementMode('PICKUP')}
                        className={`p-2 rounded text-[10px] font-bold flex flex-col items-center gap-1 ${placementMode === 'PICKUP' ? 'bg-yellow-500 text-black' : 'bg-gray-800 text-gray-400'}`}
                      >
                        <MapPin size={14} /> PICKUP
                      </button>
                      <button 
                        onClick={() => setPlacementMode('SHELF')}
                        className={`p-2 rounded text-[10px] font-bold flex flex-col items-center gap-1 ${placementMode === 'SHELF' ? 'bg-yellow-500 text-black' : 'bg-gray-800 text-gray-400'}`}
                      >
                        <Library size={14} /> SHELF
                      </button>
                   </div>
                   <div className="text-[10px] text-gray-500 mt-2 text-center">
                      Click on grid to Place/Remove
                   </div>
                </div>

                {/* Map Dimensions UI */}
                <div className="bg-gray-800/40 rounded-xl p-3 border border-gray-700/50">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                        <Maximize size={12} /> Map Dimensions
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-gray-900/50 p-2 rounded text-center">
                            <div className="text-[10px] text-gray-500 mb-1">Columns</div>
                            <div className="flex items-center justify-between gap-2">
                                <button disabled={isRunning} onClick={() => handleGridResize(gridConfig.rows, Math.max(CONFIG.MIN_GRID_SIZE, gridConfig.cols - 1))} className="text-gray-400 hover:text-white disabled:opacity-30"><Minus size={12}/></button>
                                <span className="font-mono font-bold text-sm">{gridConfig.cols}</span>
                                <button disabled={isRunning} onClick={() => handleGridResize(gridConfig.rows, Math.min(CONFIG.MAX_GRID_SIZE, gridConfig.cols + 1))} className="text-gray-400 hover:text-white disabled:opacity-30"><Plus size={12}/></button>
                            </div>
                        </div>
                        <div className="bg-gray-900/50 p-2 rounded text-center">
                            <div className="text-[10px] text-gray-500 mb-1">Rows</div>
                            <div className="flex items-center justify-between gap-2">
                                <button disabled={isRunning} onClick={() => handleGridResize(Math.max(CONFIG.MIN_GRID_SIZE, gridConfig.rows - 1), gridConfig.cols)} className="text-gray-400 hover:text-white disabled:opacity-30"><Minus size={12}/></button>
                                <span className="font-mono font-bold text-sm">{gridConfig.rows}</span>
                                <button disabled={isRunning} onClick={() => handleGridResize(Math.min(CONFIG.MAX_GRID_SIZE, gridConfig.rows + 1), gridConfig.cols)} className="text-gray-400 hover:text-white disabled:opacity-30"><Plus size={12}/></button>
                            </div>
                        </div>
                    </div>
                </div>
              </>
            )}

            {/* 4. Manual Controls (Conditional) */}
            {manualMode && (
              <div className="bg-orange-900/10 border border-orange-500/20 p-3 rounded-xl text-center">
                <div className="text-[10px] text-orange-400 mb-2">WASD Control</div>
                <div className="inline-flex flex-col items-center gap-1">
                  <button onClick={() => handleManualMove(0, -1)} className="p-2 bg-gray-800 rounded hover:bg-gray-700"><ArrowUp size={16}/></button>
                  <div className="flex gap-1">
                    <button onClick={() => handleManualMove(-1, 0)} className="p-2 bg-gray-800 rounded hover:bg-gray-700"><ArrowLeft size={16}/></button>
                    <button onClick={() => handleManualMove(0, 1)} className="p-2 bg-gray-800 rounded hover:bg-gray-700"><ArrowDown size={16}/></button>
                    <button onClick={() => handleManualMove(1, 0)} className="p-2 bg-gray-800 rounded hover:bg-gray-700"><ArrowRight size={16}/></button>
                  </div>
                </div>
              </div>
            )}

            {/* 5. Queue List */}
            <div className="flex-1 min-h-[150px]">
               <div className="flex items-center justify-between mb-2">
                 <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Job Queue</h3>
                 <button onClick={addRandomJob} className="text-[10px] bg-blue-600 hover:bg-blue-500 text-white px-2 py-0.5 rounded">
                   + ADD RANDOM
                 </button>
               </div>
               <div className="space-y-2">
                 {robotRef.current.queue.length === 0 && <div className="text-center text-xs text-gray-600 py-4">No jobs pending</div>}
                 {robotRef.current.queue.map((job, i) => (
                   <div key={job.id} className="bg-gray-800 p-2 rounded border-l-2 border-blue-500 flex justify-between items-center">
                      <div>
                        <div className="text-xs font-bold text-gray-300">{job.name}</div>
                        <div className="text-[10px] text-gray-500">{job.uid}</div>
                      </div>
                      <button onClick={() => removeJob(job.id)} className="text-gray-500 hover:text-red-400">✕</button>
                   </div>
                 ))}
               </div>
            </div>

          </div>

          {/* Bottom Logs Panel (Fixed height) */}
          <div className="h-40 border-t border-gray-800 bg-black/40 flex flex-col">
            <div className="px-4 py-2 flex justify-between items-center border-b border-gray-800/50">
              <span className="text-[10px] font-bold text-gray-500 uppercase">System Logs</span>
              <button onClick={() => setLogs([])} className="text-[10px] text-blue-400 hover:text-blue-300">Clear</button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {logs.map((log, i) => (
                <div key={i} className="text-[10px] font-mono text-gray-400 break-words leading-tight">
                  {log}
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
# Autonomous Warehouse Management System (AWMS) Simulator

## 📌 Project Overview

The **Autonomous Warehouse Management System (AWMS)** is a web-based simulation designed to demonstrate the core logic, pathfinding algorithms, and decision-making capabilities of an autonomous warehouse robot.

This simulation serves as the software **Digital Twin** for our Final Year Project, acting as a visual proof-of-concept for:

1. **Path Planning** – Avoiding obstacles dynamically  
2. **Task Scheduling** – Managing a First-In-First-Out (FIFO) queue of retrieval tasks  
3. **Resource Management** – Intelligent battery monitoring and auto-charging behaviors  

---

## 🚀 Key Features

### 🤖 Intelligent Navigation

- **A* Pathfinding Algorithm**  
  Visualizes the shortest path from point A to B while actively avoiding user-placed obstacles.

- **Dynamic Re-routing**  
  If a path is blocked, the robot recalculates a new route instantly.

---

### 🔋 Smart Battery Logic

- **Heuristic Energy Protection**  
  The robot estimates energy requirements before accepting a task.

- **Auto-Return to Charging Dock**  
  If `Current_Battery < Estimated_Cost`, the robot aborts the task and navigates to the charging station.

---

### 🏭 Dynamic Environment

- **Grid Editor**  
  Users can resize the warehouse grid (Rows/Columns) and place or remove walls and racks in real time.

- **Job Queue Management**  
  Users can add random jobs. The system ensures task variety by rotating between different shelf destinations  
  (e.g., Shelf A → Shelf B → Shelf C).

---

### 📊 Real-time Telemetry

- **Live Dashboard**
  - Battery percentage  
  - Current operational state (`IDLE`, `MOVING`, `PICKING`)  
  - Scrolling system log  

---

## 🛠️ Tech Stack

- **Frontend Framework:** React.js (via Vite)  
- **Programming Language:** JavaScript (ES6+)  
- **Styling:** Tailwind CSS  
- **Icons:** Lucide-React  
- **State Management:** React Hooks (`useState`, `useRef`, `useEffect`)  

---

## ⚙️ Installation & Setup

Follow the steps below to run the simulation locally.

### 1️⃣ Prerequisites

Ensure **Node.js (v14 or higher)** is installed.

---

### 2️⃣ Clone the Repository

```bash
git clone https://github.com/your-username/awms-simulator.git
cd awms-simulator
```

### 3️⃣ Install Dependencies

```bash
npm install
```

### 4️⃣ Run the Simulation
Start the development server:

```bash
npm run dev
```

Open the local URL provided in the terminal
(usually http://localhost:5173/) to access the dashboard.

### 🧠 Algorithms Explained
### 1️⃣ A* (A-Star) Pathfinding Algorithm

The simulation uses the A* algorithm to determine the most efficient path.

Cost function:

𝑓
(
𝑛
)
=
𝑔
(
𝑛
)
+
ℎ
(
𝑛
)
f(n)=g(n)+h(n)

Where:

g(n) → Actual cost from the start node to the current node

h(n) → Heuristic estimated cost from the current node to the goal

Heuristic Used:
Manhattan Distance

∣
𝑥
1
−
𝑥
2
∣
+
∣
𝑦
1
−
𝑦
2
∣
∣x
1
	​

−x
2
	​

∣+∣y
1
	​

−y
2
	​

∣

This heuristic is ideal because movement is restricted to a grid
(up, down, left, right).

### 2️⃣ Battery Cost Heuristic
Before starting a task, the robot estimates the total energy required:

```bash
Cost = (Distance_to_Pickup + Distance_to_Shelf + Distance_to_Charger)
       × Battery_Drain_Rate
```
If the robot determines that it cannot complete the full mission cycle safely, it prioritizes charging over task execution.


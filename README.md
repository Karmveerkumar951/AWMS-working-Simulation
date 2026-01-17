# 🚀 Autonomous Warehouse Management System (AWMS) Simulator

## 📌 Project Overview

The **Autonomous Warehouse Management System (AWMS) Simulator** is a **React-based interactive simulation** designed to demonstrate the **decision-making, path planning, and resource management logic** of an autonomous warehouse robot.

This simulator acts as a **software Digital Twin** for our **Final Year Project**, showcasing how an autonomous robot operates inside a warehouse environment by handling:

- 📍 Path Planning using the **A\*** Algorithm  
- 🧠 Task Scheduling with a dynamic job queue  
- 🔋 Intelligent Battery Monitoring and Auto-Charging  

---

## 🚀 Features

### 🧭 A* Pathfinding Algorithm
- Visualizes the **shortest path** from point A to point B.
- Dynamically avoids static and user-defined obstacles.

### 🔋 Smart Battery Logic
- The robot calculates energy requirements **before accepting a task**.
- If the battery is insufficient to complete:
  - Pickup → Shelf → Charging Dock  
- The task is rejected and the robot safely returns to charge.

### 🏗️ Dynamic Warehouse Environment
- **Grid Editor**
  - Resize warehouse dimensions in real time.
  - Add or remove obstacles (walls/racks).
- **Job Queue**
  - Add random jobs dynamically.
  - Shelf destinations rotate to ensure task diversity.

### 📊 Real-time Telemetry
- Live battery percentage
- Robot states:
  - `IDLE`
  - `MOVING`
  - `PICKING`
- System logs for monitoring and debugging

---

## 🛠️ Tech Stack

- **Framework:** React.js (Vite)
- **Language:** JavaScript (ES6+)
- **Styling:** Tailwind CSS
- **Icons:** Lucide-React

---

## ⚙️ Installation & Setup

### 1️⃣ Prerequisites
Ensure **Node.js** is installed on your system.

```bash
node -v

### 2️⃣ Install Dependencies
Open the terminal in the project directory and run:
```bash
npm install

### 3️⃣ Run the Simulation


📖 User Guide
▶️ Start / Stop Simulation

Click START (top-right corner) to activate the robot AI loop.

🧱 Edit Map

Click ADD OBSTACLES from the sidebar.

Click on a grid cell to place an obstacle.

Click again on the same cell to remove it.

Click DONE EDITING to save changes.

📦 Add Jobs

Click ADD RANDOM JOB to simulate incoming warehouse orders.

📐 Resize Grid

Use the + / - buttons in the sidebar to adjust warehouse dimensions dynamically.

🧠 Algorithms Used
1️⃣ A* (A-Star) Pathfinding Algorithm

The simulation uses the A* algorithm to calculate the shortest path using the cost function:

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

g(n) = Cost from the start node to the current node

h(n) = Heuristic estimated cost from the current node to the goal

📏 Manhattan Distance is used as the heuristic since movement is grid-based.

2️⃣ Heuristic Battery Protection Logic

Before executing any task, the robot performs a cost estimation:

ExpectedCost =
(Distance_To_Pickup + Distance_To_Shelf + Distance_To_Charger)
× Battery_Rate


If:

Current_Battery < ExpectedCost + Safety_Buffer


➡️ The robot rejects the task and immediately navigates to the charging dock to prevent mission failure.

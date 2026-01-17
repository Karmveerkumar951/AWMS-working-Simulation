Autonomous Warehouse Management System (AWMS) Simulator
📌 Project Overview
The Autonomous Warehouse Management System (AWMS) is a web-based simulation designed to demonstrate the core logic, pathfinding algorithms, and decision-making capabilities of an autonomous warehouse robot.
This simulation serves as the software "Digital Twin" for our Final Year Project, acting as a visual proof-of-concept for:
Path Planning: Avoiding obstacles dynamically.
Task Scheduling: Managing a First-In-First-Out (FIFO) queue of retrieval tasks.
Resource Management: Intelligent battery monitoring and auto-charging behaviors.
📸 Screenshots
(Place a screenshot of your simulation running here)
🚀 Key Features
🤖 Intelligent Navigation
*A Pathfinding Algorithm:** Visualizes the shortest path from point A to B while actively avoiding user-placed obstacles.
Dynamic Re-routing: If a path is blocked, the robot calculates a new route instantly.
🔋 Smart Battery Logic
Heuristic Energy Protection: The robot calculates energy requirements before accepting a task.
Auto-Return: If Current_Battery < Estimated_Cost, the robot aborts work and navigates to the charging dock.
🏭 Dynamic Environment
Grid Editor: Users can resize the warehouse (Rows/Cols) and place/remove walls or racks in real-time.
Job Queue: Users can add random jobs. The system ensures variety by rotating between different shelf destinations (e.g., Shelf A -> Shelf B -> Shelf C).
📊 Real-time Telemetry
Dashboard: Displays live battery percentage, current operational state (IDLE, MOVING, PICKING), and a scrolling system log.
🛠️ Tech Stack
Frontend Framework: React.js (via Vite)
Language: JavaScript (ES6+)
Styling: Tailwind CSS
Icons: Lucide-React
State Management: React Hooks (useState, useRef, useEffect)
⚙️ Installation & Setup
Follow these steps to run the simulation locally on your machine.
1. Prerequisites
Ensure you have Node.js (v14 or higher) installed.
2. Clone the Repository
git clone [https://github.com/your-username/awms-simulator.git](https://github.com/your-username/awms-simulator.git)
cd awms-simulator


3. Install Dependencies
npm install


4. Run the Simulation
Start the local development server:
npm run dev


Click the local link provided in the terminal (usually http://localhost:5173/) to open the dashboard.
🧠 Algorithms Explained
1. A* (A-Star) Pathfinding
The simulation uses A* to find the most efficient path. It evaluates nodes based on the cost function:
$$ f(n) = g(n) + h(n) $$
$g(n)$: The actual cost from the start node to the current node.
$h(n)$: The heuristic estimated cost from the current node to the goal.
Implementation: We use Manhattan Distance ($|x_1 - x_2| + |y_1 - y_2|$) because movement is restricted to a grid (up, down, left, right).
2. Battery Cost Heuristic
Before moving, the robot estimates the "Energy Cost" of a full mission cycle:
Cost = (Dist_To_Pickup + Dist_To_Shelf + Dist_To_Charger) * Battery_Drain_Rate


If the robot determines it cannot complete the full cycle and return to the charger safely, it prioritizes charging over working.
📄 License
This project is developed for educational purposes as part of a Final Year Project curriculum.

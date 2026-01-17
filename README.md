Autonomous Warehouse Management System (AWMS) Simulator
📌 Project Overview
The Autonomous Warehouse Management System (AWMS) is a React-based simulation
designed to demonstrate the core logic, pathfinding algorithms, and decision-making
capabilities of an autonomous warehouse robot.
This simulation serves as the software "Digital Twin" for our Final Year Project, showcasing how
the robot handles:
1. Path Planning: Avoiding obstacles using the A* Algorithm.
2. Task Scheduling: Managing a dynamic queue of retrieval tasks.
3. Resource Management: Intelligent battery monitoring and auto-charging.
🚀 Features
*A Pathfinding Algorithm:** visualizes the shortest path from point A to B while actively
avoiding dynamic obstacles.
Smart Battery Logic: The robot calculates energy requirements before accepting a task. If
the battery is too low to complete the full cycle (Pickup -> Shelf -> Charge), it aborts and
returns to the charging dock.
Dynamic Environment:
Grid Editor: Users can increase/decrease warehouse size and place/remove obstacles
(walls/racks) in real-time.
Job Queue: Users can add random jobs to the queue. The system ensures variety by
rotating between different shelf destinations.
Real-time Telemetry: Dashboard displays live battery status, current state (IDLE, MOVING,
PICKING), and system logs.
🛠️Tech Stack
Framework: React.js (Vite)
Language: JavaScript (ES6+)
Styling: Tailwind CSS
Icons: Lucide-React
⚙️ Installation & Setup
Follow these steps to run the simulation locally on VS Code:
1. Prerequisites
Ensure you have Node.js installed.

2. Installation

Open your terminal in the project folder and run:

npm install


3. Running the Simulation

Start the development server:

npm run dev


Click the link provided in the terminal (usually http://localhost:5173/).

The simulation will open in your default browser.

📖 User Guide

Start/Stop: Click the START button in the top right to enable the robot's AI loop.

Edit Map:

Click ADD OBSTACLES in the sidebar.

Click on any empty grid cell to place a wall/obstacle.

Click again to remove it.

Click DONE EDITING to save.

Add Jobs: Click ADD RANDOM JOB to simulate a new order coming into the warehouse system.

Resize Grid: Use the + and - buttons in the sidebar to change the warehouse dimensions.

🧠 Algorithms Used

1. A* (A-Star) Pathfinding

The simulation uses the A* algorithm to find the shortest path. It evaluates nodes based on the cost function:


$$f(n) = g(n) + h(n)$$

g(n): The cost from the start node to the current node.

h(n): The heuristic estimated cost from the current node to the goal (we use Manhattan Distance since movement is grid-based).

2. Heuristic Battery Protection

Before starting a mission, the robot performs a "Cost Estimate":

ExpectedCost = (Distance_To_Pickup + Distance_To_Shelf + Distance_To_Charger) * Battery_Rate


If Current_Battery < ExpectedCost + Safety_Buffer, the robot refuses the task and navigates to the charger immediately.

📄 License

This project is developed for educational purposes as part of the Final Year Project curriculum.

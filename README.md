# AlgoHealth -Clinic Management System

A comprehensive clinic management system built with Node.js, Express, and Prisma. This system implements various scheduling and optimization algorithms to efficiently manage clinic appointments and resources.

## Features

- **Appointment Management**
  - Priority-based scheduling
  - Shortest Job First (SJF) scheduling
  - Round Robin simulation
  - Real-time status updates

- **Task Management**
  - Job sequencing with deadlines
  - Profit maximization
  - Gantt chart visualization

- **Resource Optimization** 
  - Fractional Knapsack algorithm for supply allocation
  - Budget-based resource planning
  - Value optimization

- **Network Planning**
  - Minimum Spanning Tree algorithms (Kruskal's & Prim's)
  - Clinic network visualization
  - Cost-efficient connection planning

## Prerequisites

- Node.js
- PostgreSQL
- NPM

## Tech Stack

- Express.js
- Prisma ORM
- EJS Templates
- Session Authentication

## Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Configure environment variables
4. Run database migrations: `npx prisma migrate dev`
5. Start server: `npm start`

## Security

- Session-based authentication
- Role-based access control
- Admin privilege verification

## License

MIT

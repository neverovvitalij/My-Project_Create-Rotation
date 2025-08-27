Rotation Plan Scheduler

A web application to generate and manage daily rotation schedules for production line workers. It automatically assigns employees to stations based on priorities, special assignments, and rotation cycles, and provides Excel previews and downloads.

Features
• Automatic Rotation: Generates rotations considering high-priority stations, special tasks, and cycle assignments.
• Priority Handling: Ensures stations with higher priority are staffed first.
• Special Assignments: Supports manual pre-assignment for specific tasks.
• Excel Export & Preview: Preview rotation in-browser and download as formatted Excel file.
• MongoDB Persistence: Saves confirmed rotations with automatic expiration.
• Support: Frontend written in React + JavaScript; backend in Node.js + Express + Mongoose.
• TypeScript Migration
Originally the frontend was written in JavaScript and is now being gradually rewritten to TypeScript (React + TypeScript); the backend remains in Node.js + Express + Mongoose, with TypeScript support planned.

Tech Stack
• Frontend: React, MobX, JavaScript/TypeScript, CSS Modules
• Backend: Node.js, Express, MongoDB, Mongoose, ExcelJS
• API: RESTful endpoints for rotation generation, confirmation, and Excel export
• Dev Tools: Webpack, Babel, ESLint, Prettier

Installation 1. Clone repository:

git clone https://github.com/neverovvitalij/My-Project_Create-Rotation
cd My-App

    2.	Backend setup:

cd backend
npm install
.env # configure MongoDB URI, JWT secrets, etc.
PORT=8080
DB_URL=mongodb+srv
JWT_ACCESS_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_jwt_secret
JWT_RESET_PASSWORD_SECRET=your_jwt_secret
API_URL=http://localhost:8080
CLIENT_URL=http://localhost:3000
ADMIN_EMAIL=admin@yourdomain.com
MAILJET_API_KEY=your_mailjet_key
MAILJET_API_SECRET=your_mailjet_apikey
MAILJET_SENDER_EMAIL=no-reply@yourdomain.com
MAILJET_SENDER_NAME=no-reply@yourdomain.com

npm run dev

    3.	Frontend setup:

cd ../frontend
npm install
.env
REACT_APP_API_URL=http://localhost:8080/api

npm start

Frontend runs at http://localhost:3000 and backend at http://localhost:8080 by default.

Usage 1. Log in or register a user. 2. Create stations. 3. Add employees and assign their stations. 4. Configure special assignments and pre-assigned stations. 5. Select number of rotation cycles and generate daily schedule. 6. Preview the schedule in-browser. 7. Confirm rotation to save it in the database. 8. Download the schedule as an Excel file.

Project Structure

├── backend/ # Express API and services
│ ├── controllers/ # Request handlers
│ ├── services/ # Business logic (rotation generation, Excel)
│ ├── models/ # Mongoose schemas
│ └── routes/ # API endpoints
├── frontend/ # React + TypeScript app
│ ├── src/
│ │ ├── components/ # UI components
│ │ ├── store/ # MobX store and types
│ │ ├── services/ # API service wrappers
│ │ └── styles/ # CSS Modules
│ └── public/
└── README.md

This project is private. Source code access is restricted. For inquiries, contact the repository owner.

For support, contact: vitalij.neverov@gmail.com

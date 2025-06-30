Rotation Plan Service

A full-stack web application for generating and managing daily rotation plans for manufacturing or production environments. Users can define stations, assign priorities, set up workers’ skills, and generate rotation schedules including high-priority, special assignments, and cyclical rotations.

Table of Contents
• Features
• Tech Stack
• Folder Structure
• Installation
• Environment Variables
• Backend Usage
• Frontend Usage
• API Endpoints
• Scripts
• Contributing
• License

Features
• Station Management: Create, update, and delete work stations with priority levels (1–3).
• Worker Management: Define workers, their skills (stations they can operate), and availability status.
• Rotation Generation: Automatic schedule generation:
• Special assignments (“Sondertätigkeiten”).
• High-priority station assignments.
• Cyclical rotations for standard stations.
• Excel Export: Export generated rotations to an Excel file with formatted borders, headers, and color-coded blocks.
• Email Notifications: Send activation and password-reset emails via Mailjet.
• Authentication: JWT-based signup, login, and token refresh.

Tech Stack
• Frontend
• React (v19)
• MobX for state management
• Axios for HTTP requests
• React Router DOM for routing
• xlsx for client-side Excel viewing/download
• Create React App
• Backend
• Node.js (v18+)
• Express.js
• MongoDB with Mongoose
• JSON Web Tokens for authentication
• Bcrypt for password hashing
• ExcelJS for server-side Excel generation
• Mailjet for email services

Folder Structure

root/
├── frontend/ # React application
│ ├── src/
│ ├── public/
│ └── package.json
├── backend/ # API server
│ ├── controllers/
│ ├── models/
│ ├── services/
│ ├── dtos/
│ ├── middlewares/
│ ├── index.js
│ └── package.json
├── README.md
└── .env.example # Environment variable template

Installation 1. Clone the repository

git clone git@github.com:yourusername/rotation-plan-service.git
cd rotation-plan-service

    2.	Backend setup

cd backend
npm install
cp .env.example .env

# Fill in .env with your settings

npm run dev

    3.	Frontend setup

cd ../frontend
npm install
npm start

Open your browser at http://localhost:3000 and the API at http://localhost:8080.

Environment Variables

Create a .env file inside backend/ with at least:

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

Backend Usage
• Development: npm run dev (uses nodemon)
• Production: node index.js (ensure environment variables are set and MongoDB is running)

Frontend Usage
• Development: npm start
• Production Build: npm run build

Scripts

Command Description
npm start Run frontend in development mode
npm run build Create production build of frontend
npm run dev Run backend with nodemon

Contributing 1. Fork this repository. 2. Create a feature branch: git checkout -b feature/my-feature. 3. Commit your changes: git commit -m "Add my feature". 4. Push to branch: git push origin feature/my-feature. 5. Open a pull request.

Please follow conventional commits.

License

This project is private. Source code access is restricted. For inquiries, contact the repository owner.

For support, contact: vitalij.neverov@gmail.com

Rotationsplan Management System

Overview

The Rotationsplan Management System is a web application designed to manage rotation schedules, station lists, and working personnel efficiently. Each registered user can create and manage rotation plans independently for their own production line without accessing data from other users.

Features

User authentication (registration, login, and password reset)

Independent rotation queue management per user

Station and personnel list management

High-priority personnel assignments

Excel export for rotation plans

Technologies Used

Frontend: React, MobX, React Router

Backend: Node.js, Express, MongoDB, Mongoose

Authentication: JWT (JSON Web Tokens)

Styling: CSS Modules

Data Export: ExcelJS

Installation

Prerequisites

Ensure you have the following installed on your system:

Node.js (v18 or higher)

MongoDB (Atlas or local instance)

npm or yarn

Setup

Clone the repository:

git clone https://github.com/neverovvitalij/My-Project_Create-Rotation
cd rotationsplan

Install dependencies for both frontend and backend:

npm install

Environment Variables

Create a .env file in the backend directory and configure the following variables:

PORT=8001
CLIENT_URL=http://localhost:3000
DB_URL=mongodb+srv://your-db-url
JWT_SECRET=your-secret-key
MAIL_USER=your-email@example.com
MAIL_PASS=your-email-password

Running the Application

Start the Backend

npm run dev

Start the Frontend

cd frontend
npm start

API Endpoints

Authentication

POST /api/registration - Register a new user

POST /api/login - User login

POST /api/logout - User logout

POST /api/request-reset-password - Request password reset

POST /api/reset-password - Reset password

Rotation Management

POST /api/rotation/create - Create a new rotation queue

GET /api/rotation - Fetch all rotations for a user

PUT /api/rotation/:id - Update a rotation plan

DELETE /api/rotation/:id - Delete a rotation plan

Station and Personnel Management

POST /api/stations - Add a new station

GET /api/stations - Retrieve all stations for a user

DELETE /api/stations/:id - Remove a station

POST /api/personnel - Add personnel to a station

GET /api/personnel - Fetch personnel list

Export Data

GET /api/export/excel - Generate and download an Excel file for the rotation plan

Deployment

To deploy the application, configure an online database (MongoDB Atlas) and deploy both frontend and backend using services like:

Frontend: Vercel, Netlify

Backend: Heroku, Railway, Render

Ensure environment variables are set correctly in your deployment service.

Contact

For support, contact: vitalij.neverov@gmail.com

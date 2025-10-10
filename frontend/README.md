# Rotation Plan Scheduler

A web app to generate and manage daily rotation schedules for production workers. It auto-assigns employees to stations based on priorities, special assignments, and rotation cycles, shows a preview in the browser, and lets you download a formatted Excel file.

## Features

- **Automatic Rotation:** builds rotations for N cycles considering station priority and constraints.
- **Priority Handling (incl. GV):** high-priority stations are staffed first. For **GV** (management) stations: **chief** is always first while present; only if chief is absent, the **deputy** takes the slot.
- **Special & Pre-assigned:** support for day-specific special tasks and forced (pre) assignments.
- **Excel Export & Preview:** in-browser preview and modern formatted Excel export.
- **MongoDB Persistence:** confirmed rotations are saved; rotation queues are updated (worked person goes to queue tail).
- **Auth:** httpOnly refresh cookie, `POST /api/refresh`, CORS with credentials.

## Tech Stack

- **Frontend:** React, Vite, TypeScript, MobX, CSS Modules
- **Backend:** Node.js, Express, MongoDB, Mongoose, ExcelJS
- **API:** REST endpoints for rotation preview/confirm and Excel export
- **Dev Tools:** Vite (replaces CRA/Webpack), ESLint, Prettier, nodemon

---

## Installation

### 1) Clone

```bash
git clone https://github.com/neverovvitalij/My-Project_Create-Rotation
cd My-App

cd backend
npm install

# server
PORT=8080
API_URL=http://localhost:8080
CLIENT_URL=http://localhost:5173

# database & jwt
DB_URL=mongodb+srv://<user>:<pass>@<cluster>/<db>?retryWrites=true&w=majority
JWT_ACCESS_SECRET=your_access_secret
JWT_REFRESH_SECRET=your_refresh_secret
JWT_RESET_PASSWORD_SECRET=your_reset_secret

# mail (Mailjet)
ADMIN_EMAIL=admin@yourdomain.com
MAILJET_API_KEY=your_mailjet_key
MAILJET_API_SECRET=your_mailjet_secret
MAILJET_SENDER_EMAIL=no-reply@yourdomain.com
MAILJET_SENDER_NAME=Rotation Plan Service

npm run dev
The backend code lives in backend/src/ (entry: src/index.js).
Keep .env in the backend root (not inside src/).

cd ../frontend
npm install

VITE_API_URL=http://localhost:8080/api

npm run dev

Usage (end-to-end)
	1.	Register a user, specifying Plant / Shift / Cost Center.
	2.	Activate via the email link; Admin approval finalizes activation.
	3.	Login (access token in response; refresh token in httpOnly cookie).
	4.	(Optional) Add Special and Pre-assigned items.
	5.	Choose number of cycles and Generate preview.
	6.	Confirm the rotation to persist it and rotate queues.
	7.	Download Excel (rotationsplan_DD-MM-YYYY.xlsx) with a modern layout:
	    •	Left: groups with up to 5 cycles,
	    •	Right: Tagesrotation (high priority), Sondertätigkeiten, Abwesend

    Project Structure
    backend/
        src/
            controllers/
            services/
            models/
            routes/
            middlewares/
            lib/
             index.js
    .env
    frontend/
        index.html
        src/
            components/
            store/
            services/
            styles/
README.md

For inquiries/support: vitalij.neverov@gmail.com
```

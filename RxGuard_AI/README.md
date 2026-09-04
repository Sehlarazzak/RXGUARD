# 🛡️ RxGuard AI

RxGuard AI is a medication-safety and information platform that helps patients and healthcare professionals check medicine safety, track recalls and alerts, and make more informed decisions. It supports — but does not replace — doctors, pharmacists, official regulatory notices, or clinical judgment.

## Features

- Patients can search for medicines and view current safety information.
- Patients receive alerts about recalls, discontinued medicines, falsified products, and safety notices.
- Users can save medicines to a watchlist and get status updates.
- Doctors and pharmacists can compare medicines and review possible alternatives.
- Administrators can add trusted sources, verify medicine data, approve updates, correct mistakes, and manage users.
- Every medicine record shows its source, verification date, and data status.
- AI-assisted explanations of complex medicine notices in simple language, with the official source kept visible.
- The system flags information that is missing, conflicting, or outdated.

## Tech Stack

**Frontend**
- Expo (React Native) with Expo Router
- TypeScript

**Backend**
- Node.js with Express (REST API)
- JSON Web Tokens (JWT) for authentication, with role-based access (patient, doctor, pharmacist, admin)
- bcryptjs for password hashing
- Multer for file uploads (e.g. prescriptions)

**Database**
- PostgreSQL

## Project Structure

```
RxGuard-AI/
├── backend/          # Express REST API
│   ├── src/
│   │   ├── routes/       # auth, medicines, prescriptions, history, admin
│   │   ├── middleware/   # auth middleware
│   │   ├── db.js         # PostgreSQL connection
│   │   └── server.js     # app entry point
│   ├── .env.example
│   └── package.json
├── frontend/         # Expo Router app
│   ├── src/
│   └── package.json
├── database/         # SQL schema and seed files
│   ├── schema.sql
│   └── seed-batches.sql
└── docs/
    └── test-screenshots/
```

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later recommended)
- [PostgreSQL](https://www.postgresql.org/) installed and running locally, or a hosted instance
- [Expo Go](https://expo.dev/go) app on your phone (for running the frontend on a mobile device), or an Android/iOS simulator

### 1. Clone the repository

```bash
git clone https://github.com/Sehlarazzak/RxGuard_AI.git
cd RxGuard_AI
```

### 2. Set up the database

Create an empty PostgreSQL database. The backend will create tables, indexes and seed data automatically on first start.

```bash
psql -U postgres -c 'CREATE DATABASE "RxGuard AI";'
```

> If you prefer to apply the schema manually, run `psql -U your_db_username -d "RxGuard AI" -f database/schema.sql`.

### 3. Set up the backend

```bash
cd backend
npm install
```

Create your local environment file from the example and fill in your credentials:

```bash
npm run setup      # copies .env.example to .env
```

Edit `.env` and set your database credentials and JWT secret:

```
PORT=3001
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=RxGuard AI
DB_USER=your_db_username
DB_PASSWORD=your_db_password
JWT_SECRET=your_jwt_secret
```

Start the backend server:

```bash
npm start
```

The API will run on `http://localhost:3001` by default. On first start it will print:

```
No mediverify schema found. Creating full schema and seed data...
Database initialisation complete.
```

### 4. Set up the frontend

In a new terminal:

```bash
cd frontend
npm install
npm start
```

This opens the Expo dev tools. From there you can:
- Press `w` to open in a web browser
- Press `a` to open on an Android emulator
- Scan the QR code with the **Expo Go** app to open on your phone

The frontend detects where it is running:
- In the Expo web dev server it calls `http://localhost:3001/api`.
- When the exported web build is served by the backend on port 3001, it uses `/api`.
- Set `EXPO_PUBLIC_API_URL` to override the API URL for hosted or network demos.

## Screenshots

See [`docs/test-screenshots`](./docs/test-screenshots) for a walkthrough of the app's core flows, including patient dashboard, prescription workflows, doctor approvals, and admin tools.

## Disclaimer

RxGuard AI is an informational and decision-support tool. It does not prescribe medicines or make final treatment decisions, and it is not a substitute for professional medical advice, diagnosis, or treatment.

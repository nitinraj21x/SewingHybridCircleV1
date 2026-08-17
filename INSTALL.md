# Local Installation Guide — Sewing Circle App

This guide walks you through running the app on your local machine. The project has two parts that run simultaneously:

| Part | Tech | Port |
|---|---|---|
| **Frontend** | React + Vite | `http://localhost:5173` |
| **Backend** | Node.js + Express | `http://localhost:4000` |

---

## Prerequisites

Make sure you have the following installed before starting.

### 1. Node.js (v18 or higher)

Check if you already have it:
```bash
node -v
```

If not installed, download from: **https://nodejs.org** — choose the **LTS** version.

### 2. Git

Check if you already have it:
```bash
git --version
```

If not installed, download from: **https://git-scm.com/downloads**

---

## Step 1 — Clone the Repository

Open a terminal (Command Prompt, PowerShell, or Terminal) and run:

```bash
git clone https://github.com/nitinraj21x/SewingHybridCircleV1.git
cd SewingHybridCircleV1
```

---

## Step 2 — Set Up the Frontend Environment

In the root of the project folder, create a file named `.env` by copying the example:

**Windows (Command Prompt):**
```cmd
copy .env.example .env
```

**Mac / Linux:**
```bash
cp .env.example .env
```

Open `.env` in any text editor. It will look like this:

```
VITE_CLOUDINARY_CLOUD_NAME=abvjgsog
VITE_EMAILJS_PUBLIC_KEY=YOUR_PUBLIC_KEY
VITE_EMAILJS_SERVICE_ID=YOUR_SERVICE_ID
VITE_EMAILJS_TEMPLATE_ID=YOUR_TEMPLATE_ID
VITE_EMAILJS_REGISTRATION_TEMPLATE_ID=YOUR_REGISTRATION_TEMPLATE_ID
VITE_API_BASE_URL=http://localhost:4000
```

> **For local testing**, the `VITE_CLOUDINARY_CLOUD_NAME` and `VITE_API_BASE_URL` values are already filled in correctly. You only need to fill in the `VITE_EMAILJS_*` values if you want the contact/registration forms to send real emails — otherwise leave them as-is.

---

## Step 3 — Set Up the Backend Environment

Navigate into the `backend` folder and create its `.env` file:

**Windows (Command Prompt):**
```cmd
cd backend
copy .env.example .env
cd ..
```

**Mac / Linux:**
```bash
cp backend/.env.example backend/.env
```

Open `backend/.env` in a text editor. It will look like this:

```
MONGODB_URI=mongodb+srv://...
JWT_SECRET=REPLACE_WITH_64_CHAR_RANDOM_HEX
JWT_EXPIRES_IN=8h
PORT=4000
FRONTEND_ORIGIN=http://localhost:5173
CLOUDINARY_CLOUD_NAME=abvjgsog
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

> **The `MONGODB_URI` and Cloudinary values are pre-filled** and ready to use. You only need to replace `JWT_SECRET` with a random string. You can generate one by running:
>
> ```bash
> node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
> ```
>
> Copy the output and paste it as the `JWT_SECRET` value.

---

## Step 4 — Install Dependencies

You need to install packages for both the frontend and the backend.

**Install frontend packages** (run from the root project folder):
```bash
npm install
```

**Install backend packages:**
```bash
cd backend
npm install
cd ..
```

This may take a minute or two. You should see no errors — warnings are fine.

---

## Step 5 — Run the App

You need **two terminal windows open at the same time** — one for the backend, one for the frontend.

### Terminal 1 — Start the Backend

```bash
cd backend
npm run dev
```

You should see:
```
[db] Connected to MongoDB Atlas
[server] Running on port 4000
```

### Terminal 2 — Start the Frontend

Open a **new** terminal window, navigate back to the root project folder, then run:

```bash
npm run dev
```

You should see:
```
  VITE v8.x.x  ready in xxx ms
  ➜  Local:   http://localhost:5173/
```

---

## Step 6 — Open the App

Open your browser and go to:

| Page | URL |
|---|---|
| **Public Website** | http://localhost:5173 |
| **Employee Portal** | http://localhost:5173/portal |

---

## Default Login Credentials (Portal)

Use these to log into the employee portal at `/portal`:

| Role | Email | Password |
|---|---|---|
| Admin | *(check with the project owner)* | *(check with project owner)* |

> If login doesn't work, the database may need to be seeded. Run this once from the `backend` folder:
> ```bash
> cd backend
> npm run seed
> ```

---

## Troubleshooting

**`npm install` fails with permission errors**
- On Mac/Linux, do not use `sudo npm install`. Instead fix npm permissions: https://docs.npmjs.com/resolving-enoent-errors

**Port 4000 or 5173 already in use**
- Another process is using that port. Either stop it, or change the port in `backend/.env` (`PORT=4001`) and in the frontend `.env` (`VITE_API_BASE_URL=http://localhost:4001`).

**"Cannot connect to MongoDB" error in the backend terminal**
- Check your internet connection. The database is hosted on MongoDB Atlas and requires internet access.

**Blank page or React errors in the browser**
- Make sure the backend is running first (Terminal 1), then start the frontend (Terminal 2).
- Open browser DevTools (F12) → Console tab for specific error messages.

**`node` command not found**
- Node.js is not installed or not in your PATH. Reinstall from https://nodejs.org and restart your terminal.

---

## Folder Structure (Quick Reference)

```
SewingHybridCircleV1/
├── src/                  ← Frontend React source
│   ├── public-site/      ← Public Sewing Circle website
│   └── portal/           ← Employee portal (RBAC)
├── backend/              ← Express API server
│   └── src/
│       ├── routes/       ← API endpoints
│       ├── models/       ← MongoDB data models
│       └── server.js     ← Entry point
├── public/               ← Static assets
├── .env.example          ← Frontend env template
├── backend/.env.example  ← Backend env template
└── package.json          ← Frontend dependencies
```

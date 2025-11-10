# GEMINI.md - Project Overview

## Project Overview

This project is a "Video Encoding Farm," a web-based application for managing and executing video transcoding jobs. It is a self-contained, single-machine prototype built with Node.js and Express.

The core functionality revolves around a job queue stored in a SQLite database. A scheduler loop continuously checks for queued jobs, processing them one at a time. It uses `ffmpeg` for encoding and `ffprobe` for media analysis.

The application provides both a simple web interface and a RESTful API to manage the encoding jobs.

**Key Technologies:**

*   **Backend:** Node.js, Express.js
*   **Frontend:** Pug (Jade) for server-side rendering
*   **Database:** SQLite (experimental native Node.js driver)
*   **Core Logic:** Spawns `ffmpeg` child processes for video encoding.
*   **Package Manager:** pnpm

**Architecture:**

*   `app.mjs`: The main application entry point. It initializes the Express server and starts the central job `schedulerLoop`.
*   `config/`: Contains default application configuration.
*   `src/controllers/`: Handles the business logic for interacting with the job database.
*   `src/db/`: Contains database migration and query logic.
*   `src/routes/`: Defines the web UI and API routes.
*   `src/services/`: Contains specialized modules, notably `ffmpeg-runner.mjs` which is the wrapper around the `ffmpeg` command-line tool.
*   `views/`: Pug templates for the web interface.

## Building and Running

### Prerequisites

*   Node.js (v22+)
*   `pnpm` (v10+)
*   `ffmpeg` and `ffprobe` installed and available in the system's PATH.

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Initialize the Database

This command sets up the initial SQLite database schema.

```bash
pnpm migrate
```

### 3. Run the Application

**For production:**

```bash
pnpm start
```

**For development (with hot-reloading):**

```bash
pnpm dev
```

The server will start on `http://localhost:3000` by default.

## Development Conventions

*   **Language:** JavaScript with ES Modules (ESM).
*   **Code Style:** The code follows a consistent style with JSDoc comments for documenting files and functions. It uses modern JavaScript features available in Node.js 22.
*   **Configuration:** Configuration is managed via a default config file (`config/default.mjs`) which can be overridden by environment variables (e.g., `.env` file).
*   **API:** A RESTful API is provided for job management, following standard conventions (e.g., `POST /api/jobs`, `GET /api/jobs/:id`).
*   **Error Handling:** Express middleware is used for centralized error handling. The scheduler loop includes `try...catch` blocks to prevent crashes from individual job failures.
*   **Database:** Database interactions are abstracted away in the `src/controllers/jobs.mjs` file. The schema is managed via the `pnpm migrate` script.

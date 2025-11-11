# GEMINI.md - Project Overview

## Project Overview

This project is a "Video Encoding Farm," a web-based application for managing and executing video transcoding jobs. It is a self-contained, single-machine prototype built with Node.js and Express.js，并采用 Pug 模板引擎进行服务器端渲染（SSR），旨在提供一个最小可行产品（MVP）。

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

*   Node.js (v24+)
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
*   **Native Features First:** Prioritize the use of native Node.js features (e.g., `--env-file` for environment variables, `node:sqlite` for database, `node:test` for testing, native `glob` functionality) where applicable, to minimize external dependencies and leverage platform capabilities.
*   **Code Style & Readability:** Code should be written in a clear, concise, and human-readable manner. Follow consistent coding styles and project structure conventions. **建议使用 ESLint 和 Prettier 保持代码风格一致性。**
*   **JSDOC Comments:** All code should be well-documented using JSDOC comments for functions, classes, and complex logic to enhance understanding and maintainability.
*   **Dependency Management:** All project dependencies are managed using `pnpm`.
*   **Configuration:** Configuration is managed via a default config file (`config/default.mjs`) which can be overridden by environment variables (e.g., `.env` file).
*   **API:** A RESTful API is provided for job management, following standard conventions (e.g., `POST /api/jobs`, `GET /api/jobs/:id`).
*   **Error Handling:** Express middleware is used for centralized error handling. The scheduler loop includes `try...catch` blocks to prevent crashes from individual job failures. **所有错误应被捕获并以统一的方式处理，避免应用崩溃。**
*   **Logging:** Critical events, errors, and job progress should be logged clearly for debugging and monitoring purposes.
*   **Database:** Database interactions are abstracted away in the `src/controllers/jobs.mjs` file. The schema is managed via the `pnpm migrate` script.
*   **Commit Messages:** Commit messages should be clear, concise, and descriptive, explaining *what* changes were made and *why*.

---

**重要提示：** 从现在开始，所有对话将使用中文进行。

---

## Command Execution Rules

- 禁止运行 pnpm, node, pm2 命令

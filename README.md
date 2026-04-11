<div align="center">
  <h1>🛡️ AegisSight</h1>
  <p><b>Centralized Offsite Backup architecture for Linux servers.</b></p>
</div>

AegisSight is a powerful, self-hosted backup mediator that allows you to manage, schedule, and monitor direct-to-S3 (and FTP/SFTP) backups across your fleet of Linux servers from a single, beautiful dashboard.

---

## ✨ Features

- **Centralized Dashboard**: A beautiful, React-based UI to monitor the health and progress of backups across all your servers.
- **Direct-to-S3 Streaming**: Agents stream archives directly to S3/MinIO without routing traffic through the mediator, ensuring high throughput and low bandwidth costs.
- **Dynamic Agents**: Servers only need a quick one-line bash script to install their dependencies, securely connect via WebSockets, and receive their backup job schedules.
- **Live Verification**: Confirm your cloud credentials instantly from the dashboard before saving.
- **Extensible Destinations**: Out of the box support for S3/MinIO, FTP, SFTP, and SCP.

---

## 🏗️ Architecture

AegisSight is split into two main architectures:

1. **Master App (Mediator)**: The central brain. It consists of an Express.js backend (with an SQLite database) and a React/Vite frontend. It holds all destination configurations, job schedules, and receives real-time WebSocket connection tracking from agents.
2. **Agent App (Nodes)**: Lightweight Node.js scripts executed on the target Linux servers. They receive cron schedules via WebSockets from the Master App and execute `tar` / `@aws-sdk/lib-storage` streams natively.

---

## 🚀 Getting Started (Master App)

To run the mediator dashboard locally:

### 1. Start the Backend
```bash
cd master-app/backend
npm install
node server.js
```
*The backend will default to port 4000 and automatically bind a WebSocket listener.*

### 2. Start the Frontend
```bash
cd master-app/frontend
npm install
npm run dev
```
*The frontend dashboard will be available at `http://localhost:5173`.*

---

## 📡 Agent Installation

Once the Master App is running, navigate to the **Agents** tab in your dashboard. You will be provided with a dynamic `curl` bash script to run on your Linux nodes.

```bash
# Example agent deployment
curl -sL http://<your-mediator-ip>:4000/api/install.sh | bash -s -- agent-web-01
```

Once installed, the agent will immediately appear online in your AegisSight dashboard and await job scheduling.

---
*Built with React, Express, and Socket.io.*

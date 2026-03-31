# 🏓 ft_transcendence

![Video Project 3g](https://github.com/user-attachments/assets/067847b3-7001-42eb-9d83-4cc0d88537ae)

## 🕹️ Project Description

**ft_transcendence** is a full-stack multiplayer web platform centered around real-time games and social interaction.  
The main goal is to provide an online gaming experience where users can **play Pong and Tic-Tac-Toe**, interact via **live chat**, manage **friendships**, and compete using **matchmaking and game modes**, all within a secure, monitored, and containerized environment.

The project strictly follows the **42 ft_transcendence subject**, emphasizing real-time communication, user management, security, DevOps practices, and clean modular architecture.

**Key Highlights:**
- Real-time multiplayer game synchronization
- Secure authentication with OAuth 2.0 and 2FA
- Live chat and social features
- Scalable, observable, and fully containerized infrastructure

---

## 🛠️ Tech Stack & Architecture

We chose a modern, event-driven architecture to handle the high concurrency requirements of a real-time multiplayer ecosystem.

### Frontend
* **React, Vite, & Tailwind CSS:** Provides a fast, responsive Single Page Application (SPA) ensuring smooth navigation without page reloads.
* **TypeScript:** Ensures type safety, maintainability, and reduces runtime errors across the entire stack.

### Backend & Real-Time Communication
* **Node.js & Fastify:** An event-driven, non-blocking backend perfectly suited for fast REST API routing and real-time systems.
* **WebSockets (Socket.io):** Handles the high-frequency tick rate required for real-time game synchronization, live chat, and instant match invites.
* **SQLite:** A lightweight, fast database fully compliant with the ft_transcendence constraints.

### Security & DevOps
* **Authentication:** OAuth 2.0 (Third-party login) and 2FA (Two-Factor Authentication) coupled with secure password hashing to ensure credentials are never stored in plain text.
* **Docker & Docker Compose:** The entire infrastructure is containerized for isolated, reproducible, one-click deployments.
* **Monitoring Pipeline:** Centralized logging and system metrics using **Prometheus**, **Grafana**, and the **ELK Stack** (Elasticsearch, Logstash, Kibana).

---

## 🚀 Features & Contributions

### 👤 User Management & Authentication
**Implemented by: _eenassir_**

- User registration and login
- OAuth authentication
- Two-Factor Authentication (2FA)
- Secure password handling
- User profile management

![Video Project 1g](https://github.com/user-attachments/assets/7f7c7b58-033d-46e1-9a31-9979414f5a9d)

---

### 🧑‍🤝‍🧑 Friends System
**Implemented by: _msassi_**

- Add and remove friends
- Block and unblock users
- Online status visibility

---

### 💬 Online Chat & Game Invitations
**Implemented by: _msassi_**

- Real-time private messaging
- User blocking in chat
- Game invitations through chat
- Profile access from chat
- Match and tournament notifications

![Video Project 2g](https://github.com/user-attachments/assets/38795b20-8312-4215-b0f2-16680f0af6e5)

---

### 🏓 Pong Game
**Implemented by: _elel-bah_**

- Classic Pong gameplay
- Multiple game modes
- Matchmaking system
- Tournament support
- Real-time multiplayer synchronization

---

### ❌ Tic-Tac-Toe Game
**Implemented by: _ahsadik_**

- Tic-Tac-Toe gameplay
- Multiple modes
- Matchmaking system
- User game history

---

### 🎨 Frontend Layout & Styling
**Implemented by: _ahsadik_**

- Base frontend design
- Shared layout and UI structure
- Responsive styling

---

### ⚙️ DevOps & Monitoring
**Implemented by: _eenassir_**

- Dockerized deployment
- Centralized logging with Elasticsearch
- Monitoring with Prometheus
- Dashboards with Grafana

---

## ⚙️ Installation & Usage

### Prerequisites
* Docker & Docker Compose
* Make

### Setup & Execution
1. Clone the repository:
```bash
git clone https://github.com/SASSI42/ft_transcendence.git ft_transcendence
cd ft_transcendence
```
2. **Environment Variables:**  Update the `.env` file in the root directory with your specific API credentials (e.g., your OAuth credentials, database passwords, and JWT secrets).

3. Build and launch the entire microservice architecture in detached mode:
```bash
docker-compose up --build -d
```

4. Access the application via your browser at:
```text
https://localhost:3000
```
*(Note: To play across a local Wi-Fi network with another device, simply replace `localhost` with your host machine's local IPv4 address).*


## 👨‍💻 Authors

* [Mohammed Sassi](https://github.com/SASSI42)

* [Ahmed Sadik](https://github.com/42charlie)

* [EL MEHDI ENASSIRI](https://github.com/eenassir)

* [EL MOSTAFA EL BAHTOURI](https://github.com/mastax)

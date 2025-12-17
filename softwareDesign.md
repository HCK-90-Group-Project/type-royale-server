Berikut adalah revisi lengkap file `SoftwareDesign.md` yang telah disesuaikan sepenuhnya dengan konsep **Type Royale** (Gemini AI, Fireball/Shield Mechanic, dan MVP Scope).

Format ini dioptimalkan untuk tampilan preview di **VS Code** dan **GitHub**. Silakan copy-paste isinya ke file baru.

````markdown
# Type Royale - Software Design Document

**Project:** Type Royale (Group Project Phase 2)  
**Status:** Active Development (MVP Phase)  
**Team Roles:** Socket Architect, AI Engineer, Game Artist, Manager

---

## 1. Executive Summary

### 1.1 Project Overview

**Type Royale** adalah game strategi multiplayer real-time (1v1) yang menggabungkan kecepatan mengetik (_Typing Speed_) dengan manajemen sumber daya strategis. Pemain berduel sebagai penyihir yang menggunakan kata-kata mantra untuk menembakkan bola api atau memanggil perisai.

### 1.2 Core Gameplay

- **Battle Mechanic:** Pemain memiliki "Ammo" terbatas (50 kata). Tujuannya adalah menghancurkan HP Tower lawan sebelum kata-kata habis.
- **Card System:** 4 Tipe Kartu (Easy, Medium, Hard Fireball & Shield) yang membutuhkan input kata dengan tingkat kesulitan berbeda.
- **AI-Powered:** Setiap pertandingan memiliki daftar kata unik yang di-generate secara _live_ oleh **Google Gemini AI** berdasarkan topik acak.

### 1.3 Tech Stack

- **Frontend:** React 18 (Vite), Tailwind CSS, Socket.io-client.
- **Backend:** Node.js, Express, Socket.io.
- **Database:** PostgreSQL (Sequelize ORM).
- **AI Integration:** Google Gemini API (Generative AI).
- **Infrastructure:** AWS EC2, PM2, Nginx.

---

## 2. System Architecture

### 2.1 High-Level Architecture Diagram

```ascii
┌─────────────────────────────────────────────────────────────┐
│                        Client Layer                          │
│  ┌────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │  React UI  │  │ Game Context │  │ Socket.io Client │   │
│  └────────────┘  └──────┬───────┘  └─────────┬────────┘   │
└─────────────────────────┼────────────────────┼──────────────┘
                          │ (State)            │ (Events)
                          ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│                        Server Layer                          │
│  ┌──────────────────────┐      ┌─────────────────────────┐  │
│  │   Express API        │      │    Socket.io Server     │  │
│  │ (Auth & AI Gen)      │      │ (Room & Game Logic)     │  │
│  └──────────┬───────────┘      └────────────┬────────────┘  │
└─────────────┼───────────────────────────────┼───────────────┘
              │                               │
┌─────────────▼──────────────┐       ┌────────▼──────────────┐
│         Data Layer         │       │    External Service   │
│  ┌──────────────────────┐  │       │  ┌─────────────────┐  │
│  │      PostgreSQL      │  │       │  │  Google Gemini  │  │
│  │   (Users/History)    │  │       │  │       AI        │  │
│  └──────────────────────┘  │       │  └─────────────────┘  │
└────────────────────────────┘       └───────────────────────┘
```
````

---

## 3. Database Schema

### 3.1 ER Diagram (Simplified)

Karena sifatnya MVP Realtime, kita meminimalisir kompleksitas database.

#### **Users Table**

Menyimpan data akun pemain.

```javascript
{
  id: Integer (PK),
  username: String (Unique),
  email: String (Unique),
  password: String (Hashed),
  mmr: Integer (Default: 1000),
  createdAt: Timestamp
}

```

#### **MatchHistories Table**

Menyimpan riwayat pertandingan setelah game selesai.

```javascript
{
  id: Integer (PK),
  playerOneId: Integer (FK -> Users),
  playerTwoId: Integer (FK -> Users),
  winnerId: Integer (FK -> Users), // Nullable jika Draw
  duration: Integer, // Detik
  createdAt: Timestamp
}

```

---

## 4. Game Logic & Mechanics

### 4.1 Game Flow

1. **Lobby:** User membuat Room (Host) atau Join Room (Guest).
2. **Pre-Game (Server):**

- Server mendeteksi Room penuh (2/2).
- Server memanggil **Gemini API** untuk generate `wordPool`.
- Server membroadcast event `game_start` beserta data kata ke kedua client.

3. **Battle Phase (Client):**

- Pemain memilih Kartu (Easy/Medium/Hard/Shield).
- Pemain mengetik kata yang muncul.
- Jika benar -> Emit Socket Event (`send_attack` / `activate_shield`).
- HP Lawan berkurang atau Serangan tertangkis Shield.

4. **End Game:**

- Salah satu HP Tower mencapai 0.
- Server menentukan pemenang dan menyimpan ke DB.

### 4.2 Card & Damage System

| Card Type  | Difficulty (Word Length) | Damage | Function                 |
| ---------- | ------------------------ | ------ | ------------------------ |
| **EASY**   | 3 - 4 Huruf              | 10 HP  | _Spamming_ / _Poking_    |
| **MEDIUM** | 5 - 7 Huruf              | 35 HP  | Serangan standar         |
| **HARD**   | 8+ Huruf                 | 80 HP  | _Finisher_ (High Risk)   |
| **SHIELD** | Tema Defense             | 0 HP   | Menahan 1 serangan masuk |

---

## 5. API & Socket Events Specification

### 5.1 Socket Events (Realtime)

#### Client ➔ Server

- `join_room`: `{ roomId, username }`
- `send_attack`: `{ roomId, damage, type }`
- `activate_shield`: `{ roomId }`
- `player_lose`: `{ roomId }` (Dikirim saat HP klien sendiri mencapai 0)

#### Server ➔ Client

- `room_update`: `{ players: [] }` (Update list pemain di lobby)
- `game_start`: `{ words: Object, players: Array }`
- `receive_attack`: `{ damage, type }` (Memicu animasi terkena hit)
- `enemy_shield_active`: `{ }` (Memberi tahu visual shield musuh nyala)
- `match_result`: `{ winner: String }`

### 5.2 AI Service (Google Gemini)

Prompt yang digunakan untuk menghasilkan variasi kata:

```text
"Generate a JSON object with 4 arrays of English words related to 'Fantasy Battle':
1. 'easy': 20 words (3-4 letters)
2. 'medium': 15 words (5-7 letters)
3. 'hard': 10 words (8+ letters)
4. 'shield': 10 words related to protection.
Return ONLY raw JSON."

```

---

## 6. Project Structure

Struktur direktori Monorepo untuk memudahkan development.

```text
type-royale/
├── server/                 # Backend (Node.js)
│   ├── config/             # Database Config
│   ├── controllers/        # Auth & Match Controller
│   ├── helpers/            # AI Generator & Word Utils
│   ├── models/             # Sequelize Models
│   ├── app.js              # Entry Point & Socket Logic
│   └── package.json
│
└── client/                 # Frontend (Vite + React)
    ├── src/
    │   ├── context/        # GameContext (Global State)
    │   ├── pages/          # Login, Lobby, GameArena
    │   ├── components/     # UI Reusable Components
    │   ├── assets/         # Images & Sounds
    │   ├── App.jsx         # Routing
    │   └── main.jsx
    └── package.json

```

---

## 7. Deployment Strategy

### 7.1 Infrastructure Setup

- **Provider:** AWS EC2 (Ubuntu).
- **Web Server:** Nginx (Reverse Proxy).
- **Process Manager:** PM2 (Cluster Mode).

### 7.2 Nginx Configuration Block

Konfigurasi Nginx untuk mendukung WebSocket:

```nginx
location / {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
}

```

---

## 8. Testing Scenarios

1. **Latency Test:** Memastikan delay serangan antar client < 200ms.
2. **Shield Timing:** Memastikan Shield yang diaktifkan _setelah_ notifikasi serangan diterima tetap valid (reaction time).
3. **AI Fallback:** Jika kuota Gemini habis, server harus otomatis menggunakan _Hardcoded Word Pool_ agar game tidak crash.

```

```

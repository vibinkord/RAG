# RAG Bot — Website Q&A with Local LLM

RAG Bot lets you ingest any website, embed its content, and chat with it using a local LLM. The stack is split across two machines to keep AWS costs low:

- **Local machine** — runs Ollama (embedding + chat models), exposed to the internet via ngrok
- **AWS EC2** — runs the Spring Boot backend, React frontend, and PostgreSQL

---

## Architecture

```
Browser
  │
  ▼
AWS EC2  (c7i-flex.large or similar)
  ├── React Frontend  — NGINX on port 3000
  ├── Spring Boot API — port 8080
  └── PostgreSQL      — pgvector on port 5432
              │
              │  HTTPS via ngrok tunnel
              ▼
Local Machine  (your laptop)
  ├── Ollama          — port 11434
  │   ├── nomic-embed-text  (768-dim embeddings)
  │   └── qwen2.5-coder:7b        (chat / answer generation)
  └── ngrok           — tunnels :11434 to a public HTTPS URL
```

---

## Prerequisites

### Local Machine
- [Ollama](https://ollama.com/download) installed
- [ngrok](https://ngrok.com/download) installed and account created (free tier works)

### AWS EC2
- Instance: `c7i-flex.large` (2 vCPU, 4 GB RAM) or larger
- OS: Ubuntu 22.04 LTS
- Security group inbound rules:
  - Port `22` — SSH
  - Port `3000` — Frontend (open to `0.0.0.0/0`)
  - Port `8080` — Backend API (open to `0.0.0.0/0`)
- Docker and Docker Compose installed on the instance

---

## Part 1 — Local Machine Setup

Do this **before** deploying to EC2. The EC2 backend needs the ngrok URL to reach Ollama.

### Step 1 — Install and start Ollama

Download Ollama from [ollama.com/download](https://ollama.com/download) for your OS and install it.

Start the Ollama server:

```bash
ollama serve
```

Keep this terminal open. Ollama is now running on `localhost:11434`.

### Step 2 — Pull the required models

Open a new terminal and pull both models:

```bash
ollama pull nomic-embed-text
ollama pull qwen2.5-coder:7b
```

`nomic-embed-text` is small (~274 MB) and downloads quickly. `qwen2.5-coder:7b` is ~4.7 GB — it will take a few minutes depending on your connection.

Verify both are available:

```bash
ollama list
```

You should see both `nomic-embed-text` and `qwen2.5-coder:7b` listed.

### Step 3 — Expose Ollama via ngrok

Sign up at [ngrok.com](https://ngrok.com) (free) and get your auth token from the dashboard.

Authenticate ngrok (one-time setup):

```bash
ngrok config add-authtoken YOUR_AUTH_TOKEN
```

Start the tunnel:

```bash
ngrok http 11434
```

ngrok will print something like:

```
Forwarding  https://abcd-12-34-56-78.ngrok-free.app -> http://localhost:11434
```

**Copy that `https://` URL.** You will paste it into the EC2 setup in the next part.

> **Note:** On the free tier, this URL changes every time you restart ngrok. When that happens, update `docker-compose.yml` on EC2 with the new URL and restart the backend container (see [Updating the ngrok URL](#updating-the-ngrok-url)).

---

## Part 2 — AWS EC2 Setup

SSH into your EC2 instance and follow these steps.

### Step 1 — Install Docker

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
  https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
```

Add your user to the docker group so you don't need `sudo`:

```bash
sudo usermod -aG docker $USER
newgrp docker
```

Verify:

```bash
docker --version
docker compose version
```

### Step 2 — Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git
cd YOUR_REPO
```

### Step 3 — Set your ngrok URL

Open `docker-compose.yml` and replace the two placeholder URLs with the ngrok URL you copied in Part 1:

```bash
nano docker-compose.yml
```

Find these two lines (around line 34–35):

```yaml
- SPRING_AI_OLLAMA_BASE_URL=https://xxxx.ngrok-free.app
- OLLAMA_BASE_URL=https://xxxx.ngrok-free.app
```

Replace `https://xxxx.ngrok-free.app` with your actual ngrok URL. Save and exit (`Ctrl+O`, `Enter`, `Ctrl+X`).

### Step 4 — Build and start all services

```bash
docker compose up -d --build
```

This will:
1. Pull the `pgvector/pgvector:pg15` image
2. Build the Spring Boot backend JAR (takes ~2–3 minutes on first run)
3. Build the React frontend and package it into NGINX
4. Start all three containers

Watch the logs to confirm everything started:

```bash
docker compose logs -f
```

You should see the backend log `Started RagbotApplication` and no error lines.

### Step 5 — Verify the stack is healthy

```bash
docker compose ps
```

All three services (`ragbot-postgres`, `ragbot-backend`, `ragbot-frontend`) should show `healthy` or `running`.

Do a quick API smoke test:

```bash
curl http://localhost:8080/api/test/ping
```

You should get a `200 OK` response.

---

## Accessing the App

Open your browser and go to:

```
http://YOUR_EC2_PUBLIC_IP:3000
```

Replace `YOUR_EC2_PUBLIC_IP` with your EC2 instance's public IPv4 address (visible in the AWS EC2 console).

---

## Using the App

Once it's running, the workflow is:

1. **Websites tab** — Enter a URL and click Ingest. The system crawls the site, chunks the content, and generates embeddings via your local Ollama. This runs in the background; refresh the page to check status.

2. **Chat tab** — Once a website shows status `CRAWLED` and embeddings are done, select it and start chatting.

3. **Search Playground tab** — Run raw vector similarity searches against any ingested website.

4. **Evaluation tab** — Test RAG quality by comparing generated answers against expected answers.

---

## Updating the ngrok URL

On the free ngrok tier, the public URL changes each time you restart ngrok. When that happens:

**On your local machine** — restart ngrok and copy the new URL:

```bash
ngrok http 11434
```

**On EC2** — update `docker-compose.yml` with the new URL:

```bash
nano docker-compose.yml
# Replace the old ngrok URL with the new one in both OLLAMA_BASE_URL lines
```

Restart only the backend container (no need to rebuild):

```bash
docker compose restart backend
```

To avoid this hassle, upgrade to a paid ngrok plan which gives you a stable reserved domain.

---

## Troubleshooting

**Backend fails to start / can't reach Ollama**
- Make sure `ollama serve` is running on your local machine
- Make sure ngrok is running and the URL in `docker-compose.yml` matches the current ngrok URL
- Test the tunnel directly from EC2: `curl https://your-ngrok-url.ngrok-free.app/api/tags`

**Embeddings stuck / not generating**
- Ollama must have `nomic-embed-text` pulled before the backend can generate embeddings
- Run `ollama list` on your local machine to confirm

**Out of memory on EC2 (4 GB instance)**
- PostgreSQL + Spring Boot + NGINX together use ~900 MB — well within 4 GB
- Ollama runs on your local machine, so the EC2 RAM is not a concern

**Port 3000 or 8080 not reachable from browser**
- Check your EC2 security group inbound rules — both ports must be open to `0.0.0.0/0`

**docker compose up fails on build**
- First build downloads Maven dependencies and npm packages — needs internet access from EC2
- If it times out, re-run `docker compose up -d --build`

---

## Services Summary

| Service | Where it runs | Port |
|---|---|---|
| React Frontend (NGINX) | AWS EC2 | 3000 |
| Spring Boot Backend | AWS EC2 | 8080 |
| PostgreSQL + pgvector | AWS EC2 | 5432 (internal) |
| Ollama (LLM + Embeddings) | Local machine | 11434 (via ngrok) |

---

## EC2 Security Group Rules

Go to **EC2 Console → Security Groups → Select your instance's security group → Edit inbound/outbound rules**.

### Inbound Rules

| Type | Protocol | Port | Source | Purpose |
|---|---|---|---|---|
| SSH | TCP | 22 | Your IP (e.g. `203.0.113.10/32`) | SSH access to the instance |
| Custom TCP | TCP | 3000 | `0.0.0.0/0` | React frontend — accessible from browser |
| Custom TCP | TCP | 8080 | `0.0.0.0/0` | Spring Boot API — needed if you test the API directly |

> Port `5432` (PostgreSQL) does **not** need to be open. It is internal to Docker and never exposed to the internet.

> Port `8080` can be restricted to your IP only if you don't want the raw API publicly reachable. The frontend proxies all `/api/` calls through NGINX on port `3000` internally, so end users only ever hit port `3000`.

### Outbound Rules

| Type | Protocol | Port | Destination | Purpose |
|---|---|---|---|---|
| All traffic | All | All | `0.0.0.0/0` | Default AWS rule — required for Docker image pulls, package installs, and outbound HTTPS calls to the ngrok tunnel |

The default AWS outbound rule (allow all) is correct and should not be changed. The EC2 instance needs outbound internet access to:
- Pull Docker images from Docker Hub on first run
- Call the ngrok HTTPS URL to reach your local Ollama
- Crawl external websites during ingestion

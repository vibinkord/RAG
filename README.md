# RAG Bot - Retrieval-Augmented Generation & Ingestion Pipeline

RAG Bot is a Spring Boot & PostgreSQL backend application designed to automate website crawling, extract semantic content, generate sentence-bounded overlapping text chunks, and store them for downstream vector embedding generation.

## System Architecture

The ingestion and preprocessing pipeline follows a unidirectional, transaction-safe flow:

```
[Web Crawler Service]
   │
   ├── Jsoup Connection (Chrome User-Agent, Google Referrer, 10s Timeout)
   ├── Robots.txt Validation
   └── Recursive BFS Queue (Max depth 3, Max 50 pages)
   │
[Content Extractor Service]
   │
   ├── Strips noise (nav, footer, header, scripts, css, ads)
   └── Returns Title, Clean text, and Internal URLs
   │
[Atomic Database Transaction]
   │
   ├── Deletes previous crawls (cascade orphan removal of pages and chunks)
   └── Inserts new pages & flushes to PostgreSQL
   │
[Text Chunking Service]
   │
   ├── Splits page content using US BreakIterator (sentence-bounded)
   ├── Generates overlapping chunks (800 chars, 150 overlap)
   └── Saves chunks with source_url and page references
```

---

## Database Schema (PostgreSQL)

The system consists of three main entities with cascading relationships:

### 1. `websites`
Tracks registered websites, crawl status, page/chunk statistics, and creation timestamps.
* `id` (bigint, Primary Key)
* `url` (varchar(1000), Unique)
* `status` (`PENDING`, `CRAWLING`, `CRAWLED`, `FAILED`)
* `pages_crawled` (integer)
* `chunks_created` (integer)
* `created_at` (timestamp)

### 2. `pages`
Stores individual web page details scraped during crawls. Linked to `websites` via a many-to-one relationship.
* `id` (bigint, Primary Key)
* `website_id` (bigint, Foreign Key -> `websites.id`, Cascade Delete)
* `url` (varchar(1000))
* `title` (varchar(500))
* `content` (text)
* `crawled_at` (timestamp)

### 3. `chunks`
Contains the granular, split text blocks used for vector embeddings. Linked to `pages` via a many-to-one relationship.
* `id` (bigint, Primary Key)
* `page_id` (bigint, Foreign Key -> `pages.id`, Cascade Delete)
* `source_url` (varchar(1000))
* `chunk_index` (integer)
* `content` (text)
* `token_count` (integer)
* `created_at` (timestamp)

---

## Core Components & Features

### 1. Robust Asynchronous Crawler
* **Asynchronous Execution**: Uses `@Async` threads to perform multi-page crawls without blocking HTTP controllers.
* **403 Forbidden Prevention**: Uses a modern Chrome User-Agent header and a Google Referrer header to mimic browser requests.
* **Retry Engine**: Automatically retries failed page fetches (HTTP status error, timeout, or network issues) up to 3 times before skipping.
* **Data Loss Prevention**: Employs an in-memory staging crawl phase. Existing crawled pages and chunks are only replaced once the new crawl succeeds. If the crawl fails, the previous data is preserved.

### 2. Semantic Text Chunking
* **BreakIterator Splitting**: Splitting logic utilizes a US-locale `BreakIterator` to divide text at sentence boundaries.
* **Overlapping Windows**: Splits texts into chunks of up to 800 characters with a 150-character overlap, optimizing downstream retrieval quality.
* **Token Estimation**: Estimates token counts based on text length (4 characters per token approximation) to monitor context window consumption.

### 3. API Endpoints

#### Ingest Website Target
Starts an asynchronous crawl task.
* **Endpoint**: `POST /api/ingest`
* **Request Body**:
  ```json
  {
    "url": "https://example.com"
  }
  ```
* **Response Body**:
  ```json
  {
    "id": 1,
    "url": "https://example.com",
    "status": "PENDING",
    "pagesCrawled": 0,
    "chunksCreated": 0,
    "message": "Asynchronous crawling task has been successfully scheduled."
  }
  ```

#### Get Ingestion Status
Retrieves current crawling status and statistics.
* **Endpoint**: `GET /api/ingest/{websiteId}/status`
* **Response Body**:
  ```json
  {
    "id": 1,
    "url": "https://example.com",
    "status": "CRAWLED",
    "pagesCrawled": 12,
    "chunksCreated": 48,
    "message": "Current ingestion task status."
  }
  ```

---

## Logging & Auditing

The system prints detailed console trace logs at each step of the pipeline for monitoring:
* `STEP 1 - Website loaded`
* `STEP 2 - Status changed to CRAWLING`
* `STEP 3 - Base URL = https://example.com`
* `STEP 4 - Creating BFS queue`
* `STEP 5 - Robots check https://example.com`
* `STEP 6 - Robots allowed`
* `STEP 7 - Connecting https://example.com`
* `STEP 8 - Response 200`
* `STEP 9 - Extracted text length 3240`
* `STEP 10 - Page added`
* `STEP 11 - Transaction start`
* `STEP 12 - Saving 12 pages`
* `STEP 13 - Saved pages`
* `STEP 14 - Chunking start`
* `STEP 15 - Chunk count 48`
* `STEP 16 - Status changed to CRAWLED`
* `CRAWLER FATAL ERROR` (logged with stacktrace on fatal exceptions)

---

## Configuration (`application.properties`)

```properties
spring.application.name=ragbot
server.port=8080

# Database Settings
spring.datasource.url=jdbc:postgresql://localhost:5432/ragbot
spring.datasource.username=postgres
spring.datasource.password=postgres
spring.datasource.driver-class-name=org.postgresql.Driver

# JPA/Hibernate
spring.jpa.hibernate.ddl-auto=update
spring.jpa.show-sql=true
spring.jpa.properties.hibernate.format_sql=true

# SQL & Trace Logging
logging.level.org.hibernate.SQL=DEBUG
logging.level.org.hibernate.orm.jdbc.bind=TRACE
```

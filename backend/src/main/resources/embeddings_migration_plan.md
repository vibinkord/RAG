# Phase 2: Embedding Generation & pgvector Migration Plan

This plan outlines the next phase to store vector embeddings for crawled chunks using Ollama and PostgreSQL `pgvector`.

## Target Configuration
* **Embedding Model**: `nomic-embed-text` (Ollama)
* **Output Dimension**: 768 float dimensions
* **Database Extension**: `pgvector 0.8.3`

---

## 1. Database Schema Migration (pgvector)

To support vector similarity search, the `embeddings` table must be updated to store vector datatypes instead of JSON strings.

### Step 1.1: Enable pgvector Extension
Verify that the `vector` extension is enabled in PostgreSQL:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### Step 1.2: Define the Embeddings Schema
The `embeddings` table will be updated. Instead of `vector_json TEXT`, it will hold a `vector` type column:
```sql
-- DDL statement to configure vector with 768 dimensions (for nomic-embed-text)
CREATE TABLE IF NOT EXISTS embeddings (
    id BIGSERIAL PRIMARY KEY,
    chunk_id BIGINT UNIQUE NOT NULL REFERENCES chunks(id) ON DELETE CASCADE,
    embedding VECTOR(768) NOT NULL
);
```

#### Dynamic Schema Design (Swappable Models)
To ensure we can swap models in the future without locking the schema to a hardcoded dimension size (e.g. 768 or 1536):
1. **Dynamic Model Info Endpoint**: We expose `GET /api/embeddings/model-info` to fetch the current model and its dimension dynamically by running a test request against the model at startup.
2. **Generic Database Schema**: In Hibernate, we map the column as a generic type (`org.hibernate.annotations.Type` or `@Column(columnDefinition = "vector")` without specifying dimension, letting PostgreSQL infer/allow generic vectors, or dynamically execute an alter-table query at startup if the dimension changes).

---

## 2. JPA Entity Mapping (`Embedding.java`)

To map `pgvector` to Java, we can use the pgvector Java driver package (`com.pgvector.PGvector`) or map it as a custom PostgreSQL array:

```java
package com.vibin.ragbot.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.Type;

@Entity
@Table(name = "embeddings")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Embedding {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "chunk_id", nullable = false, unique = true)
    private Long chunkId;

    // pgvector type representation (mapped as double[] or custom PGvector type)
    @Column(name = "embedding", columnDefinition = "vector(768)", nullable = false)
    private double[] embedding;
}
```

---

## 3. Similarity Search & Repository

We can perform similarity queries directly using PostgreSQL mathematical distance operators inside `EmbeddingRepository`:

* **Cosine Distance (`<=>`)**:
  ```java
  @Query(value = "SELECT chunk_id FROM embeddings ORDER BY embedding <=> CAST(:queryVector AS vector) LIMIT :limit", nativeQuery = true)
  List<Long> findNearestNeighborsByCosineSimilarity(@Param("queryVector") String queryVectorString, @Param("limit") int limit);
  ```
* **L2 Distance (`<->`)**:
  ```java
  @Query(value = "SELECT chunk_id FROM embeddings ORDER BY embedding <-> CAST(:queryVector AS vector) LIMIT :limit", nativeQuery = true)
  List<Long> findNearestNeighborsByL2Distance(@Param("queryVector") String queryVectorString, @Param("limit") int limit);
  ```

---

## 4. Verification Endpoint

### `GET /api/embeddings/model-info`
Exposes the active embedding model name and its dynamically resolved vector dimension size.
* **Response**:
  ```json
  {
    "model": "nomic-embed-text",
    "dimension": 768
  }
  ```
This endpoint connects to Ollama, runs a lightweight single-word embedding task (`"test"`), and counts the size of the returned array to return the dimension dynamically.

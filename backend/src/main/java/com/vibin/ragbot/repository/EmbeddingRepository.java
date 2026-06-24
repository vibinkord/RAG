package com.vibin.ragbot.repository;

import com.vibin.ragbot.entity.Embedding;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface EmbeddingRepository extends JpaRepository<Embedding, Long> {

    boolean existsByChunkId(Long chunkId);

    Optional<Embedding> findByChunkId(Long chunkId);

    /**
     * Counts how many embeddings have been created for a given website.
     */
    @Query(value = "SELECT COUNT(e.id) FROM embeddings e " +
                   "JOIN chunks c ON e.chunk_id = c.id " +
                   "JOIN pages p ON c.page_id = p.id " +
                   "WHERE p.website_id = :websiteId", nativeQuery = true)
    long countByWebsiteId(@Param("websiteId") Long websiteId);

    /**
     * Find nearest neighbor embeddings using pgvector cosine distance.
     */
    @Query(value = "SELECT * FROM embeddings " +
                   "ORDER BY embedding <=> CAST(:queryVector AS vector) " +
                   "LIMIT :limit", nativeQuery = true)
    List<Embedding> findNearestNeighbors(@Param("queryVector") float[] queryVector, @Param("limit") int limit);
}

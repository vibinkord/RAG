package com.vibin.ragbot.repository;

import com.vibin.ragbot.entity.Embedding;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Repository
public interface EmbeddingRepository extends JpaRepository<Embedding, Long> {

    boolean existsByChunkId(Long chunkId);

    Optional<Embedding> findByChunkId(Long chunkId);

    List<Embedding> findAllByChunkIdIn(List<Long> chunkIds);

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

    /**
     * Find nearest neighbor embeddings for a specific website using pgvector cosine distance.
     */
    @Query(value = "SELECT e.* FROM embeddings e " +
                   "JOIN chunks c ON e.chunk_id = c.id " +
                   "JOIN pages p ON c.page_id = p.id " +
                   "WHERE p.website_id = :websiteId " +
                   "ORDER BY e.embedding <=> CAST(:queryVector AS vector) " +
                   "LIMIT :limit", nativeQuery = true)
    List<Embedding> findNearestNeighborsByWebsite(
            @Param("queryVector") float[] queryVector,
            @Param("websiteId") Long websiteId,
            @Param("limit") int limit);

    /**
     * Find nearest neighbor embeddings for a set of websites and an optional pageType category using pgvector cosine distance.
     */
    @Query(value = "SELECT e.* FROM embeddings e " +
                   "JOIN chunks c ON e.chunk_id = c.id " +
                   "JOIN pages p ON c.page_id = p.id " +
                   "WHERE p.website_id IN (:websiteIds) " +
                   "AND (:pageType IS NULL OR c.page_type = :pageType) " +
                   "ORDER BY e.embedding <=> CAST(:queryVector AS vector) " +
                   "LIMIT :limit", nativeQuery = true)
    List<Embedding> findNearestNeighborsByWebsitesAndPageType(
            @Param("queryVector") float[] queryVector,
            @Param("websiteIds") List<Long> websiteIds,
            @Param("pageType") String pageType,
            @Param("limit") int limit);

    /**
     * Find nearest neighbor embeddings across all websites with an optional pageType category using pgvector cosine distance.
     */
    @Query(value = "SELECT e.* FROM embeddings e " +
                   "JOIN chunks c ON e.chunk_id = c.id " +
                   "WHERE (:pageType IS NULL OR c.page_type = :pageType) " +
                   "ORDER BY e.embedding <=> CAST(:queryVector AS vector) " +
                   "LIMIT :limit", nativeQuery = true)
    List<Embedding> findNearestNeighborsAndPageType(
            @Param("queryVector") float[] queryVector,
            @Param("pageType") String pageType,
            @Param("limit") int limit);

    /**
     * Deletes all embeddings associated with pages of the given website.
     */
    @Modifying
    @Transactional
    @Query(value = "DELETE FROM embeddings WHERE chunk_id IN (" +
                   "SELECT c.id FROM chunks c " +
                   "JOIN pages p ON c.page_id = p.id " +
                   "WHERE p.website_id = :websiteId)", nativeQuery = true)
    void deleteByWebsiteId(@Param("websiteId") Long websiteId);
}

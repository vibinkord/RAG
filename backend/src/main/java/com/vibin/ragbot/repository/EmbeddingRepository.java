package com.vibin.ragbot.repository;

import com.vibin.ragbot.entity.Embedding;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface EmbeddingRepository extends JpaRepository<Embedding, Long> {
    boolean existsByChunkId(Long chunkId);
    Optional<Embedding> findByChunkId(Long chunkId);
}

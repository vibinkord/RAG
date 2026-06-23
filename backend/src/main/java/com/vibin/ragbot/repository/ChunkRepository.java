package com.vibin.ragbot.repository;

import com.vibin.ragbot.entity.Chunk;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ChunkRepository extends JpaRepository<Chunk, Long> {
    List<Chunk> findByPageId(Long pageId);
    void deleteByPageId(Long pageId);
    void deleteByPageIdIn(List<Long> pageIds);
}

package com.vibin.ragbot.repository;

import com.vibin.ragbot.entity.Chunk;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Repository
public interface ChunkRepository extends JpaRepository<Chunk, Long> {
    List<Chunk> findByPageId(Long pageId);
    void deleteByPageId(Long pageId);
    void deleteByPageIdIn(List<Long> pageIds);
    List<Chunk> findByPageWebsiteId(Long websiteId);

    @Modifying
    @Transactional
    @Query(value = "DELETE FROM chunks WHERE page_id IN (" +
                   "SELECT p.id FROM pages p " +
                   "WHERE p.website_id = :websiteId)", nativeQuery = true)
    void deleteByWebsiteId(@Param("websiteId") Long websiteId);
}

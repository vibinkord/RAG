package com.vibin.ragbot.repository;

import com.vibin.ragbot.entity.Page;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Repository
public interface PageRepository extends JpaRepository<Page, Long> {
    Optional<Page> findByUrl(String url);
    boolean existsByWebsiteIdAndUrl(Long websiteId, String url);
    List<Page> findByWebsiteId(Long websiteId);

    @Transactional
    void deleteByWebsiteId(Long websiteId);
}

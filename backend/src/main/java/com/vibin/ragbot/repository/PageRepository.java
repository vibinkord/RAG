package com.vibin.ragbot.repository;

import com.vibin.ragbot.entity.Page;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PageRepository extends JpaRepository<Page, Long> {
    boolean existsByWebsiteIdAndUrl(Long websiteId, String url);
}

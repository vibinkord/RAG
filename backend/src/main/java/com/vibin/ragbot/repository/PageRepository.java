package com.vibin.ragbot.repository;

import com.vibin.ragbot.entity.Page;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PageRepository extends JpaRepository<Page, Long> {
    boolean existsByWebsiteIdAndUrl(Long websiteId, String url);
    List<Page> findByWebsiteId(Long websiteId);
}

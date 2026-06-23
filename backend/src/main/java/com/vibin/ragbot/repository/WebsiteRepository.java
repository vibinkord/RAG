package com.vibin.ragbot.repository;

import com.vibin.ragbot.entity.Website;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface WebsiteRepository extends JpaRepository<Website, Long> {
    Optional<Website> findByUrl(String url);
}

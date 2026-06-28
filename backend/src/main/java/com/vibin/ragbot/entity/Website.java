package com.vibin.ragbot.entity;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.OneToMany;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.ToString;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "websites", indexes = {
    @Index(name = "idx_website_url", columnList = "url")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Website {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 1000)
    private String url;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private CrawlStatus status;

    @Column(name = "pages_crawled", nullable = false)
    private Integer pagesCrawled;

    @Column(name = "chunks_created", nullable = false)
    private Integer chunksCreated;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "max_pages")
    private Integer maxPages;

    @Column(name = "max_depth")
    private Integer maxDepth;

    @Column(name = "crawl_delay_ms")
    private Long crawlDelayMs;

    @Column(name = "respect_robots")
    private Boolean respectRobots;

    @Column(name = "same_domain_only")
    private Boolean sameDomainOnly;

    @Column(name = "exclude_query_parameters")
    private Boolean excludeQueryParameters;

    @Column(name = "follow_external_links")
    private Boolean followExternalLinks;

    @Column(name = "crawl_mode")
    private String crawlMode;

    @OneToMany(mappedBy = "website", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @Builder.Default
    @ToString.Exclude
    private List<Page> pages = new ArrayList<>();

    @PrePersist
    protected void onCreate() {
        if (this.createdAt == null) {
            this.createdAt = LocalDateTime.now();
        }
        if (this.pagesCrawled == null) {
            this.pagesCrawled = 0;
        }
        if (this.chunksCreated == null) {
            this.chunksCreated = 0;
        }
        if (this.status == null) {
            this.status = CrawlStatus.PENDING;
        }
    }
}

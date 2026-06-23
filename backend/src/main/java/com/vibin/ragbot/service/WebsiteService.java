package com.vibin.ragbot.service;

import com.vibin.ragbot.dto.CreateWebsiteRequest;
import com.vibin.ragbot.dto.CreateWebsiteResponse;
import com.vibin.ragbot.entity.Website;
import com.vibin.ragbot.repository.WebsiteRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class WebsiteService {

    private final WebsiteRepository websiteRepository;

    @Transactional
    public CreateWebsiteResponse createWebsite(CreateWebsiteRequest request) {
        String url = request.getUrl().trim();

        // Check if the website is already registered
        Optional<Website> existingWebsite = websiteRepository.findByUrl(url);
        if (existingWebsite.isPresent()) {
            Website website = existingWebsite.get();
            return CreateWebsiteResponse.builder()
                    .id(website.getId())
                    .url(website.getUrl())
                    .status(website.getStatus())
                    .message("Website already exists")
                    .build();
        }

        // Create new website entity with specified requirements
        Website newWebsite = Website.builder()
                .url(url)
                .status("PROCESSING")
                .pagesCrawled(0)
                .chunksCreated(0)
                .createdAt(LocalDateTime.now())
                .build();

        Website savedWebsite = websiteRepository.save(newWebsite);
        log.info("Registered new website: {}", savedWebsite.getUrl());

        return CreateWebsiteResponse.builder()
                .id(savedWebsite.getId())
                .url(savedWebsite.getUrl())
                .status(savedWebsite.getStatus())
                .message("Website successfully created")
                .build();
    }
}

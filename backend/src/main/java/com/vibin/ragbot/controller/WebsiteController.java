package com.vibin.ragbot.controller;

import com.vibin.ragbot.dto.CreateWebsiteRequest;
import com.vibin.ragbot.dto.CreateWebsiteResponse;
import com.vibin.ragbot.service.WebsiteService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/websites")
@RequiredArgsConstructor
public class WebsiteController {

    private final WebsiteService websiteService;

    @PostMapping
    public ResponseEntity<CreateWebsiteResponse> createWebsite(@Valid @RequestBody CreateWebsiteRequest request) {
        CreateWebsiteResponse response = websiteService.createWebsite(request);
        
        if ("Website already exists".equals(response.getMessage())) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(response);
        }
        
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }
}

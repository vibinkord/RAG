package com.vibin.ragbot.controller;

import com.vibin.ragbot.dto.AnswerRequest;
import com.vibin.ragbot.dto.AnswerResponse;
import com.vibin.ragbot.service.rag.RagService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/answer")
@RequiredArgsConstructor
@Slf4j
public class RagController {

    private final RagService ragService;

    @PostMapping
    public ResponseEntity<AnswerResponse> generateAnswer(@Valid @RequestBody AnswerRequest request) {
        log.info("Received request to generate answer for websiteId: {}, question: '{}'", 
                request.getWebsiteId(), request.getQuestion());
        
        AnswerResponse response = ragService.generateAnswer(request);
        return ResponseEntity.ok(response);
    }
}

package com.vibin.ragbot.controller;

import com.vibin.ragbot.dto.AnswerRequest;
import com.vibin.ragbot.dto.AnswerResponse;
import com.vibin.ragbot.dto.ChatRequest;
import com.vibin.ragbot.dto.ChatResponse;
import com.vibin.ragbot.dto.EvaluationRequest;
import com.vibin.ragbot.dto.EvaluationResponse;
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
@RequestMapping("/api")
@RequiredArgsConstructor
@Slf4j
public class RagController {

    private final RagService ragService;

    @PostMapping("/answer")
    public ResponseEntity<AnswerResponse> generateAnswer(@Valid @RequestBody AnswerRequest request) {
        log.info("Received request to generate answer for websiteId: {}, question: '{}'", 
                request.getWebsiteId(), request.getQuestion());
        
        AnswerResponse response = ragService.generateAnswer(request);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/chat")
    public ResponseEntity<ChatResponse> chat(@Valid @RequestBody ChatRequest request) {
        log.info("Received chat request for session: {}, message: '{}'", 
                request.getSessionId(), request.getMessage());
        
        ChatResponse response = ragService.chat(request);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/evaluate")
    public ResponseEntity<EvaluationResponse> evaluate(@Valid @RequestBody EvaluationRequest request) {
        log.info("Received evaluation request for question: '{}'", request.getQuestion());
        
        EvaluationResponse response = ragService.evaluate(request);
        return ResponseEntity.ok(response);
    }
}

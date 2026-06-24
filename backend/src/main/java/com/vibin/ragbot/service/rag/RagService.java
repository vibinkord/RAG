package com.vibin.ragbot.service.rag;

import com.vibin.ragbot.dto.AnswerRequest;
import com.vibin.ragbot.dto.AnswerResponse;
import com.vibin.ragbot.dto.ChatRequest;
import com.vibin.ragbot.dto.ChatResponse;
import com.vibin.ragbot.dto.EvaluationRequest;
import com.vibin.ragbot.dto.EvaluationResponse;

public interface RagService {
    AnswerResponse generateAnswer(AnswerRequest request);
    ChatResponse chat(ChatRequest request);
    EvaluationResponse evaluate(EvaluationRequest request);
}

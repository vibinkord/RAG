package com.vibin.ragbot.service.rag;

import com.vibin.ragbot.dto.AnswerRequest;
import com.vibin.ragbot.dto.AnswerResponse;

public interface RagService {
    AnswerResponse generateAnswer(AnswerRequest request);
}

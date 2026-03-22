package com.example.CityPortal.venue.services.impls;

import com.example.CityPortal.venue.models.Venue;
import com.example.CityPortal.venue.models.VenueReview;
import com.example.CityPortal.venue.models.VenueSummary;
import com.example.CityPortal.venue.repository.VenueSummaryRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class VenueSummarizationService {
    private final VenueSummaryRepository venueSummaryRepository;

    @Value("${openrouter.api-key:}")
    private String openrouterApiKey;

    @Value("${groq.api-key:}")
    private String groqApiKey;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private final RestClient openrouterClient = RestClient.builder()
        .baseUrl("https://openrouter.ai")
        .build();

    private final RestClient groqClient = RestClient.builder()
        .baseUrl("https://api.groq.com")
        .build();

    private static final List<String> FREE_MODELS = List.of(
        "google/gemma-3-4b-it:free",
        "mistralai/mistral-7b-instruct:free",
        "qwen/qwen-2.5-7b-instruct:free",
        "meta-llama/llama-3.2-3b-instruct:free",
        "meta-llama/llama-3.1-8b-instruct:free",
        "deepseek/deepseek-r1-distill-llama-70b:free",
        "microsoft/phi-3-mini-128k-instruct:free",
        "nousresearch/hermes-3-llama-3.1-405b:free",
        "openchat/openchat-7b:free"
    );

    private static final List<String> GROQ_MODELS = List.of(
        "llama-3.1-8b-instant",
        "llama-3.3-70b-versatile",
        "llama-3.1-70b-versatile",
        "llama3-groq-8b-8192-tool-use-preview"
    );

    private static final int MAX_RETRIES_429 = 3;
    private static final long RETRY_DELAY_MS  = 8_000;

    // Меньше отзывов в чанке = меньше токенов = меньше шансов словить rate limit
    private static final int CHUNK_SIZE = 15;

    @Transactional
    public String summarizeAndSave(Venue venue, List<VenueReview> allReviews) {
        if (allReviews == null || allReviews.isEmpty())
            return getLatestSummary(venue.getId());
        if ((openrouterApiKey == null || openrouterApiKey.isBlank()) &&
            (groqApiKey == null || groqApiKey.isBlank())) {
            log.warn("Ни один API ключ (OpenRouter / Groq) не настроен, суммаризация недоступна");
            return getLatestSummary(venue.getId());
        }

        Optional<Long> lastIdOpt = venueSummaryRepository.findLastReviewIdByVenueId(venue.getId());
        long lastProcessedId = lastIdOpt.orElse(0L);

        List<VenueReview> newReviews = allReviews.stream()
            .filter(r -> r.getId() != null && r.getId() > lastProcessedId)
            .filter(r -> r.getText() != null && r.getText().trim().split("\\s+").length >= 5)
            .distinct()
            .toList();

        if (newReviews.isEmpty()) {
            log.info("Нет новых отзывов для суммаризации (venue id={})", venue.getId());
            return getLatestSummary(venue.getId());
        }

        log.info("Суммаризируем {} новых отзывов для venue id={}", newReviews.size(), venue.getId());

        List<String> newTexts = newReviews.stream().map(VenueReview::getText).toList();
        String newSummary = summarizeChunks(newTexts);
        if (newSummary == null) {
            log.warn("Не удалось суммаризировать новые отзывы (venue id={})", venue.getId());
            return getLatestSummary(venue.getId());
        }

        Optional<VenueSummary> prevOpt = venueSummaryRepository.findTopByVenueIdOrderByCreatedAtDesc(venue.getId());
        String finalSummary;
        if (prevOpt.isPresent()) {
            String prevSummary = prevOpt.get().getFinalSummary();
            log.info("Объединяем с предыдущей суммаризацией (venue id={})", venue.getId());
            String mergedPrompt = "Ты — помощник, который пишет описания заведений. " +
                "У тебя есть два текста — описание заведения на основе прошлых отзывов и описание на основе новых отзывов. " +
                "Объедини их в единый связный текст (3-5 предложений) на русском языке от третьего лица. " +
                "Опиши общее впечатление: атмосферу, кухню, обслуживание, плюсы и минусы. " +
                "НЕ упоминай количество отзывов, НЕ цитируй фразы, пиши своими словами. " +
                "Только готовый текст, без вступлений.\n\n" +
                "Прошлое описание:\n" + prevSummary + "\n\n" +
                "Новое описание:\n" + newSummary;
            String merged = callAI(mergedPrompt);
            finalSummary = merged != null ? merged : newSummary;
        }
        else {
            finalSummary = newSummary;
        }

        long maxReviewId = newReviews.stream()
            .mapToLong(VenueReview::getId)
            .max()
            .orElse(lastProcessedId);

        VenueSummary round = new VenueSummary();
        round.setVenue(venue);
        round.setFinalSummary(finalSummary);
        round.setReviewsCount(newReviews.size());
        round.setLastReviewId(maxReviewId);
        round.setCreatedAt(LocalDateTime.now());
        venueSummaryRepository.save(round);

        log.info("Новый раунд суммаризации сохранён (venue id={}, отзывов={})", venue.getId(), newReviews.size());
        return finalSummary;
    }

    public String getLatestSummary(Long venueId) {
        return venueSummaryRepository
            .findTopByVenueIdOrderByCreatedAtDesc(venueId)
            .map(VenueSummary::getFinalSummary)
            .orElse(null);
    }

    /**
     * Принудительно запускает суммаризацию всех отзывов заведения,
     * игнорируя previousLastReviewId (сбрасывает, чтобы обработать заново).
     */
    @Transactional
    public String forceSummarize(Venue venue, List<VenueReview> allReviews) {
        if (allReviews == null || allReviews.isEmpty()) {
            log.warn("Нет отзывов для принудительной суммаризации (venue id={})", venue.getId());
            return getLatestSummary(venue.getId());
        }
        if ((openrouterApiKey == null || openrouterApiKey.isBlank()) &&
            (groqApiKey == null || groqApiKey.isBlank())) {
            log.warn("Ни один API ключ не настроен, принудительная суммаризация недоступна");
            return getLatestSummary(venue.getId());
        }

        List<VenueReview> reviews = allReviews.stream()
            .filter(r -> r.getText() != null && r.getText().trim().split("\\s+").length >= 5)
            .distinct()
            .toList();

        if (reviews.isEmpty()) {
            log.warn("После фильтрации нет подходящих отзывов (venue id={})", venue.getId());
            return getLatestSummary(venue.getId());
        }

        log.info("Принудительная суммаризация {} отзывов для venue id={}", reviews.size(), venue.getId());

        List<String> texts = reviews.stream().map(VenueReview::getText).toList();
        String summary = summarizeChunks(texts);
        if (summary == null) {
            log.warn("Принудительная суммаризация не удалась (venue id={})", venue.getId());
            return getLatestSummary(venue.getId());
        }

        long maxReviewId = reviews.stream().mapToLong(VenueReview::getId).max().orElse(0L);

        VenueSummary round = new VenueSummary();
        round.setVenue(venue);
        round.setFinalSummary(summary);
        round.setReviewsCount(reviews.size());
        round.setLastReviewId(maxReviewId);
        round.setCreatedAt(LocalDateTime.now());
        venueSummaryRepository.save(round);

        log.info("Принудительная суммаризация сохранена (venue id={})", venue.getId());
        return summary;
    }

    private String summarizeChunks(List<String> texts) {
        List<List<String>> chunks = new ArrayList<>();
        for (int i = 0; i < texts.size(); i += CHUNK_SIZE) {
            chunks.add(texts.subList(i, Math.min(i + CHUNK_SIZE, texts.size())));
        }

        List<String> chunkSummaries = new ArrayList<>();
        for (int i = 0; i < chunks.size(); i++) {
            String chunkText = String.join("\n---\n", chunks.get(i));
            String prompt = "Ты — помощник, который анализирует отзывы о заведениях. " +
                "На основе отзывов ниже напиши короткий связный текст (2-3 предложения) от третьего лица на русском языке. " +
                "Опиши атмосферу, кухню, обслуживание — только то, что упоминают посетители. " +
                "НЕ цитируй отзывы, НЕ перечисляй их, НЕ упоминай количество отзывов. " +
                "Пиши своими словами как редактор, только готовый текст без вступлений и пояснений.\n\n" +
                "Отзывы:\n" + chunkText;
            String summary = callAI(prompt);
            if (summary != null) {
                log.info("Чанк {}/{} суммаризирован", i + 1, chunks.size());
                chunkSummaries.add(summary);
            }
        }

        if (chunkSummaries.isEmpty())
            return null;
        if (chunkSummaries.size() == 1)
            return chunkSummaries.get(0);

        String allChunks = String.join("\n\n", chunkSummaries);
        String finalPrompt = "Ты — помощник, который пишет описания заведений. " +
            "На основе нескольких частичных описаний ниже напиши единый связный текст (3-5 предложений) на русском языке от третьего лица. " +
            "Опиши общее впечатление посетителей: атмосферу, кухню, обслуживание, плюсы и минусы. " +
            "НЕ упоминай количество отзывов, НЕ цитируй фразы, пиши своими словами. " +
            "Только готовый текст, без вступлений.\n\n" +
            "Части:\n" + allChunks;
        String finalSummary = callAI(finalPrompt);
        return finalSummary != null ? finalSummary : chunkSummaries.get(0);
    }

    private String callAI(String prompt) {
        if (openrouterApiKey != null && !openrouterApiKey.isBlank()) {
            String result = callOpenRouter(prompt);
            if (result != null)
                return result;
            log.warn("OpenRouter недоступен, переключаемся на Groq...");
        }

        if (groqApiKey != null && !groqApiKey.isBlank()) {
            String result = callGroq(prompt);
            if (result != null)
                return result;
            log.error("Groq тоже недоступен. Суммаризация невозможна.");
        }

        return null;
    }

    private String callOpenRouter(String prompt) {
        for (String model : FREE_MODELS) {
            String result = callOpenRouterWithModel(prompt, model);
            if (result != null)
                return result;
            sleep(300);
        }
        log.error("Все бесплатные модели OpenRouter недоступны");
        return null;
    }

    private String callOpenRouterWithModel(String prompt, String model) {
        for (int attempt = 1; attempt <= MAX_RETRIES_429; attempt++) {
            try {
                Map<String, Object> requestBody = Map.of(
                    "model", model,
                    "messages", List.of(Map.of("role", "user", "content", prompt)),
                    "max_tokens", 512
                );

                String responseStr = openrouterClient.post()
                    .uri("/api/v1/chat/completions")
                    .header("Authorization", "Bearer " + openrouterApiKey)
                    .header("HTTP-Referer", "https://cityportal.local")
                    .header("X-Title", "CityPortal")
                    .header("Accept", "application/json")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(requestBody)
                    .retrieve()
                    .onStatus(status -> status.is4xxClientError() || status.is5xxServerError(),
                        (req, resp) -> {
                            // не бросаем исключение — читаем тело ниже
                        })
                    .body(String.class);

                if (responseStr == null || responseStr.isBlank()) {
                    log.warn("OpenRouter модель {} вернула пустой ответ", model);
                    break;
                }

                JsonNode root = objectMapper.readTree(responseStr);

                // OpenRouter иногда возвращает {"error": {...}} с HTTP 200 или 4xx
                if (root.has("error")) {
                    String errMsg = root.path("error").path("message").asText("");
                    int errStatus = root.path("error").path("code").asInt(0);
                    boolean rateLimited = errMsg.contains("rate") || errMsg.contains("429") || errStatus == 429;
                    if (rateLimited && attempt < MAX_RETRIES_429) {
                        log.warn("OpenRouter модель {} — rate limit в ответе, ждём {}мс (попытка {}/{})", model, RETRY_DELAY_MS, attempt, MAX_RETRIES_429);
                        sleep(RETRY_DELAY_MS);
                        continue;
                    }
                    log.warn("OpenRouter модель {} вернула ошибку: {}", model, errMsg);
                    break;
                }

                JsonNode text = root.path("choices").get(0).path("message").path("content");
                if (!text.isMissingNode() && !text.asText().isBlank()) {
                    log.info("Суммаризация через OpenRouter модель: {}", model);
                    return text.asText().trim();
                }
                log.warn("OpenRouter модель {} — пустой content в ответе", model);
                break;
            }
            catch (Exception e) {
                String msg = e.getMessage() != null ? e.getMessage() : "";
                boolean is429 = msg.contains("429") || msg.contains("rate");
                boolean isFatal = msg.contains("404") || msg.contains("upstream");

                if (is429 && attempt < MAX_RETRIES_429) {
                    log.warn("OpenRouter модель {} — 429, ждём {}мс (попытка {}/{})", model, RETRY_DELAY_MS, attempt, MAX_RETRIES_429);
                    sleep(RETRY_DELAY_MS);
                }
                else if (is429 || isFatal) {
                    log.warn("OpenRouter модель {} недоступна, пробуем следующую...", model);
                    break;
                }
                else {
                    log.error("Ошибка OpenRouter ({}): {}", model, msg);
                    break;
                }
            }
        }
        return null;
    }

    private String callGroq(String prompt) {
        for (String model : GROQ_MODELS) {
            String result = callGroqWithModel(prompt, model);
            if (result != null)
                return result;
            sleep(500);
        }
        log.error("Все модели Groq недоступны");
        return null;
    }

    private String callGroqWithModel(String prompt, String model) {
        for (int attempt = 1; attempt <= MAX_RETRIES_429; attempt++) {
            try {
                Map<String, Object> requestBody = Map.of(
                    "model", model,
                    "messages", List.of(Map.of("role", "user", "content", prompt)),
                    "max_tokens", 512
                );

                String responseStr = groqClient.post()
                    .uri("/openai/v1/chat/completions")
                    .header("Authorization", "Bearer " + groqApiKey)
                    .header("Accept", "application/json")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(requestBody)
                    .retrieve()
                    .onStatus(status -> status.is4xxClientError() || status.is5xxServerError(),
                        (req, resp) -> {
                            // не бросаем исключение — читаем тело ниже
                        })
                    .body(String.class);

                if (responseStr == null || responseStr.isBlank()) {
                    log.warn("Groq модель {} вернула пустой ответ, пробуем следующую...", model);
                    break;
                }

                JsonNode root = objectMapper.readTree(responseStr);

                // Groq может вернуть {"error": {...}} с HTTP 200 или 4xx
                if (root.has("error")) {
                    String errMsg = root.path("error").path("message").asText("");
                    String errCode = root.path("error").path("code").asText("");
                    boolean decommissioned = errCode.contains("decommissioned") || errMsg.contains("decommissioned");
                    boolean rateLimited = errMsg.contains("rate") || errMsg.contains("429") || errCode.contains("rate");
                    if (rateLimited && attempt < MAX_RETRIES_429) {
                        log.warn("Groq модель {} — rate limit в ответе, ждём {}мс (попытка {}/{})", model, RETRY_DELAY_MS, attempt, MAX_RETRIES_429);
                        sleep(RETRY_DELAY_MS);
                        continue;
                    }
                    if (decommissioned) {
                        log.warn("Groq модель {} устарела (decommissioned), пробуем следующую...", model);
                    } else {
                        log.warn("Groq модель {} вернула ошибку: {}", model, errMsg);
                    }
                    break;
                }

                JsonNode text = root.path("choices").get(0).path("message").path("content");
                if (!text.isMissingNode() && !text.asText().isBlank()) {
                    log.info("Суммаризация через Groq модель: {}", model);
                    return text.asText().trim();
                }
                log.warn("Groq модель {} — пустой content в ответе", model);
                break;
            }
            catch (Exception e) {
                String msg = e.getMessage() != null ? e.getMessage() : "";
                boolean is429 = msg.contains("429") || msg.contains("rate");
                boolean isDecommissioned = msg.contains("decommissioned") || msg.contains("model_decommissioned");

                if (is429 && attempt < MAX_RETRIES_429) {
                    log.warn("Groq модель {} — 429, ждём {}мс (попытка {}/{})", model, RETRY_DELAY_MS, attempt, MAX_RETRIES_429);
                    sleep(RETRY_DELAY_MS);
                }
                else if (is429 || isDecommissioned || msg.contains("404")) {
                    log.warn("Groq модель {} недоступна, пробуем следующую...", model);
                    break;
                }
                else {
                    log.error("Ошибка Groq ({}): {}", model, msg);
                    break;
                }
            }
        }
        return null;
    }

    private void sleep(long ms) {
        try {
            Thread.sleep(ms);
        }
        catch (InterruptedException ignored) {
            Thread.currentThread().interrupt();
        }
    }
}
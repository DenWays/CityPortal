package com.example.CityPortal.afisha.config;

import com.example.CityPortal.afisha.services.AfishaService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.Scheduled;

@Slf4j
@Configuration
@RequiredArgsConstructor
@ConditionalOnProperty(name = "afisha.parser.enabled", havingValue = "true", matchIfMissing = true)
public class AfishaSchedulerConfig {

    private final AfishaService afishaService;

    @Scheduled(initialDelayString = "${afisha.parser.initial-delay-ms:30000}",
                        fixedDelayString   = "${afisha.parser.interval-ms:3600000}")
    public void scheduledFetch() {
        log.info("Запуск планового парсинга афиши (upsert)...");
        try {
            int saved = afishaService.fetchAndSave();
            log.info("Плановый парсинг афиши завершён, новых/обновлённых: {}", saved);
        }
        catch (Exception e) {
            log.error("Ошибка планового парсинга афиши: {}", e.getMessage(), e);
        }
    }
}
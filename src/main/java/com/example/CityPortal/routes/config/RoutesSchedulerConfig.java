package com.example.CityPortal.routes.config;

import com.example.CityPortal.routes.services.RouteService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.Scheduled;

@Slf4j
@Configuration
@RequiredArgsConstructor
@ConditionalOnProperty(name = "routes.parser.enabled", havingValue = "true", matchIfMissing = true)
public class RoutesSchedulerConfig {
    private final RouteService routeService;

    @Scheduled(initialDelayString = "${routes.parser.initial-delay-ms:60000}",
                        fixedDelayString   = "${routes.parser.interval-ms:86400000}")
    public void scheduledFetch() {
        log.info("Запуск планового парсинга маршрутов...");
        try {
            int saved = routeService.fetchAndSave();
            log.info("Плановый парсинг маршрутов завершён, новых/обновлённых: {}", saved);
        }
        catch (Exception e) {
            log.error("Ошибка планового парсинга маршрутов: {}", e.getMessage(), e);
        }
    }
}
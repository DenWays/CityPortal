package com.example.CityPortal.news.config;

import com.example.CityPortal.news.services.NewsService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;

@Slf4j
@Configuration
@EnableScheduling
@RequiredArgsConstructor
public class NewsSchedulerConfig {
    private final NewsService newsService;

    @Scheduled(fixedDelayString = "${news.parser.interval-ms:1800000}", initialDelayString = "${news.parser.initial-delay-ms:5000}")
    public void scheduledFetch() {
        log.info("Запускаем плановый парсинг новостей с orenburg.ru...");
        int count = newsService.fetchAndSave();
        log.info("Плановый парсинг завершён, добавлено новостей: {}", count);
    }
}
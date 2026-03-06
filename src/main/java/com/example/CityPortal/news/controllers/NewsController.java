package com.example.CityPortal.news.controllers;

import com.example.CityPortal.news.dtos.NewsDetailDto;
import com.example.CityPortal.news.dtos.NewsDto;
import com.example.CityPortal.news.services.NewsService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/api/news")
@RequiredArgsConstructor
public class NewsController {

    private final NewsService newsService;

    @GetMapping
    public Page<NewsDto> getNews(@RequestParam(defaultValue = "0")  int page,
                                                        @RequestParam(defaultValue = "10") int size,
                                                        @RequestParam(required = false) String title,
                                                        @RequestParam(required = false) String date) {
        Pageable pageable = PageRequest.of(page, Math.min(size, 50));
        boolean hasFilter = (title != null && !title.isBlank()) || (date != null && !date.isBlank());
        if (hasFilter) {
            return newsService.search(title, date, pageable);
        }
        return newsService.getAll(pageable);
    }

    @GetMapping("/{id}")
    public NewsDetailDto getNews(@PathVariable Long id) {
        return newsService.getById(id);
    }

    @PostMapping("/fetch")
    public ResponseEntity<Map<String, Object>> fetchNow() {
        int saved = newsService.fetchAndSave();
        return ResponseEntity.ok(Map.of("saved", saved));
    }
}
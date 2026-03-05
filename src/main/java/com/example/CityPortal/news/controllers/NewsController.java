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
                                                        @RequestParam(defaultValue = "10") int size) {
        Pageable pageable = PageRequest.of(page, Math.min(size, 50));
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
package com.example.CityPortal.news.services;

import com.example.CityPortal.news.dtos.NewsDetailDto;
import com.example.CityPortal.news.dtos.NewsDto;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface NewsService {
    int fetchAndSave();
    Page<NewsDto> getAll(Pageable pageable);
    NewsDetailDto getById(Long id);
}
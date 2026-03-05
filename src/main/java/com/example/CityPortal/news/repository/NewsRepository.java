package com.example.CityPortal.news.repository;

import com.example.CityPortal.news.models.News;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NewsRepository extends JpaRepository<News, Long> {
    boolean existsBySourceUrl(String sourceUrl);
    Page<News> findAllByOrderByPublishedAtDesc(Pageable pageable);
}
package com.example.CityPortal.news.repository;

import com.example.CityPortal.news.models.News;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;

public interface NewsRepository extends JpaRepository<News, Long> {
    boolean existsBySourceUrl(String sourceUrl);
    Page<News> findAllByOrderByPublishedAtDesc(Pageable pageable);

    @Query(value = "SELECT * FROM news n WHERE " +
           "(CAST(:title AS text) IS NULL OR LOWER(n.title) LIKE LOWER(CONCAT('%', CAST(:title AS text), '%'))) AND " +
           "(CAST(:from AS timestamp) IS NULL OR n.published_at >= CAST(:from AS timestamp)) AND " +
           "(CAST(:to AS timestamp) IS NULL OR n.published_at < CAST(:to AS timestamp)) " +
           "ORDER BY n.published_at DESC",
           countQuery = "SELECT COUNT(*) FROM news n WHERE " +
           "(CAST(:title AS text) IS NULL OR LOWER(n.title) LIKE LOWER(CONCAT('%', CAST(:title AS text), '%'))) AND " +
           "(CAST(:from AS timestamp) IS NULL OR n.published_at >= CAST(:from AS timestamp)) AND " +
           "(CAST(:to AS timestamp) IS NULL OR n.published_at < CAST(:to AS timestamp))",
           nativeQuery = true)
    Page<News> search(@Param("title") String title,
                      @Param("from") LocalDateTime from,
                      @Param("to") LocalDateTime to,
                      Pageable pageable);
}
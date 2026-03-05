package com.example.CityPortal.news.models;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "news")
public class News {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "title", nullable = false, length = 512)
    private String title;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "content", columnDefinition = "TEXT")
    private String content;

    @Column(name = "image_url", length = 1024)
    private String imageUrl;

    @Column(name = "source_url", length = 1024, unique = true)
    private String sourceUrl;

    @Column(name = "published_at")
    private LocalDateTime publishedAt;

    @Column(name = "parsed_at")
    private LocalDateTime parsedAt;
}
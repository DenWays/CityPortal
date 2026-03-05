package com.example.CityPortal.news.dtos;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.Data;
import java.time.LocalDateTime;

@Data
public class NewsDto {
    private Long id;
    private String title;
    private String description;
    private String imageUrl;
    private String sourceUrl;

    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime publishedAt;
}
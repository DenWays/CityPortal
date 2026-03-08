package com.example.CityPortal.afisha.models;

import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "event")
public class Event {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "title", nullable = false, length = 512)
    private String title;

    @Column(name = "venue", length = 512)
    private String venue;

    @Column(name = "price", length = 256)
    private String price;

    @Column(name = "image_url", length = 1024)
    private String imageUrl;

    @Column(name = "source_url", length = 1024, unique = true)
    private String sourceUrl;

    @Column(name = "event_date")
    private LocalDate eventDate;

    @Column(name = "parsed_at")
    private LocalDateTime parsedAt;
}
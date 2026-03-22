package com.example.CityPortal.venue.models;

import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "venue")
public class Venue {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "name", nullable = false, length = 512)
    private String name;

    @Column(name = "address", length = 512)
    private String address;

    @Column(name = "phone", length = 128)
    private String phone;

    @Column(name = "rating", length = 32)
    private String rating;

    @Column(name = "category", length = 256)
    private String category;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "latitude")
    private Double latitude;

    @Column(name = "longitude")
    private Double longitude;

    @Column(name = "yandex_url", length = 1024)
    private String yandexUrl;


    @Column(name = "scraped_at")
    private LocalDateTime scrapedAt;
}
package com.example.CityPortal.routes.models;

import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "route")
public class Route {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "title", nullable = false, length = 512)
    private String title;

    @Column(name = "operator_name", length = 512)
    private String operatorName;

    @Column(name = "duration", length = 256)
    private String duration;

    @Column(name = "image_url", length = 1024)
    private String imageUrl;

    @Column(name = "source_url", length = 1024, unique = true)
    private String sourceUrl;

    @Column(name = "route_type", length = 64)
    private String routeType;

    @Column(name = "parsed_at")
    private LocalDateTime parsedAt;
}
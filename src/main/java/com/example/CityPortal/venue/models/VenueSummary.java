package com.example.CityPortal.venue.models;

import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "venue_summary")
public class VenueSummary {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "venue_id", nullable = false)
    private Venue venue;

    @Column(name = "final_summary", columnDefinition = "TEXT", nullable = false)
    private String finalSummary;

    @Column(name = "reviews_count")
    private Integer reviewsCount;

    @Column(name = "last_review_id")
    private Long lastReviewId;

    @Column(name = "created_at")
    private LocalDateTime createdAt;
}
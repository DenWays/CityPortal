package com.example.CityPortal.venue.models;

import jakarta.persistence.*;
import lombok.Data;

@Data
@Entity
@Table(name = "venue_review")
public class VenueReview {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "venue_id", nullable = false)
    private Venue venue;

    @Column(name = "author", length = 256)
    private String author;

    @Column(name = "rating", length = 16)
    private String rating;

    @Column(name = "text", columnDefinition = "TEXT")
    private String text;

    @Column(name = "review_date", length = 64)
    private String reviewDate;
}
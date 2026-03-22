package com.example.CityPortal.venue.repository;

import com.example.CityPortal.venue.models.VenueSummary;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;

public interface VenueSummaryRepository extends JpaRepository<VenueSummary, Long> {
    Optional<VenueSummary> findTopByVenueIdOrderByCreatedAtDesc(Long venueId);
    boolean existsByVenueId(Long venueId);

    @Query("SELECT s.lastReviewId FROM VenueSummary s WHERE s.venue.id = :venueId ORDER BY s.createdAt DESC LIMIT 1")
    Optional<Long> findLastReviewIdByVenueId(Long venueId);
}
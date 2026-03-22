package com.example.CityPortal.venue.repository;

import com.example.CityPortal.venue.models.VenueReview;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

public interface VenueReviewRepository extends JpaRepository<VenueReview, Long> {
    List<VenueReview> findByVenueId(Long venueId);

    @Transactional
    void deleteByVenueId(Long venueId);

    @Modifying
    @Transactional
    @Query("DELETE FROM VenueReview r WHERE LOWER(r.text) LIKE '%знаток города%' " +
           "OR LOWER(r.text) LIKE '%знаток местных мест%'")
    int deleteJunkReviews();
}
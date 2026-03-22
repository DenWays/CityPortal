package com.example.CityPortal.venue.repository;

import com.example.CityPortal.venue.models.Venue;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

public interface VenueRepository extends JpaRepository<Venue, Long> {
    Optional<Venue> findByLatitudeAndLongitude(Double latitude, Double longitude);

    @Query("SELECT v FROM Venue v WHERE LOWER(v.name) = LOWER(:name) AND LOWER(v.address) = LOWER(:address)")
    Optional<Venue> findByNameAndAddress(String name, String address);

    @Query("SELECT v FROM Venue v WHERE LOWER(v.name) = LOWER(:name)")
    Optional<Venue> findByNameOnly(String name);

    @Query("SELECT v.id FROM Venue v WHERE LOWER(v.name) LIKE '%подтвердите%' " +
            "OR LOWER(v.name) LIKE '%робот%' OR LOWER(v.name) LIKE '%captcha%'")
    List<Long> findCaptchaVenueIds();

    @Modifying
    @Transactional
    @Query("DELETE FROM Venue v WHERE LOWER(v.name) LIKE '%подтвердите%' " +
            "OR LOWER(v.name) LIKE '%робот%' OR LOWER(v.name) LIKE '%captcha%'")
    int deleteCaptchaVenues();
}
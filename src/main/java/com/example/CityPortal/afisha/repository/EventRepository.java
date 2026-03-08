package com.example.CityPortal.afisha.repository;

import com.example.CityPortal.afisha.models.Event;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;

import java.util.Optional;

public interface EventRepository extends JpaRepository<Event, Long> {
    boolean existsBySourceUrl(String sourceUrl);
    Optional<Event> findBySourceUrl(String sourceUrl);
    Page<Event> findAllByOrderByEventDateAsc(Pageable pageable);
    Page<Event> findAllByEventDateGreaterThanEqualOrderByEventDateAsc(LocalDate date, Pageable pageable);

    @Query(value = "SELECT * FROM event e WHERE " +
           "(CAST(:title AS text) IS NULL OR LOWER(e.title) LIKE LOWER(CONCAT('%', CAST(:title AS text), '%'))) AND " +
           "(CAST(:from AS date) IS NULL OR e.event_date >= CAST(:from AS date)) AND " +
           "(CAST(:to AS date) IS NULL OR e.event_date <= CAST(:to AS date)) " +
           "ORDER BY e.event_date ASC",
           countQuery = "SELECT COUNT(*) FROM event e WHERE " +
           "(CAST(:title AS text) IS NULL OR LOWER(e.title) LIKE LOWER(CONCAT('%', CAST(:title AS text), '%'))) AND " +
           "(CAST(:from AS date) IS NULL OR e.event_date >= CAST(:from AS date)) AND " +
           "(CAST(:to AS date) IS NULL OR e.event_date <= CAST(:to AS date))",
           nativeQuery = true)
    Page<Event> search(@Param("title") String title,
                                    @Param("from") LocalDate from,
                                    @Param("to") LocalDate to,
                                    Pageable pageable);
}


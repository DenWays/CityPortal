package com.example.CityPortal.routes.repository;

import com.example.CityPortal.routes.models.Route;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.Optional;

public interface RouteRepository extends JpaRepository<Route, Long> {
    Optional<Route> findBySourceUrl(String sourceUrl);
    Page<Route> findAllByOrderByIdDesc(Pageable pageable);

    @Query(value = "SELECT * FROM route r ORDER BY RANDOM()",
           countQuery = "SELECT COUNT(*) FROM route r",
           nativeQuery = true)
    Page<Route> findAllRandom(Pageable pageable);

    @Query(value = "SELECT * FROM route r WHERE " +
           "(CAST(:title AS text) IS NULL OR LOWER(r.title) LIKE LOWER(CONCAT('%', CAST(:title AS text), '%'))) AND " +
           "(:types IS NULL OR r.route_type IN (:types)) " +
           "ORDER BY RANDOM()",
           countQuery = "SELECT COUNT(*) FROM route r WHERE " +
           "(CAST(:title AS text) IS NULL OR LOWER(r.title) LIKE LOWER(CONCAT('%', CAST(:title AS text), '%'))) AND " +
           "(:types IS NULL OR r.route_type IN (:types))",
           nativeQuery = true)
    Page<Route> search(@Param("title") String title,
                                    @Param("types") Collection<String> types,
                                    Pageable pageable);
}
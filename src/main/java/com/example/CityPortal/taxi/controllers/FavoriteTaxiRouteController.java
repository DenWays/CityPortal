package com.example.CityPortal.taxi.controllers;

import com.example.CityPortal.auth.config.CustomUserDetails;
import com.example.CityPortal.taxi.models.FavoriteTaxiRoute;
import com.example.CityPortal.taxi.services.FavoriteTaxiRouteService;
import lombok.AllArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/taxi/favorites")
@AllArgsConstructor
public class FavoriteTaxiRouteController {
    private final FavoriteTaxiRouteService service;

    @GetMapping
    public List<FavoriteTaxiRoute> getAll(@AuthenticationPrincipal CustomUserDetails userDetails) {
        return service.getAll(userDetails.getAccount());
    }

    @PostMapping
    public FavoriteTaxiRoute create(@AuthenticationPrincipal CustomUserDetails userDetails,
                                                    @RequestBody FavoriteTaxiRoute dto) {
        return service.create(userDetails.getAccount(), dto);
    }

    @PutMapping("/{id}")
    public FavoriteTaxiRoute update(@PathVariable Long id,
                                                    @AuthenticationPrincipal CustomUserDetails userDetails,
                                                    @RequestBody FavoriteTaxiRoute dto) {
        return service.update(id, userDetails.getAccount(), dto);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id,
                                                        @AuthenticationPrincipal CustomUserDetails userDetails) {
        service.delete(id, userDetails.getAccount());
        return ResponseEntity.noContent().build();
    }
}
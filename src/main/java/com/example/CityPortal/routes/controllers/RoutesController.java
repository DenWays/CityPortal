package com.example.CityPortal.routes.controllers;

import com.example.CityPortal.routes.dtos.RouteDetailDto;
import com.example.CityPortal.routes.dtos.RouteDto;
import com.example.CityPortal.routes.services.RouteService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/routes")
@RequiredArgsConstructor
public class RoutesController {
    private final RouteService routeService;

    @GetMapping
    public Page<RouteDto> getRoutes(@RequestParam(defaultValue = "0") int page,
                                                        @RequestParam(defaultValue = "10") int size,
                                                        @RequestParam(required = false) String title,
                                                        @RequestParam(required = false) List<String> routeTypes,
                                                        @RequestParam(defaultValue = "false") boolean random) {
        Pageable pageable = PageRequest.of(page, Math.min(size, 50));
        boolean hasTitle = title != null && !title.isBlank();
        boolean hasTypes = routeTypes != null && !routeTypes.isEmpty();

        if (hasTitle || hasTypes) {
            return routeService.search(title, routeTypes, pageable);
        }
        if (random) {
            return routeService.getAllRandom(pageable);
        }
        return routeService.getAll(pageable);
    }

    @GetMapping("/{id}")
    public RouteDetailDto getRoute(@PathVariable Long id) {
        return routeService.getById(id);
    }

    @PostMapping("/fetch")
    public ResponseEntity<Map<String, Object>> fetchNow() {
        int saved = routeService.fetchAndSave();
        return ResponseEntity.ok(Map.of("saved", saved));
    }
}
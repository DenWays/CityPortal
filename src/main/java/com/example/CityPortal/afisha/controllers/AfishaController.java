package com.example.CityPortal.afisha.controllers;

import com.example.CityPortal.afisha.dtos.EventDetailDto;
import com.example.CityPortal.afisha.dtos.EventDto;
import com.example.CityPortal.afisha.services.AfishaService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/api/afisha")
@RequiredArgsConstructor
public class AfishaController {
    private final AfishaService afishaService;

    @GetMapping
    public Page<EventDto> getEvents(@RequestParam(defaultValue = "0")  int page,
                                                            @RequestParam(defaultValue = "10") int size,
                                                            @RequestParam(required = false) String title,
                                                            @RequestParam(required = false) String dateFrom,
                                                            @RequestParam(required = false) String dateTo) {
        Pageable pageable = PageRequest.of(page, Math.min(size, 50));
        boolean hasFilter = (title != null && !title.isBlank())
            || (dateFrom != null && !dateFrom.isBlank())
            || (dateTo   != null && !dateTo.isBlank());
        if (hasFilter) {
            return afishaService.search(title, dateFrom, dateTo, pageable);
        }

        return afishaService.getAll(pageable);
    }

    @GetMapping("/{id}")
    public EventDetailDto getEvent(@PathVariable Long id) {
        return afishaService.getById(id);
    }

    @PostMapping("/fetch")
    public ResponseEntity<Map<String, Object>> fetchNow() {
        int saved = afishaService.fetchAndSave();
        return ResponseEntity.ok(Map.of("saved", saved));
    }
}
package com.example.CityPortal.venue.controllers;

import com.example.CityPortal.venue.dtos.VenueInfoDto;
import com.example.CityPortal.venue.services.VenueService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/venue")
@RequiredArgsConstructor
public class VenueController {
    private final VenueService venueService;

    @GetMapping("/list")
    public ResponseEntity<Page<VenueInfoDto>> listVenues(@RequestParam(defaultValue = "0") int page,
                                                                                                @RequestParam(defaultValue = "12") int size) {
        Page<VenueInfoDto> result = venueService.listAll(
            PageRequest.of(page, Math.min(size, 50), Sort.by(Sort.Direction.DESC, "scrapedAt"))
        );
        return ResponseEntity.ok(result);
    }

    @GetMapping("/{id:[0-9]+}")
    public ResponseEntity<VenueInfoDto> getVenueById(@PathVariable Long id) {
        try {
            return ResponseEntity.ok(venueService.getById(id));
        }
        catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @GetMapping("/check")
    public ResponseEntity<Map<String, Object>> checkVenue(@RequestParam Double lat,
                                                                                                @RequestParam Double lon,
                                                                                                @RequestParam(required = false, defaultValue = "") String name,
                                                                                                @RequestParam(required = false, defaultValue = "") String address) {
        Long id = venueService.checkExists(lat, lon, name, address);
        return ResponseEntity.ok(Map.of("id", id != null ? id : "null", "exists", id != null));
    }

    @GetMapping("/info")
    public ResponseEntity<VenueInfoDto> getVenueInfo(@RequestParam String name,
                                                                                        @RequestParam(required = false, defaultValue = "") String address,
                                                                                        @RequestParam Double lat,
                                                                                        @RequestParam Double lon) {
        log.info("GET /api/venue/info name='{}' address='{}' lat={} lon={}", name, address, lat, lon);
        VenueInfoDto dto = venueService.getVenueInfo(name, address, lat, lon, false);
        return ResponseEntity.ok(dto);
    }

    @PostMapping("/refresh")
    public ResponseEntity<VenueInfoDto> refreshVenueInfo(@RequestParam String name,
                                                                                            @RequestParam(required = false, defaultValue = "") String address,
                                                                                            @RequestParam Double lat,
                                                                                            @RequestParam Double lon) {
        log.info("POST /api/venue/refresh name='{}' address='{}' lat={} lon={}", name, address, lat, lon);
        VenueInfoDto dto = venueService.getVenueInfo(name, address, lat, lon, true);
        return ResponseEntity.ok(dto);
    }

    @GetMapping("/info-by-url")
    public ResponseEntity<VenueInfoDto> getVenueInfoByUrl(@RequestParam String yandexOrgUrl,
                                                                                                @RequestParam(required = false, defaultValue = "") String name,
                                                                                                @RequestParam(required = false, defaultValue = "") String address,
                                                                                                @RequestParam Double lat,
                                                                                                @RequestParam Double lon) {
        log.info("GET /api/venue/info-by-url url='{}' name='{}' lat={} lon={}", yandexOrgUrl, name, lat, lon);
        VenueInfoDto dto = venueService.getVenueInfoByUrl(yandexOrgUrl, name, address, lat, lon, false);
        return ResponseEntity.ok(dto);
    }

    @PostMapping("/refresh-by-url")
    public ResponseEntity<VenueInfoDto> refreshVenueInfoByUrl(@RequestParam String yandexOrgUrl,
                                                                                                    @RequestParam(required = false, defaultValue = "") String name,
                                                                                                    @RequestParam(required = false, defaultValue = "") String address,
                                                                                                    @RequestParam Double lat,
                                                                                                    @RequestParam Double lon) {
        log.info("POST /api/venue/refresh-by-url url='{}' name='{}' lat={} lon={}", yandexOrgUrl, name, lat, lon);
        VenueInfoDto dto = venueService.getVenueInfoByUrl(yandexOrgUrl, name, address, lat, lon, true);
        return ResponseEntity.ok(dto);
    }
}
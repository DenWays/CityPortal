package com.example.CityPortal.venue.services.impls;

import com.example.CityPortal.venue.dtos.VenueInfoDto;
import com.example.CityPortal.venue.models.Venue;
import com.example.CityPortal.venue.models.VenueReview;
import com.example.CityPortal.venue.repository.VenueRepository;
import com.example.CityPortal.venue.repository.VenueReviewRepository;
import com.example.CityPortal.venue.services.VenueService;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class VenueServiceImpl implements VenueService {
    private static final long CACHE_TTL_HOURS = 24;
    private final VenueRepository venueRepository;
    private final VenueReviewRepository venueReviewRepository;
    private final YandexMapsScraperService scraperService;
    private final VenueSummarizationService summarizationService;

    @PostConstruct
    @Transactional
    public void cleanupCaptchaVenues() {
        try {
            int deletedJunk = venueReviewRepository.deleteJunkReviews();
            if (deletedJunk > 0) {
                log.info("Удалено {} мусорных отзывов (статусы пользователей)", deletedJunk);
            }

            List<Long> badIds = venueRepository.findCaptchaVenueIds();
            if (!badIds.isEmpty()) {
                for (Long id : badIds) {
                    venueReviewRepository.deleteByVenueId(id);
                }
                int deleted = venueRepository.deleteCaptchaVenues();
                log.info("Очищено {} мусорных записей заведений (капча)", deleted);
            }
        }
        catch (Exception e) {
            log.warn("Ошибка при очистке мусорных venue: {}", e.getMessage());
        }
    }

    private boolean isCaptchaName(String name) {
        if (name == null)
            return false;
        String low = name.toLowerCase();
        return low.contains("подтвердите") || low.contains("робот") || low.contains("captcha");
    }

    @Override
    public Long checkExists(Double lat, Double lon) {
        return venueRepository.findByLatitudeAndLongitude(lat, lon)
            .filter(v -> !isCaptchaName(v.getName()))
            .map(Venue::getId)
            .orElse(null);
    }

    @Override
    public Long checkExists(Double lat, Double lon, String name, String address) {
        Optional<Venue> byLatLon = venueRepository.findByLatitudeAndLongitude(lat, lon)
            .filter(v -> !isCaptchaName(v.getName()));
        if (byLatLon.isPresent())
            return byLatLon.get().getId();

        if (name != null && !name.isBlank() && address != null && !address.isBlank()) {
            Optional<Venue> byNameAddr = venueRepository.findByNameAndAddress(name, address)
                .filter(v -> !isCaptchaName(v.getName()));
            if (byNameAddr.isPresent())
                return byNameAddr.get().getId();
        }

        if (name != null && !name.isBlank()) {
            Optional<Venue> byName = venueRepository.findByNameOnly(name)
                .filter(v -> !isCaptchaName(v.getName()));
            if (byName.isPresent())
                return byName.get().getId();
        }

        return null;
    }

    @Override
    @Transactional
    public VenueInfoDto getVenueInfo(String name, String address, Double lat, Double lon, boolean forceRefresh) {
        Optional<Venue> existing = venueRepository.findByLatitudeAndLongitude(lat, lon);
        boolean captchaInCache = existing.isPresent() && isCaptchaName(existing.get().getName());
        boolean needScrape = forceRefresh || captchaInCache || existing.isEmpty() ||
            existing.get().getScrapedAt() == null ||
            existing.get().getScrapedAt().isBefore(LocalDateTime.now().minusHours(CACHE_TTL_HOURS));
        Venue venue;

        if (needScrape) {
            log.info("Запускаем скрапинг для '{}', адрес='{}' ({}, {})", name, address, lat, lon);
            try {
                venue = scraperService.scrapeAndSave(name, address, lat, lon);
            }
            catch (Exception e) {
                log.error("Ошибка скрапинга: {}", e.getMessage(), e);
                if (existing.isPresent() && !isCaptchaName(existing.get().getName())) {
                    venue = existing.get();
                }
                else {
                    VenueInfoDto errorDto = new VenueInfoDto();
                    errorDto.setName(name);
                    errorDto.setLatitude(lat);
                    errorDto.setLongitude(lon);
                    errorDto.setStatus("error");
                    return errorDto;
                }
            }
        }
        else {
            venue = existing.get();
            log.info("Данные из кэша для '{}', scraped_at={}", name, venue.getScrapedAt());
        }

        List<VenueReview> reviews = venueReviewRepository.findByVenueId(venue.getId());
        String summary;

        if (needScrape && !reviews.isEmpty()) {
            summary = summarizationService.summarizeAndSave(venue, reviews);
        }
        else {
            summary = summarizationService.getLatestSummary(venue.getId());
        }

        return toDto(venue, reviews, summary);
    }

    @Override
    @Transactional
    public VenueInfoDto getVenueInfoByUrl(String yandexOrgUrl, String name, String address, Double lat, Double lon, boolean forceRefresh) {
        Optional<Venue> existing = venueRepository.findByLatitudeAndLongitude(lat, lon);
        boolean captchaInCache = existing.isPresent() && isCaptchaName(existing.get().getName());
        boolean needScrape = forceRefresh || captchaInCache || existing.isEmpty() ||
            existing.get().getScrapedAt() == null ||
            existing.get().getScrapedAt().isBefore(LocalDateTime.now().minusHours(CACHE_TTL_HOURS));
        Venue venue;

        if (needScrape) {
            log.info("Скрапинг по прямой ссылке Яндекс: {}", yandexOrgUrl);
            try {
                venue = scraperService.scrapeByDirectUrl(yandexOrgUrl, name, address, lat, lon);
            }
            catch (Exception e) {
                log.error("Ошибка скрапинга по URL: {}", e.getMessage(), e);
                if (existing.isPresent() && !isCaptchaName(existing.get().getName())) {
                    venue = existing.get();
                }
                else {
                    VenueInfoDto errorDto = new VenueInfoDto();
                    errorDto.setName(name);
                    errorDto.setLatitude(lat);
                    errorDto.setLongitude(lon);
                    errorDto.setStatus("error");
                    return errorDto;
                }
            }
        }
        else {
            venue = existing.get();
            log.info("Данные из кэша для '{}' (по URL), scraped_at={}", name, venue.getScrapedAt());
        }

        List<VenueReview> reviews = venueReviewRepository.findByVenueId(venue.getId());
        String summary;

        if (needScrape && !reviews.isEmpty()) {
            summary = summarizationService.summarizeAndSave(venue, reviews);
        }
        else {
            summary = summarizationService.getLatestSummary(venue.getId());
        }

        return toDto(venue, reviews, summary);
    }

    @Override
    public VenueInfoDto getById(Long id) {
        Venue venue = venueRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Venue not found: " + id));
        List<VenueReview> reviews = venueReviewRepository.findByVenueId(id);
        String summary = summarizationService.getLatestSummary(id);
        return toDto(venue, reviews, summary);
    }

    @Override
    @Transactional
    public String triggerSummarization(Long venueId) {
        Venue venue = venueRepository.findById(venueId)
            .orElseThrow(() -> new RuntimeException("Venue not found: " + venueId));
        List<VenueReview> reviews = venueReviewRepository.findByVenueId(venueId);
        log.info("Ручной запуск суммаризации для venue id={}, отзывов={}", venueId, reviews.size());
        return summarizationService.forceSummarize(venue, reviews);
    }

    @Override
    public Page<VenueInfoDto> listAll(Pageable pageable) {
        return venueRepository.findAll(pageable).map(v -> {
            String summary = summarizationService.getLatestSummary(v.getId());
            return toDto(v, List.of(), summary);
        });
    }

    @Override
    public Page<VenueInfoDto> listFiltered(String q, List<String> categories, Pageable pageable) {
        String qParam = (q == null || q.isBlank()) ? null : q.trim();
        List<String> catsParam = (categories == null || categories.isEmpty()) ? null : categories;
        return venueRepository.findFiltered(qParam, catsParam, pageable).map(v -> {
            String summary = summarizationService.getLatestSummary(v.getId());
            return toDto(v, List.of(), summary);
        });
    }

    @Override
    public List<String> getCategories() {
        return venueRepository.findDistinctCategories();
    }

    private VenueInfoDto errorDto(String name, Double lat, Double lon) {
        VenueInfoDto dto = new VenueInfoDto();
        dto.setName(name);
        dto.setLatitude(lat);
        dto.setLongitude(lon);
        dto.setStatus("error");
        return dto;
    }

    private VenueInfoDto toDto(Venue venue, List<VenueReview> reviews, String summary) {
        VenueInfoDto dto = new VenueInfoDto();
        dto.setId(venue.getId());
        dto.setName(venue.getName());
        dto.setAddress(venue.getAddress());
        dto.setPhone(venue.getPhone());
        dto.setRating(venue.getRating());
        dto.setCategory(venue.getCategory());
        dto.setDescription(venue.getDescription());
        dto.setLatitude(venue.getLatitude());
        dto.setLongitude(venue.getLongitude());
        dto.setYandexUrl(venue.getYandexUrl());
        dto.setReviewsSummary(summary);
        dto.setStatus("ok");

        List<VenueInfoDto.ReviewDto> reviewDtos = reviews.stream().map(r -> {
            VenueInfoDto.ReviewDto rd = new VenueInfoDto.ReviewDto();
            rd.setAuthor(r.getAuthor());
            rd.setRating(r.getRating());
            rd.setText(r.getText());
            rd.setReviewDate(r.getReviewDate());
            return rd;
        }).collect(Collectors.toList());
        dto.setReviews(reviewDtos);

        return dto;
    }
}
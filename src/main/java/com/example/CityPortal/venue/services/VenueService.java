package com.example.CityPortal.venue.services;

import com.example.CityPortal.venue.dtos.VenueInfoDto;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface VenueService {
    Long checkExists(Double lat, Double lon);
    Long checkExists(Double lat, Double lon, String name, String address);
    VenueInfoDto getVenueInfo(String name, String address, Double lat, Double lon, boolean forceRefresh);
    VenueInfoDto getVenueInfoByUrl(String yandexOrgUrl, String name, String address, Double lat, Double lon, boolean forceRefresh);
    VenueInfoDto getById(Long id);
    Page<VenueInfoDto> listAll(Pageable pageable);
    String triggerSummarization(Long venueId);
}
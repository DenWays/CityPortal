package com.example.CityPortal.afisha.services;

import com.example.CityPortal.afisha.dtos.EventDetailDto;
import com.example.CityPortal.afisha.dtos.EventDto;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface AfishaService {
    int fetchAndSave();
    Page<EventDto> getAll(Pageable pageable);
    Page<EventDto> search(String title, String dateFrom, String dateTo, Pageable pageable);
    EventDetailDto getById(Long id);
}
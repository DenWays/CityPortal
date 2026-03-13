package com.example.CityPortal.routes.services;

import com.example.CityPortal.routes.dtos.RouteDetailDto;
import com.example.CityPortal.routes.dtos.RouteDto;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;

public interface RouteService {
    int fetchAndSave();
    Page<RouteDto> getAll(Pageable pageable);
    Page<RouteDto> getAllRandom(Pageable pageable);
    Page<RouteDto> search(String title, List<String> routeTypes, Pageable pageable);
    RouteDetailDto getById(Long id);
}
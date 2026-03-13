package com.example.CityPortal.routes.dtos;

import lombok.Data;

@Data
public class RouteDto {
    private Long id;
    private String title;
    private String operatorName;
    private String duration;
    private String imageUrl;
    private String sourceUrl;
    private String routeType;
}
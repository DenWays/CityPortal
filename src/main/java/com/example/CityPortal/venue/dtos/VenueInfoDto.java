package com.example.CityPortal.venue.dtos;

import lombok.Data;

import java.util.List;

@Data
public class VenueInfoDto {
    private Long id;
    private String name;
    private String address;
    private String phone;
    private String rating;
    private String category;
    private String description;
    private Double latitude;
    private Double longitude;
    private String yandexUrl;
    private String reviewsSummary;
    private List<ReviewDto> reviews;
    private String status;

    @Data
    public static class ReviewDto {
        private String author;
        private String rating;
        private String text;
        private String reviewDate;
    }
}
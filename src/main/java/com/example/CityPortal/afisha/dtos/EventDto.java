package com.example.CityPortal.afisha.dtos;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.Data;

import java.time.LocalDate;

@Data
public class EventDto {
    private Long id;
    private String title;
    private String venue;
    private String price;
    private String imageUrl;
    private String sourceUrl;

    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd")
    private LocalDate eventDate;
}
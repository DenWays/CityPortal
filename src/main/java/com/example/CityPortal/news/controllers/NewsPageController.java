package com.example.CityPortal.news.controllers;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

@Controller
public class NewsPageController {

    @GetMapping("/news")
    public String newsListPage() {
        return "forward:/news.html";
    }

    @GetMapping("/news/{id}")
    public String newsDetailPage(@PathVariable Long id) {
        return "forward:/news.html";
    }
}
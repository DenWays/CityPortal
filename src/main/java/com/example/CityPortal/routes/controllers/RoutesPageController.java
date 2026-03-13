package com.example.CityPortal.routes.controllers;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class RoutesPageController {

    @GetMapping("/routes")
    public String routesPage() {
        return "forward:/routes.html";
    }
}
package com.example.CityPortal.afisha.controllers;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class AfishaPageController {

    @GetMapping("/afisha")
    public String afishaPage() {
        return "forward:/afisha.html";
    }
}
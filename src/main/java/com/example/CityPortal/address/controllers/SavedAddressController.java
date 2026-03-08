package com.example.CityPortal.address.controllers;

import com.example.CityPortal.address.models.SavedAddress;
import com.example.CityPortal.address.services.SavedAddressService;
import com.example.CityPortal.auth.config.CustomUserDetails;
import lombok.AllArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/addresses")
@AllArgsConstructor
public class SavedAddressController {
    private final SavedAddressService service;

    @GetMapping
    public List<SavedAddress> getAll(@AuthenticationPrincipal CustomUserDetails userDetails) {
        return service.getAll(userDetails.getAccount());
    }

    @PostMapping
    public SavedAddress create(@AuthenticationPrincipal CustomUserDetails userDetails,
                                                @RequestBody SavedAddress dto) {
        return service.create(userDetails.getAccount(), dto);
    }

    @PutMapping("/{id}")
    public SavedAddress update(@PathVariable Long id,
                                                @AuthenticationPrincipal CustomUserDetails userDetails,
                                                @RequestBody SavedAddress dto) {
        return service.update(id, userDetails.getAccount(), dto);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id,
                                       @AuthenticationPrincipal CustomUserDetails userDetails) {
        service.delete(id, userDetails.getAccount());
        return ResponseEntity.noContent().build();
    }
}
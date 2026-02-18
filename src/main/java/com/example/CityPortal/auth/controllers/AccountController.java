package com.example.CityPortal.auth.controllers;

import com.example.CityPortal.auth.config.CustomUserDetails;
import com.example.CityPortal.auth.models.Account;
import com.example.CityPortal.auth.services.AccountService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.AllArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("api/auth")
@AllArgsConstructor
public class AccountController {
    private final AccountService accountService;

    @PostMapping("/register")
    public Account addAccount(@RequestBody Account account) {
        return accountService.addAccount(account);
    }

    @GetMapping("/account")
    public Account getAccount(@AuthenticationPrincipal CustomUserDetails userDetails) {
        if (userDetails == null)
            return null;
        return userDetails.getAccount();
    }

    @GetMapping("/{login}")
    public Account getAccountByLogin(@PathVariable String login) {
        return accountService.findByLogin(login);
    }

    @GetMapping("/csrf-token")
    public Map<String, String> getCsrfToken(HttpServletRequest request) {
        Map<String, String> csrfToken = new HashMap<>();
        csrfToken.put("token", ((CsrfToken) request.getAttribute(CsrfToken.class.getName())).getToken());
        return csrfToken;
    }
}

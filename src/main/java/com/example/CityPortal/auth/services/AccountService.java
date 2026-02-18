package com.example.CityPortal.auth.services;

import com.example.CityPortal.auth.models.Account;

public interface AccountService {
    Account addAccount(Account account);
    Account findByLogin(String login);
}

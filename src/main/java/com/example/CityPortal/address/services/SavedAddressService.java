package com.example.CityPortal.address.services;

import com.example.CityPortal.address.models.SavedAddress;
import com.example.CityPortal.auth.models.Account;

import java.util.List;

public interface SavedAddressService {
    List<SavedAddress> getAll(Account account);
    SavedAddress create(Account account, SavedAddress dto);
    SavedAddress update(Long id, Account account, SavedAddress dto);
    void delete(Long id, Account account);
}
package com.example.CityPortal.taxi.services;

import com.example.CityPortal.auth.models.Account;
import com.example.CityPortal.taxi.models.FavoriteTaxiRoute;

import java.util.List;

public interface FavoriteTaxiRouteService {
    List<FavoriteTaxiRoute> getAll(Account account);
    FavoriteTaxiRoute create(Account account, FavoriteTaxiRoute dto);
    FavoriteTaxiRoute update(Long id, Account account, FavoriteTaxiRoute dto);
    void delete(Long id, Account account);
}
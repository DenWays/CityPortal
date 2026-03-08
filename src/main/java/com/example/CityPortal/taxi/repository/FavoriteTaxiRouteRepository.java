package com.example.CityPortal.taxi.repository;

import com.example.CityPortal.auth.models.Account;
import com.example.CityPortal.taxi.models.FavoriteTaxiRoute;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface FavoriteTaxiRouteRepository extends JpaRepository<FavoriteTaxiRoute, Long> {
    List<FavoriteTaxiRoute> findByAccount(Account account);
}
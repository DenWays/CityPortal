package com.example.CityPortal.address.repository;

import com.example.CityPortal.address.models.SavedAddress;
import com.example.CityPortal.auth.models.Account;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SavedAddressRepository extends JpaRepository<SavedAddress, Long> {
    List<SavedAddress> findByAccount(Account account);
}
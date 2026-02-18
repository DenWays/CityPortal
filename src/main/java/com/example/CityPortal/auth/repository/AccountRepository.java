package com.example.CityPortal.auth.repository;

import com.example.CityPortal.auth.models.Account;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface AccountRepository extends JpaRepository<Account, Integer> {
    @Query("SELECT a FROM Account a WHERE a.login = ?1")
    Account findByLogin(String login);
}

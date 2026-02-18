package com.example.CityPortal.auth.services.impls;

import com.example.CityPortal.auth.config.CustomUserDetails;
import com.example.CityPortal.auth.models.Account;
import com.example.CityPortal.auth.repository.AccountRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;

public class CustomUserDetailsService implements UserDetailsService {
    @Autowired
    private AccountRepository accountRepository;

    @Override
    public UserDetails loadUserByUsername(String login) throws UsernameNotFoundException {
        Account account = accountRepository.findByLogin(login);

        if (account == null) {
            throw new UsernameNotFoundException("Not found");
        }

        return new CustomUserDetails(account);
    }
}

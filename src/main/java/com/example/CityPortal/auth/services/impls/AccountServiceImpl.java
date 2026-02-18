package com.example.CityPortal.auth.services.impls;

import com.example.CityPortal.auth.models.Account;
import com.example.CityPortal.auth.repository.AccountRepository;
import com.example.CityPortal.auth.services.AccountService;
import lombok.AllArgsConstructor;
import org.springframework.context.annotation.Primary;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

@Service
@AllArgsConstructor
@Primary
public class AccountServiceImpl implements AccountService {
    AccountRepository accountRepository;

    @Override
    public Account addAccount(Account account) {
        BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
        account.setPassword(encoder.encode(account.getPassword()));
        accountRepository.save(account);
        return account;
    }

    @Override
    public Account findByLogin(String login) {
        return accountRepository.findByLogin(login);
    }
}

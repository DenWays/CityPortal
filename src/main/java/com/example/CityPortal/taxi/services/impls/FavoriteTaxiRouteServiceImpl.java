package com.example.CityPortal.taxi.services.impls;

import com.example.CityPortal.auth.models.Account;
import com.example.CityPortal.taxi.models.FavoriteTaxiRoute;
import com.example.CityPortal.taxi.repository.FavoriteTaxiRouteRepository;
import com.example.CityPortal.taxi.services.FavoriteTaxiRouteService;
import lombok.AllArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
@AllArgsConstructor
public class FavoriteTaxiRouteServiceImpl implements FavoriteTaxiRouteService {
    private final FavoriteTaxiRouteRepository repository;

    @Override
    public List<FavoriteTaxiRoute> getAll(Account account) {
        return repository.findByAccount(account);
    }

    @Override
    public FavoriteTaxiRoute create(Account account, FavoriteTaxiRoute dto) {
        FavoriteTaxiRoute entity = new FavoriteTaxiRoute();
        entity.setLabel(dto.getLabel());
        entity.setFromAddress(dto.getFromAddress());
        entity.setFromLat(dto.getFromLat());
        entity.setFromLon(dto.getFromLon());
        entity.setToAddress(dto.getToAddress());
        entity.setToLat(dto.getToLat());
        entity.setToLon(dto.getToLon());
        entity.setAccount(account);
        return repository.save(entity);
    }

    @Override
    public FavoriteTaxiRoute update(Long id, Account account, FavoriteTaxiRoute dto) {
        FavoriteTaxiRoute entity = repository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Route not found"));
        if (!entity.getAccount().getId().equals(account.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied");
        }
        entity.setLabel(dto.getLabel());
        entity.setFromAddress(dto.getFromAddress());
        entity.setFromLat(dto.getFromLat());
        entity.setFromLon(dto.getFromLon());
        entity.setToAddress(dto.getToAddress());
        entity.setToLat(dto.getToLat());
        entity.setToLon(dto.getToLon());
        return repository.save(entity);
    }

    @Override
    public void delete(Long id, Account account) {
        FavoriteTaxiRoute entity = repository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Route not found"));
        if (!entity.getAccount().getId().equals(account.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied");
        }
        repository.delete(entity);
    }
}
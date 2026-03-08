package com.example.CityPortal.address.services.impls;

import com.example.CityPortal.address.models.SavedAddress;
import com.example.CityPortal.address.repository.SavedAddressRepository;
import com.example.CityPortal.address.services.SavedAddressService;
import com.example.CityPortal.auth.models.Account;
import lombok.AllArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import java.util.List;

@Service
@AllArgsConstructor
public class SavedAddressServiceImpl implements SavedAddressService {
    private final SavedAddressRepository repository;

    @Override
    public List<SavedAddress> getAll(Account account) {
        return repository.findByAccount(account);
    }

    @Override
    public SavedAddress create(Account account, SavedAddress dto) {
        SavedAddress entity = new SavedAddress();
        entity.setLabel(dto.getLabel());
        entity.setAddress(dto.getAddress());
        entity.setLat(dto.getLat());
        entity.setLon(dto.getLon());
        entity.setAccount(account);
        return repository.save(entity);
    }

    @Override
    public SavedAddress update(Long id, Account account, SavedAddress dto) {
        SavedAddress entity = repository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Address not found"));
        if (!entity.getAccount().getId().equals(account.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied");
        }
        entity.setLabel(dto.getLabel());
        entity.setAddress(dto.getAddress());
        entity.setLat(dto.getLat());
        entity.setLon(dto.getLon());
        return repository.save(entity);
    }

    @Override
    public void delete(Long id, Account account) {
        SavedAddress entity = repository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Address not found"));
        if (!entity.getAccount().getId().equals(account.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied");
        }
        repository.delete(entity);
    }
}
package com.example.CityPortal.auth.repository;

import com.example.CityPortal.auth.models.Role;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RoleRepository extends JpaRepository<Role, Integer> {
}

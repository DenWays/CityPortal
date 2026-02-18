package com.example.CityPortal.auth.models;

import jakarta.persistence.*;
import lombok.Data;

@Data
@Entity
@Table(name = "role")
public class Role {
    @Id
    @GeneratedValue(strategy =  jakarta.persistence.GenerationType.IDENTITY)
    @Column(name = "idRole")
    private Integer id;

    @Column(name = "name", unique = true)
    private String name;
}

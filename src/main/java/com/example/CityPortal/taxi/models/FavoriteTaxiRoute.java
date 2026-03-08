package com.example.CityPortal.taxi.models;

import com.example.CityPortal.auth.models.Account;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Data;

@Data
@Entity
@Table(name = "favorite_taxi_route")
public class FavoriteTaxiRoute {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "label")
    private String label;

    @Column(name = "from_address", nullable = false)
    private String fromAddress;

    @Column(name = "from_lat")
    private Double fromLat;

    @Column(name = "from_lon")
    private Double fromLon;

    @Column(name = "to_address", nullable = false)
    private String toAddress;

    @Column(name = "to_lat")
    private Double toLat;

    @Column(name = "to_lon")
    private Double toLon;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "account_id", nullable = false)
    private Account account;
}
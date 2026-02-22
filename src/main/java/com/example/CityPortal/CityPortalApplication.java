package com.example.CityPortal;

import com.example.CityPortal.weather.config.WeatherApiProperties;
import com.example.CityPortal.weather.config.WeatherCityProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication
@EnableConfigurationProperties({WeatherApiProperties.class, WeatherCityProperties.class})
public class CityPortalApplication {

	public static void main(String[] args) {
		SpringApplication.run(CityPortalApplication.class, args);
	}

}

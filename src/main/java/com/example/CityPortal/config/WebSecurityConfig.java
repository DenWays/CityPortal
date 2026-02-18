package com.example.CityPortal.config;

import com.example.CityPortal.auth.services.impls.CustomUserDetailsService;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractAuthenticationFilterConfigurer;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class WebSecurityConfig {
    @Bean
    public UserDetailsService userDetailsService() {
        return new CustomUserDetailsService();
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public DaoAuthenticationProvider authenticationProvider() {
        DaoAuthenticationProvider authProvider = new DaoAuthenticationProvider(userDetailsService());

        authProvider.setPasswordEncoder(passwordEncoder());
        return authProvider;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        return http.csrf(AbstractHttpConfigurer::disable)
                .csrf(csrf  -> csrf.ignoringRequestMatchers("/logout", "/api/account/add", "/api/**"))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/", "/register", "/api/account",  "/api/account/add", "/login",
                                "/api/account/csrf-token", "/logout", "/css/**", "/js/**", "/api/account/{login}")
                        .permitAll()
                        .requestMatchers("/admin/**").hasRole("ADMIN")
                        .anyRequest().authenticated())
                .formLogin(AbstractAuthenticationFilterConfigurer::permitAll)
                .formLogin(formLogin -> formLogin.defaultSuccessUrl("/", true).permitAll())
                .formLogin(formLogin -> formLogin.loginPage("/login").loginProcessingUrl("/login").permitAll())
                .logout(logout -> logout.logoutSuccessUrl("/").logoutUrl("/logout").permitAll())
                .csrf(csrf -> csrf.ignoringRequestMatchers("/error"))
                .build();
    }
}

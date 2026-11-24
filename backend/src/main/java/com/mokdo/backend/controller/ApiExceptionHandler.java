package com.mokdo.backend.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice
public class ApiExceptionHandler {
    public record ErrorResponse(String code) {}

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<ErrorResponse> handle(ResponseStatusException exception) {
        return ResponseEntity.status(exception.getStatusCode()).body(
                new ErrorResponse(exception.getReason() == null ? "request_rejected" : exception.getReason()));
    }
}

package com.warehouse.optimizer.exception;

/** Thrown on failed login / bad credentials. Maps to HTTP 401. */
public class UnauthorizedException extends RuntimeException {
    public UnauthorizedException(String message) {
        super(message);
    }
}

package com.warehouse.optimizer.exception;

/** Thrown when a resource conflicts with existing state (e.g. duplicate email). Maps to HTTP 409. */
public class ConflictException extends RuntimeException {
    public ConflictException(String message) {
        super(message);
    }
}

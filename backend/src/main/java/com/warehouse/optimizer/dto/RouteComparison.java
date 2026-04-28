package com.warehouse.optimizer.dto;

public record RouteComparison(
        double currentDistanceM,
        double proposedDistanceM,
        double savingsM,
        double savingsPct,
        Route  currentRoute,
        Route  proposedRoute
) {}

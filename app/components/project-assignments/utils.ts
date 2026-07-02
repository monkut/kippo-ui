// Transitional re-export barrel. The logic now lives in cohesive modules — prefer
// importing directly from ./assignment-math, ./matrix-model, ./cell-styles, or
// ./constants. Date/month helpers moved to ~/lib/dates.
export * from "./assignment-math";
export * from "./matrix-model";
export * from "./cell-styles";
export * from "./constants";

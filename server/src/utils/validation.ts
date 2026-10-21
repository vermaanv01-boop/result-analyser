export function isFiniteNumber(value: number): boolean {
  return Number.isFinite(value);
}

export function isPositiveNumber(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

export function isNonNegativeNumber(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

export function isPositiveNumberOrNull(value: number | null): boolean {
  return value === null || value === undefined || isPositiveNumber(value);
}

export function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

export const finiteNumberValidator = {
  validator: isFiniteNumber,
  message: "must be a finite number",
};

export const positiveNumberValidator = {
  validator: isPositiveNumber,
  message: "must be a finite positive number",
};

export const positiveNumberOrNullValidator = {
  validator: isPositiveNumberOrNull,
  message: "must be a finite positive number when provided",
};

export const nonNegativeNumberValidator = {
  validator: isNonNegativeNumber,
  message: "must be a finite non-negative number",
};

export const positiveIntegerValidator = {
  validator: isPositiveInteger,
  message: "must be a positive integer",
};

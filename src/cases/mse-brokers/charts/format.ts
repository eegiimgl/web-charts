/** Axis label in billions of tugrik: 94674278260 → "₮94.7тб" */
export function axisBillions(v: number): string {
  return `₮${(v / 1e9).toLocaleString('en-US', { maximumFractionDigits: 1 })}тб`;
}

/** Tooltip value with full precision: 94674278260 → "₮94,674,278,261" */
export function tooltipTugrik(v: number): string {
  return `₮${Math.round(v).toLocaleString('en-US')}`;
}

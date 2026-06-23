// Energy unit scaling: Wh -> kWh -> MWh -> GWh -> TWh -> PWh (factors of 1000).
export const ENERGY_UNITS = ['Wh', 'kWh', 'MWh', 'GWh', 'TWh', 'PWh'];

// Returns the index of the unit that should be displayed for a Wh value.
export function unitIndexForWh(wh) {
  let idx = 0;
  let v = Math.abs(wh);
  while (v >= 1000 && idx < ENERGY_UNITS.length - 1) {
    v /= 1000;
    idx += 1;
  }
  return idx;
}

// Formats a Wh value as a scaled string + unit, e.g. { value: "1.42", unit: "kWh" }.
export function formatEnergy(wh) {
  const idx = unitIndexForWh(wh);
  const scaled = wh / Math.pow(1000, idx);
  let decimals;
  if (idx === 0) decimals = 0; // raw Wh reads as a whole number
  else if (scaled < 10) decimals = 2;
  else if (scaled < 100) decimals = 1;
  else decimals = 0;
  return {
    value: scaled.toFixed(decimals),
    unit: ENERGY_UNITS[idx],
    index: idx,
  };
}

export function formatEnergyString(wh) {
  const f = formatEnergy(wh);
  return `${f.value} ${f.unit}`;
}

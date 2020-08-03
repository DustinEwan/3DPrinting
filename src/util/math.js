export const roundTo = (value, places) =>
  Math.round(value * Math.pow(10, places)) / Math.pow(10, places);

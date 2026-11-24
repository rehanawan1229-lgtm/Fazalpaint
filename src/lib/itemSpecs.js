// Order items are saved with camelCase keys (colorName, colorCode, swatchHex)
// but some screens used snake_case (color_name...), so the colour never showed.
// These helpers read either spelling so every screen shows the full details.
export function getItemSpecs(item = {}) {
  return {
    brand: item.brand || '',
    packaging: item.packaging || '',
    colorName: item.colorName || item.color_name || '',
    colorCode: item.colorCode || item.color_code || '',
    swatch: item.swatchHex || item.swatch_hex || ''
  };
}

// "Quarter · Golden Yellow · Code 5"
export function describeItemSpecs(item = {}) {
  const specs = getItemSpecs(item);
  return [specs.packaging, specs.colorName, specs.colorCode ? `Code ${specs.colorCode}` : ''].filter(Boolean).join(' · ');
}

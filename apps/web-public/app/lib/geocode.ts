const NOMINATIM_UA = "SecretlinkLife/1.0 (https://secretlink.life)";

export type GeocodeResult = {
  display_name: string;
  lat: string;
  lon: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    state?: string;
    country?: string;
  };
};

/** Extract a city name from a Nominatim address object. */
function extractCity(address?: GeocodeResult["address"]): string | null {
  return address?.city ?? address?.town ?? address?.village ?? address?.municipality ?? null;
}

/** Reverse-geocode a lat/lng pair → human-readable location + city. */
export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<{ locationName: string; cityName: string | null } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lng))}`;
    const res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": NOMINATIM_UA },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as GeocodeResult;
    return {
      locationName: data.display_name ?? `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
      cityName: extractCity(data.address),
    };
  } catch {
    return null;
  }
}

/** Forward-geocode a text query → list of matching places. */
export async function searchLocations(
  query: string,
  limit = 5,
): Promise<GeocodeResult[]> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=${limit}&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": NOMINATIM_UA },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as GeocodeResult[];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/** Pick a city from a GeocodeResult. */
export function cityFromResult(r: GeocodeResult): string {
  return extractCity(r.address) ?? "";
}

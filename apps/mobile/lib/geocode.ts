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
    country?: string;
  };
};

function extractCity(address?: GeocodeResult["address"]): string | null {
  return address?.city ?? address?.town ?? address?.village ?? address?.municipality ?? null;
}

function extractCountry(address?: GeocodeResult["address"]): string | null {
  return address?.country ?? null;
}

export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<{ locationName: string; cityName: string | null; countryName: string | null } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lng))}`;
    const res = await fetch(url, { headers: { Accept: "application/json", "User-Agent": NOMINATIM_UA } });
    if (!res.ok) return null;
    const data = (await res.json()) as GeocodeResult;
    return {
      locationName: data.display_name ?? `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
      cityName: extractCity(data.address),
      countryName: extractCountry(data.address),
    };
  } catch {
    return null;
  }
}

export function cityFromResult(r: GeocodeResult): string {
  return extractCity(r.address) ?? "";
}

export function countryFromResult(r: GeocodeResult): string {
  return extractCountry(r.address) ?? "";
}

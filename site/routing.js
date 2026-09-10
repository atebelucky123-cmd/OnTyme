// OpenRouteService client — address autocomplete, geocoding, driving directions.
// This key is a free, rate-limited key meant to run in the browser (no
// backend exists in this project to hide it behind). Worst case if abused
// is the daily quota gets used up, not a security breach.
const ORS_API_KEY = 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjIwZTJkMzljNjIyYTQ4ZDg5MTk3YzNhZjdiZmFmZDdmIiwiaCI6Im11cm11cjY0In0=';

// Focuses results on Lagos so short queries ("yaba", "ikeja") rank well —
// ORS's autocomplete is a global index otherwise.
const LAGOS_FOCUS = '&focus.point.lat=6.5244&focus.point.lon=3.3792';

// Returns up to 5 { label, coordinates:[lon,lat] } suggestions as the user types.
export async function autocomplete(text) {
  if (!text || text.trim().length < 3) return [];
  const url = 'https://api.openrouteservice.org/geocode/autocomplete'
    + '?api_key=' + ORS_API_KEY
    + '&text=' + encodeURIComponent(text)
    + '&boundary.country=NG&size=5' + LAGOS_FOCUS;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.features || []).map(function (f) {
    return { label: f.properties.label, coordinates: f.geometry.coordinates };
  });
}

async function geocode(address) {
  const url = 'https://api.openrouteservice.org/geocode/search'
    + '?api_key=' + ORS_API_KEY
    + '&text=' + encodeURIComponent(address)
    + '&boundary.country=NG&size=1' + LAGOS_FOCUS;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Geocoding request failed');
  const data = await res.json();
  const feature = data.features && data.features[0];
  if (!feature) throw new Error('Could not find that address');
  return feature.geometry.coordinates; // [lon, lat]
}

async function directions(start, end) {
  const url = 'https://api.openrouteservice.org/v2/directions/driving-car'
    + '?api_key=' + ORS_API_KEY
    + '&start=' + start[0] + ',' + start[1]
    + '&end=' + end[0] + ',' + end[1];
  const res = await fetch(url);
  if (!res.ok) throw new Error('Routing request failed');
  const data = await res.json();
  const summary = data.features && data.features[0] && data.features[0].properties.summary;
  if (!summary) throw new Error('No route found between those points');
  return { distanceKm: summary.distance / 1000, durationMin: summary.duration / 60 };
}

// Precise path: use when both addresses were picked from autocomplete
// suggestions, so we already have exact coordinates — no re-geocoding.
export async function estimateRouteByCoords(startCoords, endCoords) {
  return directions(startCoords, endCoords);
}

// Fallback path: the user typed an address without picking a suggestion.
// One-shot geocoding is less reliable for ambiguous addresses.
export async function estimateRoute(pickupAddress, destinationAddress) {
  const [start, end] = await Promise.all([geocode(pickupAddress), geocode(destinationAddress)]);
  return directions(start, end);
}

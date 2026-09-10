// OpenRouteService client — geocoding + driving directions.
// This key is a free, rate-limited key meant to run in the browser (no
// backend exists in this project to hide it behind). Worst case if abused
// is the daily quota gets used up, not a security breach.
const ORS_API_KEY = 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjIwZTJkMzljNjIyYTQ4ZDg5MTk3YzNhZjdiZmFmZDdmIiwiaCI6Im11cm11cjY0In0=';

async function geocode(address) {
  const url = 'https://api.openrouteservice.org/geocode/search'
    + '?api_key=' + ORS_API_KEY
    + '&text=' + encodeURIComponent(address)
    + '&boundary.country=NG&size=1';
  const res = await fetch(url);
  if (!res.ok) throw new Error('Geocoding request failed');
  const data = await res.json();
  const feature = data.features && data.features[0];
  if (!feature) throw new Error('Could not find that address');
  return feature.geometry.coordinates; // [lon, lat]
}

// Returns { distanceKm, durationMin } or throws.
export async function estimateRoute(pickupAddress, destinationAddress) {
  const [start, end] = await Promise.all([
    geocode(pickupAddress),
    geocode(destinationAddress)
  ]);

  const url = 'https://api.openrouteservice.org/v2/directions/driving-car'
    + '?api_key=' + ORS_API_KEY
    + '&start=' + start[0] + ',' + start[1]
    + '&end=' + end[0] + ',' + end[1];
  const res = await fetch(url);
  if (!res.ok) throw new Error('Routing request failed');
  const data = await res.json();
  const summary = data.features && data.features[0] && data.features[0].properties.summary;
  if (!summary) throw new Error('No route found between those points');

  return {
    distanceKm: summary.distance / 1000,
    durationMin: summary.duration / 60
  };
}

export interface CoordinateLocation {
  latitude: number;
  longitude: number;
}

export interface CoordinateCluster<T extends CoordinateLocation> {
  key: string;
  latitude: number;
  longitude: number;
  locations: T[];
}

export function clusterExactCoordinates<T extends CoordinateLocation>(
  locations: readonly T[],
): CoordinateCluster<T>[] {
  const clusters = new Map<string, CoordinateCluster<T>>();

  for (const location of locations) {
    const latitude = Object.is(location.latitude, -0) ? 0 : location.latitude;
    const longitude = Object.is(location.longitude, -0) ? 0 : location.longitude;
    const key = `${latitude},${longitude}`;
    const cluster = clusters.get(key);

    if (cluster) {
      cluster.locations.push(location);
    } else {
      clusters.set(key, {
        key,
        latitude,
        longitude,
        locations: [location],
      });
    }
  }

  return [...clusters.values()];
}

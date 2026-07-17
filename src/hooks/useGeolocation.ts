import { useEffect, useState } from "react";

type GeoState = {
  lat: number | null;
  lng: number | null;
  loading: boolean;
  denied: boolean;
};

export function useGeolocation(): GeoState {
  const [state, setState] = useState<GeoState>({ lat: null, lng: null, loading: true, denied: false });

  useEffect(() => {
    if (!navigator.geolocation) {
      setState({ lat: null, lng: null, loading: false, denied: false });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setState({ lat: pos.coords.latitude, lng: pos.coords.longitude, loading: false, denied: false }),
      () => setState({ lat: null, lng: null, loading: false, denied: true }),
      { timeout: 8000, maximumAge: 300_000 }
    );
  }, []);

  return state;
}

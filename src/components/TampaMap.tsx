import { useEffect, useRef } from "react";
import type { Venue } from "../data/types";

type MapboxModule = typeof import("mapbox-gl");

export type VenueActivityData = {
  liveCount: number;
  totalDeals: number;
  startingSoon?: boolean;
};

type TampaMapProps = {
  venues: Venue[];
  activeNeighborhood: string;
  selectedVenueId?: string;
  venueActivity?: Map<string, VenueActivityData>;
};

const TAMPA_CENTER: [number, number] = [-82.4572, 27.9506];

function getPinActivityClass(venueId: string, venueActivity?: Map<string, VenueActivityData>): string {
  const act = venueActivity?.get(venueId);
  if (!act) return "";
  if (act.liveCount > 0) return "mapbox-pin-live";
  if (act.startingSoon) return "mapbox-pin-soon";
  if (act.totalDeals > 0) return "mapbox-pin-deals";
  return "mapbox-pin-quiet";
}

function getPopupHtml(venue: Venue, act?: VenueActivityData): string {
  let statusLine = "";
  if (act) {
    if (act.liveCount > 0) {
      statusLine = `<br/><span class="mp-live">● ${act.liveCount} live now</span>`;
    } else if (act.startingSoon) {
      statusLine = `<br/><span class="mp-soon">▲ Starting soon</span>`;
    } else if (act.totalDeals > 0) {
      statusLine = `<br/><span class="mp-deals">${act.totalDeals} deal${act.totalDeals !== 1 ? "s" : ""}</span>`;
    } else {
      statusLine = `<br/><span class="mp-quiet">No deals today</span>`;
    }
  }
  return `<strong>${venue.name}</strong><br/><span class="mp-neighborhood">${venue.neighborhood}</span>${statusLine}`;
}

export function TampaMap({ venues, activeNeighborhood, selectedVenueId, venueActivity }: TampaMapProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapboxRef = useRef<MapboxModule | null>(null);
  const mapInstanceRef = useRef<InstanceType<MapboxModule["default"]["Map"]> | null>(null);
  const markersRef = useRef<InstanceType<MapboxModule["default"]["Marker"]>[]>([]);
  const token = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

  useEffect(() => {
    if (!token || !mapRef.current || mapInstanceRef.current) {
      return;
    }

    let cancelled = false;

    void (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;

      if (cancelled || !mapRef.current) {
        return;
      }

      mapboxRef.current = { default: mapboxgl } as MapboxModule;
      mapboxgl.accessToken = token;

      const map = new mapboxgl.Map({
        container: mapRef.current,
        style: "mapbox://styles/mapbox/light-v11",
        center: TAMPA_CENTER,
        zoom: 11.3,
        attributionControl: false,
      });

      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
      mapInstanceRef.current = map;
    })();

    return () => {
      cancelled = true;
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      mapInstanceRef.current?.remove();
      mapInstanceRef.current = null;
    };
  }, [token]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const mapboxModule = mapboxRef.current;

    if (!map || !mapboxModule) {
      return;
    }

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    const visibleVenues =
      activeNeighborhood === "All Tampa"
        ? venues
        : venues.filter((venue) => venue.neighborhood === activeNeighborhood);

    visibleVenues.forEach((venue) => {
      const markerElement = document.createElement("button");
      const activityClass = getPinActivityClass(venue.id, venueActivity);
      const selectedClass = venue.id === selectedVenueId ? "mapbox-pin-active" : "";
      markerElement.className = ["mapbox-pin", activityClass, selectedClass].filter(Boolean).join(" ");
      markerElement.type = "button";
      markerElement.setAttribute("aria-label", venue.name);

      const act = venueActivity?.get(venue.id);
      const popup = new mapboxModule.default.Popup({ offset: 18, className: "sipsaver-popup" }).setHTML(
        getPopupHtml(venue, act)
      );

      const marker = new mapboxModule.default.Marker(markerElement)
        .setLngLat([venue.longitude, venue.latitude])
        .setPopup(popup)
        .addTo(map);

      markersRef.current.push(marker);
    });

    const selectedVenue = visibleVenues.find((venue) => venue.id === selectedVenueId);

    if (selectedVenue) {
      map.flyTo({
        center: [selectedVenue.longitude, selectedVenue.latitude],
        zoom: 13.4,
        duration: 800,
      });
      return;
    }

    if (visibleVenues.length > 0) {
      const bounds = new mapboxModule.default.LngLatBounds();
      visibleVenues.forEach((venue) => bounds.extend([venue.longitude, venue.latitude]));
      map.fitBounds(bounds, { padding: 56, maxZoom: 13.5, duration: 800 });
    } else {
      map.flyTo({ center: TAMPA_CENTER, zoom: 11.3, duration: 800 });
    }
  }, [activeNeighborhood, selectedVenueId, venues, venueActivity]);

  if (!token) {
    return (
      <div className="map-fallback">
        <p className="map-fallback-title">Mapbox token needed</p>
        <p className="map-fallback-copy">
          Add `VITE_MAPBOX_ACCESS_TOKEN` to `.env.local` to turn on the live Tampa map.
        </p>
      </div>
    );
  }

  return <div className="real-map" ref={mapRef} />;
}

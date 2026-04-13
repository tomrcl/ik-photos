import { useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import iconRetina from "leaflet/dist/images/marker-icon-2x.png";
import icon from "leaflet/dist/images/marker-icon.png";
import shadow from "leaflet/dist/images/marker-shadow.png";
import { Header } from "../components/Header.tsx";
import { Spinner } from "../components/Spinner.tsx";
import { fetchGeoPhotos, thumbnailUrl, type GeoPhoto } from "../api/files.ts";
import { navigate } from "../hooks/useHash.ts";
import { useI18n } from "../i18n/useI18n.ts";
import { bcp47 } from "../i18n/translations/index.ts";

// Leaflet default icon fix: bundlers strip the relative image paths so we
// re-point the default icon at the imported asset URLs.
L.Icon.Default.mergeOptions({
  iconRetinaUrl: iconRetina,
  iconUrl: icon,
  shadowUrl: shadow,
});

const SWITZERLAND_CENTER: [number, number] = [46.8, 8.2];
const SWITZERLAND_ZOOM = 7;

function FitBounds({ photos }: { photos: GeoPhoto[] }) {
  const map = useMap();
  const didFitRef = useRef(false);

  useEffect(() => {
    if (didFitRef.current) return;
    if (photos.length === 0) return;
    const bounds = L.latLngBounds(photos.map((p) => [p.lat, p.lng] as [number, number]));
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
      didFitRef.current = true;
    }
  }, [map, photos]);

  return null;
}

export function MapView({ kdriveId }: { kdriveId: number }) {
  const { t, locale } = useI18n();

  const { data: photos, isPending, isError } = useQuery({
    queryKey: ["geoPhotos", kdriveId],
    queryFn: () => fetchGeoPhotos(kdriveId),
  });

  const count = photos?.length ?? 0;

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(bcp47[locale], {
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
    [locale],
  );

  return (
    <>
      <Header
        breadcrumbs={[
          { label: t("gallery.breadcrumb.drives"), hash: "drives" },
          { label: t("gallery.breadcrumb.photos"), hash: `drive/${kdriveId}` },
          { label: t("map.title"), hash: `drive/${kdriveId}/map` },
        ]}
      />
      <div className="p-4 pb-0">
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
          {count > 0 ? t("map.count", { count }) : t("map.title")}
        </h3>
      </div>

      {isPending && (
        <div className="px-4">
          <Spinner />
        </div>
      )}

      {isError && (
        <p className="text-red-500 text-center mt-12 px-4">{t("gallery.error")}</p>
      )}

      {!isPending && !isError && count === 0 && (
        <div className="flex flex-col items-center justify-center text-center px-6 mt-16">
          <svg
            className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="1.5"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
            />
          </svg>
          <h4 className="text-base font-semibold text-gray-700 dark:text-gray-200">
            {t("map.empty.title")}
          </h4>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 max-w-md">
            {t("map.empty.description")}
          </p>
        </div>
      )}

      {!isPending && !isError && count > 0 && photos && (
        <div className="h-[calc(100dvh-8rem)] w-full px-4 pb-4">
          <div className="h-full w-full rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
            <MapContainer
              center={SWITZERLAND_CENTER}
              zoom={SWITZERLAND_ZOOM}
              scrollWheelZoom
              className="h-full w-full"
            >
              <TileLayer
                attribution="&copy; OpenStreetMap contributors"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <FitBounds photos={photos} />
              <MarkerClusterGroup chunkedLoading>
                {photos.map((p) => (
                  <Marker
                    key={p.id}
                    position={[p.lat, p.lng]}
                    eventHandlers={{
                      click: () => navigate(`drive/${kdriveId}/photo/${p.id}`),
                    }}
                  >
                    <Popup>
                      <div className="flex flex-col items-center gap-1">
                        <img
                          src={thumbnailUrl(kdriveId, p.id)}
                          alt=""
                          width={120}
                          height={120}
                          loading="lazy"
                          crossOrigin="anonymous"
                          className="rounded"
                          style={{ objectFit: "cover" }}
                        />
                        {p.takenAt && (
                          <span className="text-xs text-gray-600 mt-1">
                            {dateFormatter.format(new Date(p.takenAt))}
                          </span>
                        )}
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MarkerClusterGroup>
            </MapContainer>
          </div>
        </div>
      )}
    </>
  );
}

export default MapView;

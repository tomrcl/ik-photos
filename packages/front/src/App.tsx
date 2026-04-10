import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useHash } from "./hooks/useHash.ts";
import { useAuth } from "./hooks/useAuth.ts";
import { LoginView } from "./views/LoginView.tsx";
import { DrivePickerView } from "./views/DrivePickerView.tsx";
import { TokenView } from "./views/TokenView.tsx";
import { GalleryView } from "./views/GalleryView.tsx";
import { LightboxView } from "./views/LightboxView.tsx";
import { FavoritesView } from "./views/FavoritesView.tsx";
import { TrashView } from "./views/TrashView.tsx";
import { Spinner } from "./components/Spinner.tsx";
import { UpdatePrompt } from "./components/UpdatePrompt.tsx";

// Lazy-loaded so Leaflet and its dependencies are code-split out of the main bundle.
const MapView = lazy(() =>
  import("./views/MapView.tsx").then((m) => ({ default: m.MapView })),
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,           // 1 minute — most lists don't change that often
      gcTime: 5 * 60_000,           // 5 min (default)
      refetchOnWindowFocus: false,  // mobile-hostile, useless for a photo gallery
      refetchOnReconnect: true,     // safe default
      retry: 1,                     // don't hammer on failure
    },
  },
});

function Router() {
  const hash = useHash();
  const loggedIn = useAuth();

  if (hash === "register" && !loggedIn) {
    return <LoginView mode="register" />;
  }

  if (hash === "login" || !loggedIn) {
    return <LoginView mode="login" />;
  }

  if (hash === "drives") {
    return <DrivePickerView />;
  }

  if (hash === "token" || hash === "token?expired") {
    return <TokenView expired={hash === "token?expired"} />;
  }

  // Favorites route
  const favMatch = hash.match(/^drive\/(\d+)\/favorites$/);
  if (favMatch) {
    return <FavoritesView kdriveId={Number(favMatch[1])} />;
  }

  // Trash (Corbeille) route
  const trashMatch = hash.match(/^drive\/(\d+)\/trash$/);
  if (trashMatch) {
    return <TrashView kdriveId={Number(trashMatch[1])} />;
  }

  // Map route
  const mapMatch = hash.match(/^drive\/(\d+)\/map$/);
  if (mapMatch) {
    return (
      <Suspense fallback={<Spinner />}>
        <MapView kdriveId={Number(mapMatch[1])} />
      </Suspense>
    );
  }

  // Parse drive-related routes
  // Photo IDs are now UUIDs: drive/123/photo/uuid
  const photoMatch = hash.match(/^drive\/(\d+)\/photo\/([a-f0-9-]+)$/);
  const posMatch = hash.match(/^drive\/(\d+)\/(\d{4})\/(\d{1,2})$/);
  const yearMatch = hash.match(/^drive\/(\d+)\/year\/(\d+)$/);
  const driveMatch = hash.match(/^drive\/(\d+)$/);

  const kdriveId = photoMatch
    ? Number(photoMatch[1])
    : posMatch
      ? Number(posMatch[1])
      : yearMatch
        ? Number(yearMatch[1])
        : driveMatch
          ? Number(driveMatch[1])
          : null;

  const initialPos = posMatch
    ? { year: Number(posMatch[2]), month: Number(posMatch[3]) }
    : yearMatch
      ? { year: Number(yearMatch[2]), month: 0 }
      : undefined;

  if (kdriveId) {
    return (
      <>
        <GalleryView kdriveId={kdriveId} initialPos={initialPos} />
        {photoMatch && (
          <LightboxView
            kdriveId={kdriveId}
            photoId={photoMatch[2]}
          />
        )}
      </>
    );
  }

  return <LoginView mode="login" />;
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router />
      <UpdatePrompt />
    </QueryClientProvider>
  );
}

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useHash } from "./hooks/useHash.ts";
import { useAuth } from "./hooks/useAuth.ts";
import { LoginView } from "./views/LoginView.tsx";
import { DrivePickerView } from "./views/DrivePickerView.tsx";
import { TokenView } from "./views/TokenView.tsx";
import { GalleryView } from "./views/GalleryView.tsx";
import { LightboxView } from "./views/LightboxView.tsx";
import { FavoritesView } from "./views/FavoritesView.tsx";

const queryClient = new QueryClient();

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
    </QueryClientProvider>
  );
}

import { useQuery } from "@tanstack/react-query";
import { fetchAllPhotos } from "../api/files.ts";

export function usePhotos(kdriveId: number) {
  return useQuery({
    queryKey: ["photos", kdriveId],
    queryFn: () => fetchAllPhotos(kdriveId),
    staleTime: 5 * 60 * 1000,
  });
}

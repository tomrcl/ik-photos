import { useQuery } from "@tanstack/react-query";
import { fetchMonths, type MonthCount } from "../api/files.ts";

export function useMonthCounts(kdriveId: number) {
  return useQuery<MonthCount[]>({
    queryKey: ["monthCounts", kdriveId],
    queryFn: () => fetchMonths(kdriveId),
    staleTime: 5 * 60 * 1000,
  });
}

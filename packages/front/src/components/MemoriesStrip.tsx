import { useQuery } from "@tanstack/react-query";
import { fetchMemories, thumbnailUrl } from "../api/files.ts";
import { navigate } from "../hooks/useHash.ts";
import { useMemoriesEnabled } from "../hooks/useMemoriesEnabled.ts";
import { useI18n } from "../i18n/useI18n.ts";

interface MemoriesStripProps {
  kdriveId: number;
}

/**
 * "On this day" horizontal strip shown at the top of the gallery. Renders
 * nothing when the memories feature is toggled off, while loading/erroring,
 * or when there are no matching photos. The query is fully gated by the
 * toggle — no network call fires when disabled.
 */
export function MemoriesStrip({ kdriveId }: MemoriesStripProps) {
  const [enabled] = useMemoriesEnabled();
  const { t } = useI18n();

  const { data, isPending, isError } = useQuery({
    queryKey: ["memories", kdriveId],
    queryFn: () => fetchMemories(kdriveId),
    enabled,
    staleTime: 60 * 60 * 1000, // 1h — memories only change daily
  });

  if (!enabled || isPending || isError) return null;
  if (!data || data.years.length === 0) return null;

  return (
    <section className="mb-4" aria-label={t("memories.title")}>
      <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
        {t("memories.title")}
      </h3>
      <div className="space-y-3">
        {data.years.map((bucket) => (
          <div key={bucket.year}>
            <h4 className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              {t("memories.yearsAgo", { count: bucket.yearsAgo })}
              <span className="text-gray-400 dark:text-gray-500 font-normal ml-2">
                ({bucket.year})
              </span>
            </h4>
            <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1">
              {bucket.photos.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => navigate(`drive/${kdriveId}/photo/${p.id}`)}
                  className="shrink-0 w-24 h-24 rounded overflow-hidden bg-gray-200 dark:bg-gray-700 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  aria-label={p.name}
                >
                  <img
                    src={thumbnailUrl(kdriveId, p.id)}
                    alt=""
                    loading="lazy"
                    crossOrigin="anonymous"
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

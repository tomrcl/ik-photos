import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { syncDrives, listDrives, startIndexation, TokenExpiredError, type Drive } from "../api/drives.ts";
import { logout } from "../api/client.ts";
import { Header } from "../components/Header.tsx";
import { Spinner } from "../components/Spinner.tsx";
import { navigate } from "../hooks/useHash.ts";
import { useI18n } from "../i18n/useI18n.ts";

function IndexBadge({ drive }: { drive: Drive }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (force: boolean) => startIndexation(drive.kdriveId, force),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["drives"] });
    },
  });

  if (drive.indexStatus === "INDEXING") {
    return (
      <span className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-2 py-1 rounded-full">
        {drive.totalPhotos > 0
          ? `${t("drives.indexing")} ${drive.totalPhotos.toLocaleString()}`
          : t("drives.indexing")}
      </span>
    );
  }

  if (drive.indexStatus === "COMPLETE") {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          mutation.mutate(false);
        }}
        className="text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/50 px-2 py-1 rounded-full cursor-pointer transition-colors"
        title={t("drives.reindex")}
      >
        {t("drives.photos", { count: drive.totalPhotos })}
      </button>
    );
  }

  if (drive.indexStatus === "ERROR") {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          mutation.mutate(true);
        }}
        disabled={mutation.isLoading}
        className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 px-2 py-1 rounded-full cursor-pointer transition-colors"
      >
        {t("drives.errorRetry")}
      </button>
    );
  }

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        mutation.mutate(false);
      }}
      disabled={mutation.isLoading}
      className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 px-2 py-1 rounded-full cursor-pointer transition-colors"
    >
      {t("drives.index")}
    </button>
  );
}

export function DrivePickerView() {
  const { t } = useI18n();
  const [synced, setSynced] = useState(false);
  const query = useQuery({
    queryKey: ["drives"],
    queryFn: async () => {
      if (!synced) {
        setSynced(true);
        return syncDrives();
      }
      return listDrives();
    },
    retry: (_, error) => !(error instanceof TokenExpiredError),
    refetchOnWindowFocus: false,
    refetchInterval: (data) =>
      data?.some((d) => d.indexStatus === "INDEXING") ? 2000 : false,
  });
  const { data: drives, isLoading, isError } = query;

  // Auto-redirect when there's only one drive and it's ready
  const didRedirect = useRef(false);
  useEffect(() => {
    if (didRedirect.current || !drives) return;
    const completeDrives = drives.filter((d) => d.indexStatus === "COMPLETE");
    if (drives.length === 1 && completeDrives.length === 1) {
      didRedirect.current = true;
      navigate(`drive/${completeDrives[0].kdriveId}`);
    }
  }, [drives]);

  if (query.error instanceof TokenExpiredError) {
    navigate("token?expired");
  }

  return (
    <>
      <Header breadcrumbs={[{ label: t("drives.breadcrumb"), hash: "drives" }]} />
      <div className="p-6">
        {isLoading && <Spinner />}

        {isError && (
          <div className="text-center py-12">
            <p className="text-red-500 mb-4">{t("drives.error")}</p>
            <button
              onClick={() => logout()}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg cursor-pointer"
            >
              {t("drives.reconnect")}
            </button>
          </div>
        )}

        {drives && drives.length > 0 && (
          <>
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
              {t("drives.select")}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {drives.map((drive) => (
                <div
                  key={drive.id}
                  onClick={() => {
                    if (drive.indexStatus === "COMPLETE") {
                      navigate(`drive/${drive.kdriveId}`);
                    }
                  }}
                  className="flex items-center gap-4 p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer text-left"
                >
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-lg shrink-0"
                    style={{ backgroundColor: drive.color }}
                  >
                    {drive.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-gray-800 dark:text-gray-200 block truncate">
                      {drive.name}
                    </span>
                  </div>
                  <IndexBadge drive={drive} />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}

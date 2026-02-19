import { useState } from "react";
import { downloadPhotosZip } from "../api/files.ts";
import { useI18n } from "../i18n/useI18n.ts";
import { ConfirmModal } from "./ConfirmModal.tsx";

interface SelectionToolbarProps {
  kdriveId: number;
  count: number;
  selectedIds: string[];
  onClear: () => void;
  onDelete: (photoIds: string[]) => Promise<void>;
}

export function SelectionToolbar({ kdriveId, count, selectedIds, onClear, onDelete }: SelectionToolbarProps) {
  const { t } = useI18n();
  const [downloading, setDownloading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadPhotosZip(kdriveId, selectedIds);
    } catch (e) {
      console.error("ZIP download failed", e);
    } finally {
      setDownloading(false);
    }
  };

  const handleConfirmDelete = async () => {
    setDeleting(true);
    try {
      await onDelete(selectedIds);
      setShowConfirm(false);
    } catch (e) {
      console.error("Delete failed", e);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="fixed bottom-0 inset-x-0 z-30 bg-white dark:bg-gray-800 border-t dark:border-gray-700 shadow-lg">
        <div className="flex items-center justify-between px-4 py-3 max-w-screen-xl mx-auto">
          <button
            onClick={onClear}
            className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 cursor-pointer"
          >
            {t("selection.cancel")}
          </button>

          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {t("selection.count", { count })}
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowConfirm(true)}
              className="flex items-center gap-2 bg-red-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-red-700 cursor-pointer"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
              {t("selection.delete", { count })}
            </button>

            <button
              onClick={handleDownload}
              disabled={downloading}
              className="flex items-center gap-2 bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
            >
              {downloading ? (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
              )}
              {t("selection.download", { count })}
            </button>
          </div>
        </div>
      </div>

      {showConfirm && (
        <ConfirmModal
          message={t("delete.confirm", { count })}
          confirmLabel={t("delete.button")}
          onConfirm={handleConfirmDelete}
          onCancel={() => setShowConfirm(false)}
          loading={deleting}
        />
      )}
    </>
  );
}

import { useRef, useState } from "react";
import { useI18n } from "../i18n/useI18n.ts";
import { ConfirmModal } from "./ConfirmModal.tsx";

interface ReindexModalProps {
  onPartial: () => void;
  onFull: () => void;
  onCancel: () => void;
}

export function ReindexModal({ onPartial, onFull, onCancel }: ReindexModalProps) {
  const { t } = useI18n();
  const backdropRef = useRef<HTMLDivElement>(null);
  const [confirmFull, setConfirmFull] = useState(false);

  if (confirmFull) {
    return (
      <ConfirmModal
        message={t("gallery.reindexModal.fullConfirm")}
        confirmLabel={t("gallery.reindexModal.fullConfirmButton")}
        onConfirm={onFull}
        onCancel={() => setConfirmFull(false)}
      />
    );
  }

  return (
    <div
      ref={backdropRef}
      onClick={(e) => e.target === backdropRef.current && onCancel()}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
    >
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">
          {t("gallery.reindexModal.title")}
        </h3>
        <div className="flex flex-col gap-2">
          <button
            onClick={onPartial}
            className="w-full text-left px-4 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
          >
            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {t("gallery.reindexModal.partial")}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {t("gallery.reindexModal.partialDesc")}
            </div>
          </button>
          <button
            onClick={() => setConfirmFull(true)}
            className="w-full text-left px-4 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
          >
            <div className="text-sm font-medium text-red-600 dark:text-red-400">
              {t("gallery.reindexModal.full")}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {t("gallery.reindexModal.fullDesc")}
            </div>
          </button>
        </div>
        <div className="flex justify-end mt-4">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg cursor-pointer"
          >
            {t("gallery.reindexModal.cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}

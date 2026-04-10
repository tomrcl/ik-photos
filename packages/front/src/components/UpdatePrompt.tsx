import { useRegisterSW } from "virtual:pwa-register/react";
import { useI18n } from "../i18n/useI18n.ts";

export function UpdatePrompt() {
  const { t } = useI18n();
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(error) {
      console.error("SW registration error", error);
    },
  });

  if (!needRefresh) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium bg-gray-800 text-white flex items-center gap-3">
      <span>{t("pwa.updateAvailable")}</span>
      <button
        onClick={() => updateServiceWorker(true)}
        className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-1 px-3 rounded cursor-pointer"
      >
        {t("pwa.update")}
      </button>
      <button
        onClick={() => setNeedRefresh(false)}
        className="text-gray-300 hover:text-white cursor-pointer"
        aria-label={t("pwa.dismiss")}
      >
        &times;
      </button>
    </div>
  );
}

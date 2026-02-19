import { useEffect } from "react";

export interface ToastData {
  message: string;
  type: "info" | "success" | "error";
}

export function Toast({ toast, onDismiss }: { toast: ToastData; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, toast.type === "error" ? 6000 : 4000);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  const colors = {
    info: "bg-gray-800 text-white",
    success: "bg-green-600 text-white",
    error: "bg-red-600 text-white",
  };

  return (
    <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium animate-fade-in ${colors[toast.type]}`}>
      {toast.message}
    </div>
  );
}

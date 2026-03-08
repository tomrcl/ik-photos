import { useRef, useState, useEffect, useCallback, type MouseEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { thumbnailUrl } from "../api/files.ts";

interface PhotoCardProps {
  kdriveId: number;
  photoId: string;
  fileName: string;
  mediaType?: string;
  onClick: () => void;
  isSelected?: boolean;
  selectionActive?: boolean;
  onSelect?: (photoId: string, shiftKey: boolean) => void;
}

const LONG_PRESS_MS = 400;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

export function PhotoCard({
  kdriveId,
  photoId,
  fileName,
  mediaType,
  onClick,
  isSelected,
  selectionActive,
  onSelect,
}: PhotoCardProps) {
  const queryClient = useQueryClient();
  const cacheBusters = queryClient.getQueryData<Record<string, number>>(["cacheBusters"]) ?? {};
  const buster = cacheBusters[photoId];
  const thumbUrl = buster ? `${thumbnailUrl(kdriveId, photoId)}&_t=${buster}` : thumbnailUrl(kdriveId, photoId);

  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPress = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "400px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Clean up retry timer
  useEffect(() => {
    return () => { if (retryTimer.current) clearTimeout(retryTimer.current); };
  }, []);

  const handleImgLoad = useCallback(() => setLoaded(true), []);

  const handleImgError = useCallback(() => {
    if (retryCount < MAX_RETRIES) {
      retryTimer.current = setTimeout(() => {
        setRetryCount((c) => c + 1);
      }, RETRY_DELAY_MS);
    }
  }, [retryCount]);

  const clearLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handlePointerDown = useCallback(() => {
    didLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      didLongPress.current = true;
      onSelect?.(photoId, false);
    }, LONG_PRESS_MS);
  }, [onSelect, photoId]);

  const handlePointerUp = useCallback(() => {
    clearLongPress();
  }, [clearLongPress]);

  const handlePointerLeave = useCallback(() => {
    clearLongPress();
  }, [clearLongPress]);

  const handleClick = (e: MouseEvent) => {
    // Long-press already triggered selection
    if (didLongPress.current) {
      didLongPress.current = false;
      return;
    }

    if (selectionActive || e.shiftKey) {
      e.preventDefault();
      onSelect?.(photoId, e.shiftKey);
    } else {
      onClick();
    }
  };

  // Click on the checkbox circle directly enters selection
  const handleCheckClick = (e: MouseEvent) => {
    e.stopPropagation();
    onSelect?.(photoId, e.shiftKey);
  };

  return (
    <div
      ref={ref}
      className={`relative aspect-square bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden cursor-pointer group ${
        isSelected ? "ring-3 ring-blue-500" : ""
      }`}
      title={fileName}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
    >
      {/* Skeleton placeholder while loading */}
      {!loaded && (
        <div className="absolute inset-0 bg-gray-300 dark:bg-gray-600 animate-pulse flex items-center justify-center">
          {mediaType === "video" ? (
            <svg className="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
            </svg>
          ) : (
            <svg className="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21ZM10.5 8.25a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
            </svg>
          )}
        </div>
      )}

      {visible && (
        <img
          key={retryCount}
          src={thumbUrl}
          alt={fileName}
          draggable={false}
          onLoad={handleImgLoad}
          onError={handleImgError}
          className={`w-full h-full object-cover transition-transform ${
            isSelected ? "scale-90 rounded-lg" : ""
          }${loaded ? "" : " opacity-0"}`}
        />
      )}

      {/* Play icon overlay for videos */}
      {mediaType === "video" && loaded && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center">
            <svg className="w-5 h-5 text-white ml-0.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      )}

      {/* Checkmark when selected */}
      {isSelected && (
        <div
          className="absolute top-1.5 left-1.5 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center shadow cursor-pointer"
          onClick={handleCheckClick}
        >
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" strokeWidth="3" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
      )}

      {/* Empty circle on hover — always visible, clicking it enters selection */}
      {!isSelected && (
        <div
          className={`absolute top-1.5 left-1.5 w-6 h-6 rounded-full border-2 border-white/80 transition-opacity shadow cursor-pointer ${
            selectionActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
          onClick={handleCheckClick}
        />
      )}
    </div>
  );
}

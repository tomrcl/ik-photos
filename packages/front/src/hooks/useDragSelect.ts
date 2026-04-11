import { useCallback, useEffect, useRef, useState } from "react";

export interface DragRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface UseDragSelectOptions {
  /** Current selection set (used as base for additive drag) */
  currentSelection: Set<string>;
  /** Called with the new full selection set during and after drag */
  onSelectionChange: (ids: Set<string>) => void;
  /** Whether drag-select is enabled (defaults to true) */
  enabled?: boolean;
}

const DRAG_THRESHOLD = 5;

function rectsIntersect(
  a: { left: number; top: number; right: number; bottom: number },
  b: { left: number; top: number; right: number; bottom: number },
): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

/**
 * Hook that provides drag-to-select functionality for a photo gallery.
 * Listens on the window for mouse events. When the user clicks on
 * non-interactive gallery background and drags more than DRAG_THRESHOLD px,
 * a selection rectangle is drawn and all [data-photo-id] elements
 * intersecting it are selected.
 *
 * Only activates on non-touch (fine pointer) devices.
 */
export function useDragSelect({
  currentSelection,
  onSelectionChange,
  enabled = true,
}: UseDragSelectOptions) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragRect, setDragRect] = useState<DragRect | null>(null);

  // Refs to avoid stale closures in event handlers
  const isDraggingRef = useRef(false);
  const startPointRef = useRef<{ x: number; y: number } | null>(null);
  const dragStartedRef = useRef(false);
  const baseSelectionRef = useRef<Set<string>>(new Set());
  const currentSelectionRef = useRef(currentSelection);
  const onSelectionChangeRef = useRef(onSelectionChange);

  // Keep refs up to date
  useEffect(() => {
    currentSelectionRef.current = currentSelection;
  }, [currentSelection]);
  useEffect(() => {
    onSelectionChangeRef.current = onSelectionChange;
  }, [onSelectionChange]);

  const isInteractiveElement = useCallback((el: HTMLElement): boolean => {
    const tag = el.tagName.toLowerCase();
    if (["button", "a", "input", "select", "textarea"].includes(tag)) return true;
    if (el.getAttribute("role") === "button") return true;
    if (el.closest("button, a, [role=button]")) return true;
    // Don't start drag from inside photo cards -- let normal click/selection through.
    // Drag should only start from grid gaps and gallery background.
    if (el.closest("[data-photo-id]")) return true;
    return false;
  }, []);

  const getIntersectingPhotoIds = useCallback((rect: DragRect): string[] => {
    const selRect = {
      left: rect.x,
      top: rect.y,
      right: rect.x + rect.width,
      bottom: rect.y + rect.height,
    };

    const photoEls = document.querySelectorAll<HTMLElement>("[data-photo-id]");
    const ids: string[] = [];

    for (const el of photoEls) {
      const elRect = el.getBoundingClientRect();
      const elBounds = {
        left: elRect.left,
        top: elRect.top,
        right: elRect.right,
        bottom: elRect.bottom,
      };
      if (rectsIntersect(selRect, elBounds)) {
        const id = el.getAttribute("data-photo-id");
        if (id) ids.push(id);
      }
    }

    return ids;
  }, []);

  const computeDragRect = useCallback(
    (startX: number, startY: number, currentX: number, currentY: number): DragRect => {
      const x = Math.min(startX, currentX);
      const y = Math.min(startY, currentY);
      const width = Math.abs(currentX - startX);
      const height = Math.abs(currentY - startY);
      return { x, y, width, height };
    },
    [],
  );

  useEffect(() => {
    if (!enabled) return;

    // Only activate on non-touch devices
    if (window.matchMedia("(pointer: coarse)").matches) return;

    const handleMouseDown = (e: MouseEvent) => {
      // Only left mouse button
      if (e.button !== 0) return;

      // Don't interfere with interactive elements or photo cards
      if (isInteractiveElement(e.target as HTMLElement)) return;
      // Only start drag from within the gallery area
      if (!(e.target as HTMLElement).closest("[data-drag-select-area]")) return;

      startPointRef.current = { x: e.clientX, y: e.clientY };
      dragStartedRef.current = false;
      // Snapshot current selection as the base for this drag
      baseSelectionRef.current = new Set(currentSelectionRef.current);
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!startPointRef.current) return;

      const dx = e.clientX - startPointRef.current.x;
      const dy = e.clientY - startPointRef.current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (!dragStartedRef.current) {
        if (distance < DRAG_THRESHOLD) return;
        dragStartedRef.current = true;
        isDraggingRef.current = true;
        setIsDragging(true);
      }

      const rect = computeDragRect(
        startPointRef.current.x,
        startPointRef.current.y,
        e.clientX,
        e.clientY,
      );
      setDragRect(rect);

      // Find intersecting photo IDs and merge with base selection
      const draggedIds = getIntersectingPhotoIds(rect);
      const merged = new Set(baseSelectionRef.current);
      for (const id of draggedIds) merged.add(id);
      onSelectionChangeRef.current(merged);

      // Prevent text selection during drag
      e.preventDefault();
    };

    const handleMouseUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        setIsDragging(false);
        setDragRect(null);
      }
      startPointRef.current = null;
      dragStartedRef.current = false;
    };

    window.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [enabled, isInteractiveElement, computeDragRect, getIntersectingPhotoIds]);

  return { isDragging, dragRect };
}

import { useId, useRef, useState, type PointerEvent, type WheelEvent } from 'react';

interface Viewport {
  scale: number;
  offset: number;
}

export function useChartViewport(viewWidth: number, plotLeft: number, plotRight: number) {
  const [viewport, setViewport] = useState<Viewport>({ scale: 1, offset: 0 });
  const viewportRef = useRef(viewport);
  const dragRef = useRef<{ pointerId: number; startX: number; startOffset: number } | null>(null);
  const clipId = `chart-plot-${useId().replace(/:/g, '')}`;

  const updateViewport = (update: (current: Viewport) => Viewport) => {
    setViewport((current) => {
      const next = update(current);
      viewportRef.current = next;
      return next;
    });
  };

  const clampOffset = (offset: number, scale: number) => (
    Math.min(plotLeft * (1 - scale), Math.max(plotRight * (1 - scale), offset))
  );

  const onWheel = (event: WheelEvent<SVGSVGElement>) => {
    const current = viewportRef.current;
    if ((event.deltaY > 0 && current.scale <= 1) || (event.deltaY < 0 && current.scale >= 8)) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (!bounds.width) return;
    event.preventDefault();
    const anchor = ((event.clientX - bounds.left) / bounds.width) * viewWidth;
    const factor = Math.exp(-event.deltaY * 0.002);
    updateViewport((currentViewport) => {
      const scale = Math.min(8, Math.max(1, currentViewport.scale * factor));
      const offset = scale === 1
        ? 0
        : clampOffset(anchor - (anchor - currentViewport.offset) * (scale / currentViewport.scale), scale);
      return { scale, offset };
    });
  };

  const onPointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (viewportRef.current.scale <= 1 || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startOffset: viewportRef.current.offset,
    };
  };

  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (!bounds.width) return;
    const delta = ((event.clientX - drag.startX) / bounds.width) * viewWidth;
    updateViewport((current) => ({
      ...current,
      offset: clampOffset(drag.startOffset + delta, current.scale),
    }));
  };

  const onPointerUp = (event: PointerEvent<SVGSVGElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return {
    mapX: (x: number) => viewport.offset + x * viewport.scale,
    clipId,
    onWheel,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel: onPointerUp,
    cursorClass: viewport.scale > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-zoom-in',
  };
}

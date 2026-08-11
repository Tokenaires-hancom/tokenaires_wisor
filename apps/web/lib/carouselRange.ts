export function getCarouselRange(
  scrollLeft: number,
  clientWidth: number,
  step: number,
  total: number,
) {
  if (step <= 0 || total <= 0) return { start: 0, end: 0 };

  const start = Math.min(total - 1, Math.max(0, Math.floor(scrollLeft / step)));
  const end = Math.min(
    total - 1,
    Math.max(start, Math.ceil((scrollLeft + clientWidth) / step) - 1),
  );

  return { start, end };
}

export function formatCarouselRange(start: number, end: number) {
  return start === end ? String(start + 1) : `${start + 1}-${end + 1}`;
}

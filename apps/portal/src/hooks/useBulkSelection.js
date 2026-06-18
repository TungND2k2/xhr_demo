import { useCallback, useMemo, useState } from 'react';

/**
 * useBulkSelection — quản lý multi-select bằng Set<id>.
 *
 * API:
 *  - selected: Set<string>
 *  - count: number
 *  - has(id): bool
 *  - toggle(id): flip 1 id
 *  - setAll(ids): chọn hết
 *  - clear(): bỏ chọn hết
 *  - isAllSelected(ids): bool — tất cả ids đã chọn
 *  - someSelected(ids): bool — có ít nhất 1 đã chọn trong ids
 */
export default function useBulkSelection() {
  const [selected, setSelected] = useState(() => new Set());

  const toggle = useCallback((id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const setAll = useCallback((ids) => {
    setSelected(new Set(ids));
  }, []);

  const clear = useCallback(() => {
    setSelected(new Set());
  }, []);

  const has = useCallback((id) => selected.has(id), [selected]);

  const isAllSelected = useCallback(
    (ids) => ids.length > 0 && ids.every((id) => selected.has(id)),
    [selected],
  );

  const someSelected = useCallback(
    (ids) => ids.some((id) => selected.has(id)),
    [selected],
  );

  const count = selected.size;

  return useMemo(
    () => ({ selected, count, has, toggle, setAll, clear, isAllSelected, someSelected }),
    [selected, count, has, toggle, setAll, clear, isAllSelected, someSelected],
  );
}

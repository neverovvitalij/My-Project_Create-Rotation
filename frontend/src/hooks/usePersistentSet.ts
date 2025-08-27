import { useEffect, useState } from 'react';

export function usePersistentSet(key: string, initial: string[] = []) {
  const [set, setSet] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set(initial);
    try {
      const raw = localStorage.getItem(key);
      return new Set(raw ? (JSON.parse(raw) as string[]) : initial);
    } catch {
      return new Set(initial);
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify([...set]));
    } catch {}
  }, [key, set]);

  const has = (v: string) => set.has(v);
  const toggle = (v: string) =>
    setSet((prev) => {
      const next = new Set(prev);
      next.has(v) ? next.delete(v) : next.add(v);
      return next;
    });

  return { set, setSet, has, toggle };
}

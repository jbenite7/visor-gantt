"use client";

import { useState, useCallback } from "react";

/**
 * SSR-safe localStorage hook.
 *
 * On the server (or before hydration), returns `defaultValue` immediately.
 * On the client, reads from localStorage on mount and persists on set.
 * Handles JSON parse errors gracefully by falling back to defaultValue.
 */
export function useLocalStorage<T>(
  key: string,
  defaultValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === "undefined") return defaultValue;
    try {
      const item = window.localStorage.getItem(key);
      if (item !== null) {
        return JSON.parse(item) as T;
      }
    } catch (error) {
      // JSON parse error or other localStorage issue — keep defaultValue
      console.warn(`[useLocalStorage] Failed to read "${key}":`, error);
    }
    return defaultValue;
  });

  // Setter: update state AND write to localStorage
  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      setStoredValue((prev) => {
        const nextValue = value instanceof Function ? value(prev) : value;

        if (typeof window !== "undefined") {
          try {
            window.localStorage.setItem(key, JSON.stringify(nextValue));
          } catch (error) {
            console.warn(`[useLocalStorage] Failed to write "${key}":`, error);
          }
        }

        return nextValue;
      });
    },
    [key]
  );

  return [storedValue, setValue];
}

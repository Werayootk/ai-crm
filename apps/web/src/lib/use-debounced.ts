'use client';

import { useEffect, useState } from 'react';

/** ค่าที่อัปเดตหลังผู้ใช้หยุดพิมพ์ — ลดจำนวน request ตอนค้นหา */
export function useDebounced<T>(value: T, delayMs = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

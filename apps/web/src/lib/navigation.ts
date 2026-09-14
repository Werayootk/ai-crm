export const HOME_PATH = '/leads';

/**
 * ปลายทางหลัง login — รับเฉพาะ path ภายในเว็บเท่านั้น
 * กัน open redirect เช่น ?next=https://evil.example หรือ ?next=//evil.example
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) {
    return HOME_PATH;
  }
  if (next.startsWith('/login')) return HOME_PATH;
  return next;
}

export function loginPath(currentPath: string): string {
  return `/login?next=${encodeURIComponent(currentPath)}`;
}

// ระหว่าง logout query ที่ยังค้างอยู่อาจได้ 401 — ห้ามให้ตัวจัดการ 401 พาไปหน้า login ซ้อนกับการ logout
let loggingOut = false;

export function beginLogout(): void {
  loggingOut = true;
}

export function isLoggingOut(): boolean {
  return loggingOut;
}

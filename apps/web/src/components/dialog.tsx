'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';

/**
 * modal จาก <dialog> ของ browser: focus trap, ปุ่ม Esc และ backdrop มาให้เอง
 * ควบคุมด้วย prop `open` จากภายนอก
 */
export function Dialog({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        // คลิกที่ backdrop (ตัว dialog เอง ไม่ใช่เนื้อหาข้างใน) = ปิด
        if (event.target === ref.current) onClose();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-xl bg-white p-0 shadow-xl"
    >
      <div className="p-5">
        <h2 id={titleId} className="mb-4 text-base font-semibold text-slate-900">
          {title}
        </h2>
        {open ? children : null}
      </div>
    </dialog>
  );
}

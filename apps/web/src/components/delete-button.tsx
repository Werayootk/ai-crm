'use client';

import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { errorMessage } from '@/lib/api';
import { useCurrentUser } from './app-shell';
import { Dialog } from './dialog';
import { useToast } from './toast';
import { Button } from './ui';

/** ลบได้เฉพาะ ADMIN — API ปฏิเสธเองถ้ายังมีข้อมูลอื่นอ้างอิงอยู่ (409) */
export function AdminDeleteButton({
  label,
  description,
  onDelete,
  onDeleted,
}: {
  label: string;
  description: string;
  onDelete: () => Promise<void>;
  onDeleted: () => void;
}) {
  const user = useCurrentUser();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const remove = useMutation({
    mutationFn: onDelete,
    onSuccess: () => {
      toast.success('ลบแล้ว');
      onDeleted();
    },
    onError: (error) => {
      setOpen(false);
      toast.error(errorMessage(error));
    },
  });

  if (user.role !== 'ADMIN') return null;

  return (
    <>
      <Button variant="secondary" className="text-rose-700" onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={label}>
        <p className="text-sm text-slate-600">{description}</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setOpen(false)}>
            ยกเลิก
          </Button>
          <Button variant="danger" loading={remove.isPending} onClick={() => remove.mutate()}>
            ยืนยันการลบ
          </Button>
        </div>
      </Dialog>
    </>
  );
}

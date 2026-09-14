import type { Metadata } from 'next';
import { ContactForm } from './contact-form';

export const metadata: Metadata = { title: 'ติดต่อเรา' };

/** หน้าสาธารณะ (ไม่ต้อง login) — lead ที่ส่งจากหน้านี้เข้า CRM เป็น source "เว็บไซต์" */
export default function ContactUsPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="mb-8 text-center">
          <p className="text-2xl font-semibold tracking-tight text-slate-900">ติดต่อเรา</p>
          <p className="mt-1 text-sm text-slate-500">
            บอกเราว่าต้องการทำอะไร ทีมงานจะติดต่อกลับภายในวันทำการถัดไป
          </p>
        </div>
        <ContactForm />
      </div>
    </main>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useKalenderStore } from '@/lib/store';
import PasswordLock from '@/components/PasswordLock';
import KalenderApp from '@/components/KalenderApp';

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const isAuthenticated = useKalenderStore((s) => s.isAuthenticated);

  useEffect(() => { setMounted(true); }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-blue-950 flex items-center justify-center">
        <div className="text-blue-200 text-sm">Wird geladen…</div>
      </div>
    );
  }

  return isAuthenticated ? <KalenderApp /> : <PasswordLock />;
}

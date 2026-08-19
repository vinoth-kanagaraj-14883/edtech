'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Spinner } from '@/components/Feedback';

export default function LogoutButton() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogout = async () => {
    try {
      setLoading(true);
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });
      router.push('/login');
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <button type="button" onClick={handleLogout} className="ghost-button" disabled={loading} aria-label="Sign out">
      {loading ? (
        <>
          <Spinner className="h-3.5 w-3.5" />
          Signing out…
        </>
      ) : (
        <>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 17l5-5-5-5M20 12H9M12 19H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h6" />
          </svg>
          Logout
        </>
      )}
    </button>
  );
}

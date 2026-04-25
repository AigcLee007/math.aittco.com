import React, { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuthStore } from '~/common/stores/auth/useAuthStore';

const PUBLIC_PATHS = ['/auth'];

export const RouteGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const router = useRouter();
  const { accessToken } = useAuthStore();
  const isLoggedIn = !!accessToken;

  useEffect(() => {
    const path = router.pathname;
    
    // Redirect to /auth if NOT logged in and trying to access a protected route
    if (!isLoggedIn && !PUBLIC_PATHS.includes(path)) {
      void router.push('/auth');
    }
    
    // Redirect to / (home) if logged in and trying to access /auth
    if (isLoggedIn && path === '/auth') {
      void router.push('/');
    }
  }, [isLoggedIn, router.pathname, router]);

  // If not logged in and not on a public path, don't render children (avoid flash of protected content)
  if (!isLoggedIn && !PUBLIC_PATHS.includes(router.pathname)) {
    return null; 
  }

  return <>{children}</>;
};

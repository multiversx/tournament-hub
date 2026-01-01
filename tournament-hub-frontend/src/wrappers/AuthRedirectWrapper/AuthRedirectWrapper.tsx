import { PropsWithChildren, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useGetIsLoggedIn } from 'lib';
import { RouteNamesEnum } from 'localConstants';

export const AuthRedirectWrapper = ({ children }: PropsWithChildren) => {
  const isLoggedIn = useGetIsLoggedIn();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // Define protected routes directly to avoid circular dependency
  const protectedRoutes = [
    '/dashboard',
    '/tournaments/create',
    '/game/'
  ];

  const requireAuth = protectedRoutes.some(route => pathname.startsWith(route));

  useEffect(() => {
    if (!isLoggedIn && requireAuth) {
      navigate(RouteNamesEnum.home);
    }
  }, [isLoggedIn, requireAuth, navigate]);

  return <>{children}</>;
};

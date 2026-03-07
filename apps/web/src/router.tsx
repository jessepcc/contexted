import { createRootRoute, createRoute, createRouter, redirect, Outlet } from '@tanstack/react-router';
import { createElement, useState } from 'react';
import { AppContext } from './AppContext.js';
import type { AppState } from './AppContext.js';
import { RootLayout } from './components/RootLayout.js';
import { LandingPage } from './pages/LandingPage.js';
import { LoginPage } from './pages/LoginPage.js';
import { VerifyPage } from './pages/VerifyPage.js';
import { AppGatewayPage } from './pages/AppGatewayPage.js';
import { UploadPage } from './pages/UploadPage.js';
import { ProcessingPage } from './pages/ProcessingPage.js';
import { PreferencesPage } from './pages/PreferencesPage.js';
import { WaitingPage } from './pages/WaitingPage.js';
import { RevealPage } from './pages/RevealPage.js';
import { ChatPage } from './pages/ChatPage.js';
import { ExpiredPage } from './pages/ExpiredPage.js';
import { ErrorPage } from './pages/ErrorPage.js';

function AppLayout() {
  const [appState, setAppState] = useState<AppState | null>(null);
  return createElement(
    AppContext.Provider,
    { value: { appState, setAppState } },
    createElement(Outlet)
  );
}

const rootRoute = createRootRoute({ component: RootLayout });

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: LandingPage
});

const authLoginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/auth/login',
  component: LoginPage
});

const authVerifyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/auth/verify',
  component: VerifyPage
});

const appLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/app',
  component: AppLayout,
  beforeLoad: () => {
    if (!localStorage.getItem('contexted_token')) {
      throw redirect({ to: '/auth/login' });
    }
  }
});

const appIndexRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/',
  component: AppGatewayPage
});

const appUploadRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/upload',
  component: UploadPage
});

const appProcessingRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/processing',
  component: ProcessingPage,
  validateSearch: (search: Record<string, unknown>) => ({
    jobId: (search.jobId as string) ?? ''
  })
});

const appPreferencesRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/preferences',
  component: PreferencesPage
});

const appWaitingRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/waiting',
  component: WaitingPage
});

const appRevealRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/reveal',
  component: RevealPage
});

const appChatRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/chat',
  component: ChatPage
});

const appExpiredRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/expired',
  component: ExpiredPage
});

const appErrorRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/error',
  component: ErrorPage
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  authLoginRoute,
  authVerifyRoute,
  appLayoutRoute.addChildren([
    appIndexRoute,
    appUploadRoute,
    appProcessingRoute,
    appPreferencesRoute,
    appWaitingRoute,
    appRevealRoute,
    appChatRoute,
    appExpiredRoute,
    appErrorRoute
  ])
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

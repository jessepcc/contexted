import { createRootRoute, createRoute, createRouter, redirect, Outlet, lazyRouteComponent } from '@tanstack/react-router';
import { createElement, useState } from 'react';
import { AppContext } from './AppContext.js';
import type { AppState } from './AppContext.js';
import { RootLayout } from './components/RootLayout.js';

const LandingPage = lazyRouteComponent(() => import('./pages/LandingPage.js'), 'LandingPage');
const LoginPage = lazyRouteComponent(() => import('./pages/LoginPage.js'), 'LoginPage');
const VerifyPage = lazyRouteComponent(() => import('./pages/VerifyPage.js'), 'VerifyPage');
const AppGatewayPage = lazyRouteComponent(() => import('./pages/AppGatewayPage.js'), 'AppGatewayPage');
const UploadPage = lazyRouteComponent(() => import('./pages/UploadPage.js'), 'UploadPage');
const ProcessingPage = lazyRouteComponent(() => import('./pages/ProcessingPage.js'), 'ProcessingPage');
const PreferencesPage = lazyRouteComponent(() => import('./pages/PreferencesPage.js'), 'PreferencesPage');
const WaitingPage = lazyRouteComponent(() => import('./pages/WaitingPage.js'), 'WaitingPage');
const RevealPage = lazyRouteComponent(() => import('./pages/RevealPage.js'), 'RevealPage');
const ChatPage = lazyRouteComponent(() => import('./pages/ChatPage.js'), 'ChatPage');
const ExpiredPage = lazyRouteComponent(() => import('./pages/ExpiredPage.js'), 'ExpiredPage');
const ErrorPage = lazyRouteComponent(() => import('./pages/ErrorPage.js'), 'ErrorPage');

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

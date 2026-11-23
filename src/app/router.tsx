// The editor's pages, under /editor/: the mods in this browser, the reference,
// and a mod's workspace (/p/<project>/...: its overview, its items by kind,
// art, translations, package, test, publish). The pages used less often are
// loaded when first opened.
import { createBrowserRouter, RouterProvider } from 'react-router';
import { HomePage } from '@/pages/home';
import { ItemsPage } from '@/pages/items';
import { NotFoundPage } from '@/pages/not-found';
import { OverviewPage } from '@/pages/overview';
import { Workspace } from '@/widgets/workspace';
import { BASE } from '@/shared/config';

const router = createBrowserRouter([
  { path: '/', element: <HomePage /> },
  { path: '/reference', lazy: async () => ({ Component: (await import('@/pages/reference')).ReferencePage }) },
  {
    path: '/p/:pid',
    element: <Workspace />,
    children: [
      { index: true, element: <OverviewPage /> },
      { path: 'art', lazy: async () => ({ Component: (await import('@/pages/art')).ArtPage }) },
      { path: 'art/:asset', lazy: async () => ({ Component: (await import('@/pages/art')).ArtPage }) },
      { path: 'translations', lazy: async () => ({ Component: (await import('@/pages/translations')).TranslationsPage }) },
      { path: 'package', lazy: async () => ({ Component: (await import('@/pages/package')).PackagePage }) },
      { path: 'test', lazy: async () => ({ Component: (await import('@/pages/test')).TestPage }) },
      { path: 'publish', lazy: async () => ({ Component: (await import('@/pages/publish')).PublishPage }) },
      { path: ':kind', element: <ItemsPage /> },
      { path: ':kind/:index', element: <ItemsPage /> },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
], { basename: BASE || '/' });

export function Router() {
  return <RouterProvider router={router} />;
}

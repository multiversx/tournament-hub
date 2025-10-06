import { Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import { PageNotFound } from 'pages/PageNotFound/PageNotFound';
import { routes } from 'routes';
import { AxiosInterceptors, BatchTransactionsContextProvider } from 'wrappers';
import { Layout } from './components';
import { WalletProvider } from './contexts/WalletContext';
import { GamingNotificationManager } from './components/GamingNotification';

export const App = () => {
  return (
    <Router>
      <AxiosInterceptors>
        <BatchTransactionsContextProvider>
          <WalletProvider>
            <Layout>
              <GamingNotificationManager />
              <Routes>
                {routes.map((route) => (
                  <Route
                    key={`route-key-${route.path}`}
                    path={route.path}
                    element={<route.component />}
                  >
                    {route.children?.map((child) => (
                      <Route
                        key={`route-key-${route.path}-${child.path}`}
                        path={child.path}
                        element={<child.component />}
                      />
                    ))}
                  </Route>
                ))}
                <Route path='*' element={<PageNotFound />} />
              </Routes>
            </Layout>
          </WalletProvider>
        </BatchTransactionsContextProvider>
      </AxiosInterceptors>
    </Router>
  );
};

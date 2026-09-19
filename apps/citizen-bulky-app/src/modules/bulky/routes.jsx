import { useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { BulkyBookingPage } from './pages/BulkyBookingPage.jsx';
import { BulkyQuotePage } from './pages/BulkyQuotePage.jsx';
import { BulkyPaymentPage } from './pages/BulkyPaymentPage.jsx';
import { BulkyOrdersPage } from './pages/BulkyOrdersPage.jsx';
import { BulkyOrderDetailPage } from './pages/BulkyOrderDetailPage.jsx';
import { BulkyHeader } from './components/BulkyHeader.jsx';
import { createMockBulkyServices } from './services/mock/createMockBulkyServices.js';
import { createBulkyThunks } from './store/index.js';
import { setBulkyCapabilities } from './store/bulkySlice.js';
import { BULKY_PERSONAS } from './services/bulkyServiceContract.js';

import { createTheme, ThemeProvider } from '@mui/material/styles';
import { Box } from '@mui/material';

const defaultHousehold = {
  id: 'hh-demo-1',
  name: 'Hộ gia đình Lê Quốc Anh',
  serviceLocations: [
    {
      id: 'loc-1',
      address: '123 Nguyễn Trãi, Phường 3, Quận 5, TP.HCM',
      latitude: 10.756,
      longitude: 106.678,
      serviceArea: { code: 'D5', name: 'Quận 5' },
    },
  ],
};

const createPersonaServices = (persona) =>
  createMockBulkyServices({
    userId: persona.id,
    membershipResolver: async () => ({
      status: 'ACTIVE',
      capabilities: persona.capabilities,
      household: defaultHousehold,
    }),
  });

export const bulkyLightTheme = createTheme({
  palette: {
    mode: 'light',
    background: {
      default: '#f8fafc',
      paper: '#ffffff',
    },
    primary: {
      main: '#1d4ed8',
      light: '#3b82f6',
      dark: '#1e40af',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#64748b',
      contrastText: '#ffffff',
    },
    text: {
      primary: '#0f172a',
      secondary: '#64748b',
    },
    divider: '#e2e8f0',
    action: {
      hover: '#f1f5f9',
      selected: '#eff6ff',
    },
    success: {
      main: '#16a34a',
      light: '#4ade80',
      dark: '#15803d',
      contrastText: '#ffffff',
    },
    error: {
      main: '#dc2626',
      light: '#f87171',
      dark: '#b91c1c',
      contrastText: '#ffffff',
    },
    warning: {
      main: '#d97706',
      light: '#fde047',
      dark: '#b45309',
      contrastText: '#ffffff',
    },
  },
  typography: {
    fontFamily: "'Inter', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: '#ffffff',
          borderColor: '#e2e8f0',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: '#ffffff',
        },
      },
    },
  },
});

function BulkyRouteWrapper({ Component }) {
  const dispatch = useDispatch();
  const activeUserId = useSelector((state) => state.bulky?.activeUser?.id);
  const persona = BULKY_PERSONAS.find((user) => user.id === activeUserId) || BULKY_PERSONAS[0];
  const defaultServices = useMemo(() => createPersonaServices(persona), [persona]);
  const defaultThunks = useMemo(() => createBulkyThunks(defaultServices), [defaultServices]);

  useEffect(() => {
    dispatch(setBulkyCapabilities(persona.capabilities));
    dispatch(defaultThunks.fetchCatalog()).catch(() => {});
    dispatch(defaultThunks.fetchOrders()).catch(() => {});
    dispatch(defaultThunks.fetchNotifications()).catch(() => {});
  }, [dispatch, defaultThunks, persona]);

  return (
    <ThemeProvider theme={bulkyLightTheme}>
      <Box
        sx={{
          minHeight: '100vh',
          width: '100%',
          backgroundColor: '#f8fafc',
          color: '#0f172a',
        }}
      >
        <BulkyHeader thunks={defaultThunks} />
        <Component services={defaultServices} thunks={defaultThunks} />
      </Box>
    </ThemeProvider>
  );
}

export const bulkyRoutes = [
  {
    path: '/bulky/booking',
    element: <BulkyRouteWrapper Component={BulkyBookingPage} />,
  },
  {
    path: '/bulky/quote/:orderId',
    element: <BulkyRouteWrapper Component={BulkyQuotePage} />,
  },
  {
    path: '/bulky/payment/:orderId',
    element: <BulkyRouteWrapper Component={BulkyPaymentPage} />,
  },
  {
    path: '/bulky/orders',
    element: <BulkyRouteWrapper Component={BulkyOrdersPage} />,
  },
  {
    path: '/bulky/orders/:orderId',
    element: <BulkyRouteWrapper Component={BulkyOrderDetailPage} />,
  },
];

export default bulkyRoutes;

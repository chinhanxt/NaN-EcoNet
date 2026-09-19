// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import { BulkyOrdersPage } from './BulkyOrdersPage.jsx';
import { bulkyReducer } from '../store/bulkySlice.js';
import { BULKY_CAPABILITIES } from '../services/bulkyServiceContract.js';
import { ORDER_STATUS } from '../domain/constants.js';

afterEach(() => {
  cleanup();
});

function renderWithStore(ui, { initialState = {} } = {}) {
  const store = configureStore({
    reducer: {
      bulky: bulkyReducer,
    },
    preloadedState: {
      bulky: {
        capabilities: [
          BULKY_CAPABILITIES.VIEW_BULKY_ORDERS,
          BULKY_CAPABILITIES.MANAGE_BULKY_ORDERS,
        ],
        catalog: [],
        draft: null,
        ordersById: {},
        orderIds: [],
        quotesById: {},
        holdsById: {},
        paymentsById: {},
        refundsById: {},
        changeRequestsById: {},
        latePaymentResolutionsById: {},
        pagination: { cursor: null, hasMore: false },
        requestsByKey: {},
        activeRequestContexts: {},
        ...initialState,
      },
    },
  });

  return {
    store,
    ...render(
      <Provider store={store}>
        <MemoryRouter>{ui}</MemoryRouter>
      </Provider>,
    ),
  };
}

describe('BulkyOrdersPage', () => {
  it('renders empty state when there are no orders', () => {
    renderWithStore(<BulkyOrdersPage />);

    expect(screen.getByText(/Chưa có đơn thu gom rác cồng kềnh nào/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tạo yêu cầu mới/i })).toBeInTheDocument();
  });

  it('renders order list with separate status tags and details', () => {
    renderWithStore(<BulkyOrdersPage />, {
      initialState: {
        orderIds: ['ord-1', 'ord-2'],
        ordersById: {
          'ord-1': {
            orderId: 'ord-1',
            orderStatus: ORDER_STATUS.CONFIRMED,
            requestedDate: '2026-09-20',
            serviceLocation: { address: '123 Nguyen Trai, Q5' },
            acceptedQuote: { totalVnd: 150000 },
          },
          'ord-2': {
            orderId: 'ord-2',
            orderStatus: ORDER_STATUS.CANCELLED,
            requestedDate: '2026-09-21',
            serviceLocation: { address: '456 Le Loi, Q1' },
            acceptedQuote: { totalVnd: 100000 },
          },
        },
      },
    });

    expect(screen.getByText('ord-1')).toBeInTheDocument();
    expect(screen.getByText('ord-2')).toBeInTheDocument();
    expect(screen.getByText(/123 Nguyen Trai, Q5/)).toBeInTheDocument();
    expect(screen.getByText(/150\.000/)).toBeInTheDocument();
  });
});

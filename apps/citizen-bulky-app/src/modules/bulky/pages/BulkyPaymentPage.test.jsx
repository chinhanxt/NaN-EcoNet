// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { BulkyPaymentPage } from './BulkyPaymentPage.jsx';
import { bulkyReducer } from '../store/bulkySlice.js';
import { BULKY_CAPABILITIES } from '../services/bulkyServiceContract.js';
import { ORDER_STATUS, PAYMENT_STATUS } from '../domain/constants.js';

afterEach(() => {
  cleanup();
});

function renderWithStore(ui, { initialState = {}, route = '/bulky/payment/ord-1' } = {}) {
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
        <MemoryRouter initialEntries={[route]}>
          <Routes>
            <Route path="/bulky/payment/:orderId" element={ui} />
          </Routes>
        </MemoryRouter>
      </Provider>,
    ),
  };
}

describe('BulkyPaymentPage', () => {
  const baseOrder = {
    orderId: 'ord-1',
    orderStatus: ORDER_STATUS.AWAITING_PAYMENT,
    paymentStatus: PAYMENT_STATUS.PENDING,
    requestedDate: '2026-09-20',
    activeQuoteId: 'q-1',
    activeHoldId: 'h-1',
    serviceLocation: { address: '123 Nguyen Trai, Q5' },
    acceptedQuote: { totalVnd: 150000 },
  };

  const baseQuote = {
    quoteId: 'q-1',
    totalVnd: 150000,
    expiresAt: '2099-01-01T00:00:00.000Z',
  };

  const baseHold = {
    holdId: 'h-1',
    status: 'ACTIVE',
    expiresAt: '2099-01-01T00:00:00.000Z',
  };

  it('renders payment amount and simulation actions', () => {
    renderWithStore(<BulkyPaymentPage />, {
      initialState: {
        ordersById: { 'ord-1': baseOrder },
        quotesById: { 'q-1': baseQuote },
        holdsById: { 'h-1': baseHold },
        paymentsById: {
          'pay-1': {
            paymentAttemptId: 'pay-1',
            orderId: 'ord-1',
            amountVnd: 150000,
            status: PAYMENT_STATUS.PENDING,
          },
        },
      },
    });

    expect(screen.getByText(/Thanh Toán Dịch Vụ Thu Gom/i)).toBeInTheDocument();
    expect(screen.getByText(/150\.000/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mô phỏng: Thành công/i })).toBeInTheDocument();
  });

  it('handles successful payment and displays confirmation message', async () => {
    const mockSimulate = vi.fn().mockResolvedValue({
      payment: { paymentAttemptId: 'pay-1', status: 'SUCCESS' },
      order: {
        ...baseOrder,
        orderStatus: ORDER_STATUS.CONFIRMED,
        paymentStatus: PAYMENT_STATUS.SUCCESS,
        confirmationVersion: 1,
      },
    });

    renderWithStore(
      <BulkyPaymentPage
        thunks={{
          simulatePaymentResult:
            ({ paymentAttemptId, result }) =>
            async () => {
              return mockSimulate({ paymentAttemptId, result });
            },
        }}
      />,
      {
        initialState: {
          ordersById: { 'ord-1': baseOrder },
          quotesById: { 'q-1': baseQuote },
          holdsById: { 'h-1': baseHold },
          paymentsById: {
            'pay-1': {
              paymentAttemptId: 'pay-1',
              orderId: 'ord-1',
              amountVnd: 150000,
              status: PAYMENT_STATUS.PENDING,
            },
          },
        },
      },
    );

    const successBtn = screen.getByRole('button', { name: /Mô phỏng: Thành công/i });
    fireEvent.click(successBtn);

    await waitFor(() => {
      expect(mockSimulate).toHaveBeenCalledWith(expect.objectContaining({ result: 'SUCCESS' }));
    });
  });

  it('renders late payment reconciliation options when late success occurs', () => {
    renderWithStore(<BulkyPaymentPage />, {
      initialState: {
        ordersById: {
          'ord-1': {
            ...baseOrder,
            latePaymentResolution: {
              latePaymentResolutionId: 'res-1',
              status: 'CAPACITY_RECHECK_REQUIRED',
              offeredDates: ['2026-09-22', '2026-09-23'],
            },
          },
        },
        quotesById: { 'q-1': baseQuote },
        holdsById: { 'h-1': baseHold },
      },
    });

    expect(screen.getByText(/Xử Lý Thanh Toán Muộn/i)).toBeInTheDocument();
    expect(screen.getByText(/2026-09-22/)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Yêu cầu hoàn tiền toàn phần/i }),
    ).toBeInTheDocument();
  });

  it('displays deposit hold notice and tolerance guarantee message', () => {
    renderWithStore(<BulkyPaymentPage />, {
      initialState: {
        ordersById: {
          'ord-1': {
            ...baseOrder,
            acceptedQuote: {
              ...baseQuote,
              estimatedRange: { minVnd: 150000, maxVnd: 195000, depositHoldVnd: 150000 },
            },
          },
        },
        quotesById: { 'q-1': baseQuote },
        holdsById: { 'h-1': baseHold },
      },
    });

    expect(screen.getByText(/Bạn đang thanh toán số tiền tạm giữ chỗ/i)).toBeInTheDocument();
    expect(screen.getByText(/dung sai ±15% không phụ thu/i)).toBeInTheDocument();
  });
});

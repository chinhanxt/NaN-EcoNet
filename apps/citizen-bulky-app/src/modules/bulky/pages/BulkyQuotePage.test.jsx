// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { BulkyQuotePage } from './BulkyQuotePage.jsx';
import { bulkyReducer } from '../store/bulkySlice.js';
import { BULKY_CAPABILITIES } from '../services/bulkyServiceContract.js';
import { ORDER_STATUS } from '../domain/constants.js';

afterEach(() => {
  cleanup();
});

function renderWithStore(ui, { initialState = {}, route = '/bulky/quote/ord-1' } = {}) {
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
            <Route path="/bulky/quote/:orderId" element={ui} />
          </Routes>
        </MemoryRouter>
      </Provider>,
    ),
  };
}

describe('BulkyQuotePage', () => {
  it('renders order summary and itemized quote when quote is active', () => {
    renderWithStore(<BulkyQuotePage />, {
      initialState: {
        ordersById: {
          'ord-1': {
            orderId: 'ord-1',
            orderStatus: ORDER_STATUS.AWAITING_PAYMENT,
            requestedDate: '2026-09-20',
            activeQuoteId: 'q-1',
            activeHoldId: 'h-1',
            confirmedItems: [{ catalogItemCode: 'SOFA', displayName: 'Sofa da', quantity: 1 }],
          },
        },
        quotesById: {
          'q-1': {
            quoteId: 'q-1',
            totalVnd: 175000,
            subtotalVnd: 150000,
            taxVnd: 25000,
            priceBookVersion: '2026.1',
            cancellationPolicyVersion: '2026.1',
            lineItems: [
              { code: 'SOFA', label: 'Sofa da', quantity: 1, amountVnd: 150000 },
              { code: 'TAX', label: 'Tax', quantity: 1, amountVnd: 25000 },
            ],
            scope: ['Bốc xếp tận cửa', 'Vận chuyển chuyên dụng'],
            exclusions: ['Rác thải độc hại'],
            expiresAt: '2099-01-01T00:00:00.000Z',
          },
        },
        holdsById: {
          'h-1': {
            holdId: 'h-1',
            status: 'ACTIVE',
            expiresAt: '2099-01-01T00:00:00.000Z',
          },
        },
      },
    });

    expect(screen.getByText(/Chi Tiết Báo Giá & Giữ Chỗ/i)).toBeInTheDocument();
    expect(screen.getAllByText(/175\.000/)[0]).toBeInTheDocument();
    expect(screen.getByText(/Bốc xếp tận cửa/)).toBeInTheDocument();
  });

  it('displays estimated price range and tolerance policy banner', () => {
    renderWithStore(<BulkyQuotePage />, {
      initialState: {
        ordersById: {
          'ord-1': {
            orderId: 'ord-1',
            orderStatus: ORDER_STATUS.AWAITING_PAYMENT,
            requestedDate: '2026-09-20',
            activeQuoteId: 'q-range',
            activeHoldId: 'h-1',
            confirmedItems: [{ catalogItemCode: 'SOFA', displayName: 'Sofa da', quantity: 1 }],
          },
        },
        quotesById: {
          'q-range': {
            quoteId: 'q-range',
            totalVnd: 150000,
            subtotalVnd: 150000,
            estimatedRange: {
              minVnd: 150000,
              maxVnd: 195000,
              depositHoldVnd: 150000,
            },
            tolerancePolicy: {
              allowedPercent: 15,
              message:
                'Miễn phí phụ thu nếu khối lượng hoặc kích thước thực tế sai lệch không quá ±15% so với khai báo.',
            },
            lineItems: [{ code: 'SOFA', label: 'Sofa da', quantity: 1, amountVnd: 150000 }],
            expiresAt: '2099-01-01T00:00:00.000Z',
          },
        },
        holdsById: {
          'h-1': {
            holdId: 'h-1',
            status: 'ACTIVE',
            expiresAt: '2099-01-01T00:00:00.000Z',
          },
        },
      },
    });

    expect(screen.getByText(/Khoảng giá dự toán/i)).toBeInTheDocument();
    expect(screen.getByText(/dung sai/i)).toBeInTheDocument();
    expect(screen.getByText(/Số tiền tạm giữ chỗ/i)).toBeInTheDocument();
  });

  it('renders expired hold warning and re-quote action when quote has expired', () => {
    renderWithStore(<BulkyQuotePage />, {
      initialState: {
        ordersById: {
          'ord-1': {
            orderId: 'ord-1',
            orderStatus: ORDER_STATUS.AWAITING_PAYMENT,
            requestedDate: '2026-09-20',
            activeQuoteId: 'q-expired',
            activeHoldId: 'h-expired',
          },
        },
        quotesById: {
          'q-expired': {
            quoteId: 'q-expired',
            totalVnd: 150000,
            expiresAt: '2020-01-01T00:00:00.000Z',
            lineItems: [],
          },
        },
        holdsById: {
          'h-expired': {
            holdId: 'h-expired',
            status: 'EXPIRED',
            expiresAt: '2020-01-01T00:00:00.000Z',
          },
        },
      },
    });

    expect(screen.getByText(/Báo giá hoặc vị trí giữ chỗ đã hết hạn/i)).toBeInTheDocument();
  });

  it('navigates to payment on click Proceed to Payment', async () => {
    const handleProceed = vi.fn();
    renderWithStore(<BulkyQuotePage onProceedToPayment={handleProceed} />, {
      initialState: {
        ordersById: {
          'ord-1': {
            orderId: 'ord-1',
            orderStatus: ORDER_STATUS.AWAITING_PAYMENT,
            activeQuoteId: 'q-1',
            activeHoldId: 'h-1',
          },
        },
        quotesById: {
          'q-1': {
            quoteId: 'q-1',
            totalVnd: 150000,
            expiresAt: '2099-01-01T00:00:00.000Z',
            lineItems: [{ code: 'SOFA', label: 'Sofa', quantity: 1, amountVnd: 150000 }],
          },
        },
        holdsById: {
          'h-1': { holdId: 'h-1', status: 'ACTIVE', expiresAt: '2099-01-01T00:00:00.000Z' },
        },
      },
    });

    const payBtn = screen.getByRole('button', { name: /Tiến hành thanh toán/i });
    fireEvent.click(payBtn);
    expect(handleProceed).toHaveBeenCalled();
  });
});

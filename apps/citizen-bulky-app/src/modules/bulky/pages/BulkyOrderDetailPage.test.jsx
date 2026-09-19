// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { BulkyOrderDetailPage } from './BulkyOrderDetailPage.jsx';
import { bulkyReducer } from '../store/bulkySlice.js';
import { BULKY_CAPABILITIES } from '../services/bulkyServiceContract.js';
import { ORDER_STATUS, PAYMENT_STATUS, REFUND_STATUS } from '../domain/constants.js';

afterEach(() => {
  cleanup();
});

function renderWithStore(ui, { initialState = {}, route = '/bulky/orders/ord-1' } = {}) {
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
            <Route path="/bulky/orders/:orderId" element={ui} />
          </Routes>
        </MemoryRouter>
      </Provider>,
    ),
  };
}

describe('BulkyOrderDetailPage', () => {
  const baseOrder = {
    orderId: 'ord-1',
    orderStatus: ORDER_STATUS.CONFIRMED,
    paymentStatus: PAYMENT_STATUS.SUCCESS,
    requestedDate: '2026-09-20',
    serviceLocation: { address: '123 Nguyen Trai, Q5' },
    acceptedQuote: { totalVnd: 150000 },
    confirmedItems: [{ catalogItemCode: 'SOFA', displayName: 'Sofa da', quantity: 1 }],
    handlingConditions: { placement: 'CURBSIDE', floorNumber: 0, hasLift: false },
    timeline: [
      { event: 'DRAFT_CREATED', occurredAt: '2026-09-17T08:00:00.000Z' },
      { event: 'ORDER_CONFIRMED_PAID', occurredAt: '2026-09-17T08:30:00.000Z' },
    ],
  };

  it('renders order details, items, location, and timeline', () => {
    renderWithStore(<BulkyOrderDetailPage />, {
      initialState: {
        ordersById: { 'ord-1': baseOrder },
      },
    });

    expect(screen.getByText('ord-1')).toBeInTheDocument();
    expect(screen.getByText(/123 Nguyen Trai, Q5/)).toBeInTheDocument();
    expect(screen.getByText('Sofa da')).toBeInTheDocument();
    expect(screen.getByText(/Lịch sử sự kiện/i)).toBeInTheDocument();
  });

  it('opens cancel dialog and shows financial effect disclosure', async () => {
    renderWithStore(<BulkyOrderDetailPage />, {
      initialState: {
        ordersById: { 'ord-1': baseOrder },
      },
    });

    const cancelBtn = screen.getByRole('button', { name: /Hủy đơn/i });
    fireEvent.click(cancelBtn);

    await waitFor(() => {
      expect(screen.getByText(/Xác nhận hủy yêu cầu thu gom/i)).toBeInTheDocument();
      expect(
        screen.getByText(/khoản tiền đã thanh toán sẽ được tự động hoàn trả/i),
      ).toBeInTheDocument();
    });
  });

  it('renders refund tracker when refund is requested', () => {
    renderWithStore(<BulkyOrderDetailPage />, {
      initialState: {
        ordersById: {
          'ord-1': {
            ...baseOrder,
            orderStatus: ORDER_STATUS.CANCELLED,
            refundStatus: REFUND_STATUS.REQUESTED,
          },
        },
        refundsById: {
          'ref-1': {
            refundId: 'ref-1',
            orderId: 'ord-1',
            amountVnd: 150000,
            status: REFUND_STATUS.REQUESTED,
          },
        },
      },
    });

    expect(screen.getByText(/Tiến Trình Hoàn Tiền/i)).toBeInTheDocument();
    expect(screen.getByText(/Đã gửi yêu cầu hoàn tiền/i)).toBeInTheDocument();
  });

  it('renders dispatcher simulation card and multi-module trace when change request is UNDER_REVIEW', () => {
    const underReviewOrder = {
      ...baseOrder,
      changeRequest: {
        changeRequestId: 'cr-test-1',
        type: 'RESCHEDULE',
        status: 'UNDER_REVIEW',
        requestedDate: '2026-09-25',
        reason: 'Khách đổi giờ sát giờ gom',
      },
      lastDispatchEvent: {
        eventId: 'ord-1:1:UPSERT',
        type: 'UPSERT',
        confirmationVersion: 1,
        occurredAt: '2026-09-17T09:00:00.000Z',
      },
    };

    renderWithStore(<BulkyOrderDetailPage />, {
      initialState: {
        ordersById: { 'ord-1': underReviewOrder },
      },
    });

    expect(screen.getByText(/BÀN ĐIỀU PHỐI VIÊN \(MÔ PHỎNG TEST\)/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Duyệt yêu cầu \(Chấp thuận\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Từ chối yêu cầu \(Bác bỏ\)/i })).toBeInTheDocument();
    expect(screen.getByText(/Tích Hợp Đa Phân Hệ/i)).toBeInTheDocument();
    expect(screen.getByText(/ord-1:1:UPSERT/i)).toBeInTheDocument();
  });

  it('allows dispatcher to trigger accept change offer', async () => {
    let accepted = false;
    const mockThunks = {
      acceptChangeOffer: ({ changeRequestId }) => async () => {
        if (changeRequestId === 'cr-test-2') accepted = true;
      },
    };

    const underReviewOrder = {
      ...baseOrder,
      changeRequest: {
        changeRequestId: 'cr-test-2',
        type: 'CANCEL',
        status: 'UNDER_REVIEW',
        reason: 'Khách muốn hủy đơn',
      },
    };

    renderWithStore(<BulkyOrderDetailPage thunks={mockThunks} />, {
      initialState: {
        ordersById: { 'ord-1': underReviewOrder },
      },
    });

    const acceptBtn = screen.getByRole('button', { name: /Duyệt yêu cầu \(Chấp thuận\)/i });
    fireEvent.click(acceptBtn);

    await waitFor(() => {
      expect(accepted).toBe(true);
    });
  });

  it('displays material tags on items, estimated range, and handover tolerance guarantee status', () => {
    const orderWithMaterialAndTolerance = {
      ...baseOrder,
      confirmedItems: [
        {
          catalogItemCode: 'SOFA',
          displayName: 'Sofa da',
          quantity: 1,
          material: 'HEAVY',
        },
      ],
      acceptedQuote: {
        totalVnd: 150000,
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
      },
      handoverToleranceStatus: 'VERIFIED_WITHIN_TOLERANCE',
    };

    renderWithStore(<BulkyOrderDetailPage />, {
      initialState: {
        ordersById: { 'ord-1': orderWithMaterialAndTolerance },
      },
    });

    expect(screen.getByText(/Gỗ đặc \/ Mặt đá \/ Kính/i)).toBeInTheDocument();
    expect(screen.getByText(/Khoảng giá dự toán/i)).toBeInTheDocument();
    expect(screen.getByText(/195\.000/)).toBeInTheDocument();
    expect(screen.getByText(/VERIFIED_WITHIN_TOLERANCE/i)).toBeInTheDocument();
  });
});

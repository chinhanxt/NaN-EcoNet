// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter, useRoutes } from 'react-router-dom';
import { bulkyRoutes } from './routes.jsx';
import { bulkyReducer, switchBulkyUser } from './store/bulkySlice.js';
import { BULKY_CAPABILITIES, BULKY_PERSONAS } from './services/bulkyServiceContract.js';

afterEach(() => {
  cleanup();
});

function AppRoutes() {
  return useRoutes(bulkyRoutes);
}

function renderRoute(route) {
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
      },
    },
  });

  const rendered = render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[route]}>
        <AppRoutes />
      </MemoryRouter>
    </Provider>,
  );
  return { ...rendered, store };
}

describe('bulkyRoutes', () => {
  it('sends an uncertain booking to staff, then lets the citizen reserve the staff price', async () => {
    localStorage.removeItem('smartbin:bulky:v1:repository');
    const { store } = renderRoute('/bulky/booking');
    fireEvent.click(screen.getByRole('button', { name: /Sofa da phòng khách/i }));
    fireEvent.click(screen.getByRole('button', { name: /Tiếp theo/i }));
    fireEvent.click(screen.getByRole('button', { name: /Tiếp theo/i }));
    fireEvent.click(screen.getByRole('button', { name: /Xác nhận & Gửi yêu cầu/i }));
    await screen.findByText(/Yêu cầu đã được lưu để nhân viên/i);
    act(() => store.dispatch(switchBulkyUser(BULKY_PERSONAS[1])));
    fireEvent.change(await screen.findByLabelText(/Tổng phí trọn gói/i), {
      target: { value: '450000' },
    });
    fireEvent.change(screen.getByLabelText(/Nội dung và phạm vi báo giá/i), {
      target: { value: 'Thu gom sofa quá khổ, gồm xe và bốc xếp' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Gửi báo giá cho người dân/i }));
    await screen.findByText(/Nhân viên đề xuất/i);
    act(() => store.dispatch(switchBulkyUser(BULKY_PERSONAS[0])));
    fireEvent.click(await screen.findByRole('button', { name: /Xem báo giá & giữ chỗ/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Lấy báo giá & Giữ chỗ/i }));
    await waitFor(() => expect(screen.getAllByText(/450.000/).length).toBeGreaterThan(0));
    expect(screen.queryByText(/Khoảng giá dự toán/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Cam kết ±/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tiến hành thanh toán/i })).toBeEnabled();
  }, 15000);
  it('exports 5 bulky routes', () => {
    expect(bulkyRoutes).toHaveLength(5);
    const paths = bulkyRoutes.map((r) => r.path);
    expect(paths).toContain('/bulky/booking');
    expect(paths).toContain('/bulky/quote/:orderId');
    expect(paths).toContain('/bulky/payment/:orderId');
    expect(paths).toContain('/bulky/orders');
    expect(paths).toContain('/bulky/orders/:orderId');
  });

  it('renders booking page on /bulky/booking', () => {
    renderRoute('/bulky/booking');
    expect(
      screen.getByRole('heading', { name: /Đặt Lịch Thu Gom Rác Cồng Kềnh/i }),
    ).toBeInTheDocument();
  });

  it('renders orders page on /bulky/orders', () => {
    renderRoute('/bulky/orders');
    expect(
      screen.getByRole('heading', { level: 1, name: /Đơn Thu Gom Rác Cồng Kềnh/i }),
    ).toBeInTheDocument();
  });
});

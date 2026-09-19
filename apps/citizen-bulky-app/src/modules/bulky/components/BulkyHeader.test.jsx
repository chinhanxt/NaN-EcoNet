// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import { BulkyHeader } from './BulkyHeader.jsx';
import { bulkyReducer } from '../store/bulkySlice.js';
import { BULKY_CAPABILITIES, BULKY_PERSONAS } from '../services/bulkyServiceContract.js';

afterEach(() => {
  cleanup();
});

function renderHeader({ initialState = {} } = {}) {
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
        activeUser: BULKY_PERSONAS[0], // Citizen
        notifications: [
          {
            id: 'notif-disp-1',
            targetRole: 'DISPATCHER',
            type: 'RESCHEDULE_REQUESTED',
            title: '⚡ Yêu cầu dời ngày mới cần phê duyệt',
            message: 'Đơn #BK-2026-002: Hộ dân đề nghị dời ngày',
            orderId: 'BK-2026-002',
            createdAt: new Date().toISOString(),
            read: false,
          },
          {
            id: 'notif-cit-1',
            targetRole: 'CITIZEN',
            type: 'CHANGE_REQUEST_ACCEPTED',
            title: '✓ Yêu cầu của bạn đã được duyệt',
            message: 'Đơn #BK-2026-001: Lịch thu gom đã được cập nhật',
            orderId: 'BK-2026-001',
            createdAt: new Date().toISOString(),
            read: false,
          },
        ],
        ...initialState,
      },
    },
  });

  return {
    store,
    ...render(
      <Provider store={store}>
        <MemoryRouter>
          <BulkyHeader />
        </MemoryRouter>
      </Provider>,
    ),
  };
}

describe('BulkyHeader', () => {
  it('renders branding, active persona, and notification bell', () => {
    renderHeader();

    expect(screen.getByText(/Smartbin • Thu Gom Rác Cồng Kềnh/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/thông báo/i)).toBeInTheDocument();
    // Citizen has 1 unread notification
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('opens notification menu on bell click and displays role-specific notifications', () => {
    renderHeader();

    const bellBtn = screen.getByLabelText(/thông báo/i);
    fireEvent.click(bellBtn);

    expect(screen.getByText(/🔔 Thông báo/i)).toBeInTheDocument();
    expect(screen.getByText(/✓ Yêu cầu của bạn đã được duyệt/i)).toBeInTheDocument();
    expect(screen.queryByText(/⚡ Yêu cầu dời ngày mới cần phê duyệt/i)).not.toBeInTheDocument();
  });

  it('displays dispatcher notification when active user is DISPATCHER', () => {
    renderHeader({
      initialState: {
        activeUser: BULKY_PERSONAS[1], // Dispatcher
      },
    });

    const bellBtn = screen.getByLabelText(/thông báo/i);
    fireEvent.click(bellBtn);

    expect(screen.getByText(/⚡ Yêu cầu dời ngày mới cần phê duyệt/i)).toBeInTheDocument();
    expect(screen.getByText(/Xem & Duyệt ngay →/i)).toBeInTheDocument();
  });
});

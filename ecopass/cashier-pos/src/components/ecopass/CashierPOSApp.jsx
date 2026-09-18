import React, { useState, useCallback } from "react";
import { POSShell } from "./POSShell";
import { POSHeader } from "./POSHeader";
import { POSScannerTab } from "./POSScannerTab";
import { ValidationModal } from "./ValidationModal";
import { ShiftHistoryTab } from "./ShiftHistoryTab";
import { AccountTab } from "./AccountTab";
import { POSDock } from "./POSDock";

// Mock Database of known vouchers
const MOCK_VOUCHERS = {
  "ECO-HL-10K-892": {
    code: "ECO-HL-10K-892",
    title: "Giảm 10.000đ",
    subtitle: "Áp dụng cho Phindi Hạnh Nhân (Đơn từ 45k)",
    brand: "Highlands Coffee",
    discountValue: 10000,
    used: false,
  },
  "ECO-HL-20K-015": {
    code: "ECO-HL-20K-015",
    title: "Giảm 20.000đ",
    subtitle: "Áp dụng tại Căn tin & Ministop",
    brand: "Suntory PepsiCo",
    discountValue: 20000,
    used: false,
  },
  "ECO-WELCOME-10K": {
    code: "ECO-WELCOME-10K",
    title: "Giảm 10.000đ",
    subtitle: "Quà Chào Mừng Sinh Viên",
    brand: "EcoPass",
    discountValue: 10000,
    used: false,
  },
  "ECO-USED-10K": {
    code: "ECO-USED-10K",
    title: "Mã Đã Qua Sử Dụng",
    subtitle: "Không thể áp dụng lại",
    brand: "Ministop Căn Tin",
    discountValue: 10000,
    used: true,
    usedAt: "08:14 hôm nay",
  },
};

// Khởi tạo lịch sử có cả đơn thành công và đơn bị từ chối
const INITIAL_TRANSACTIONS = [
  {
    id: "tx-1",
    code: "ECO-HL-10K-892",
    time: "09:35",
    discount: 10000,
    status: "success",
  },
  {
    id: "tx-2",
    code: "ECO-USED-10K",
    time: "09:20",
    discount: 0,
    status: "failed",
    reason: "Mã đã qua sử dụng",
  },
  {
    id: "tx-3",
    code: "ECO-HL-20K-015",
    time: "09:05",
    discount: 20000,
    status: "success",
  },
];

export const CashierPOSApp = () => {
  const [activeTab, setActiveTab] = useState("scan");
  const [voucherDb, setVoucherDb] = useState(MOCK_VOUCHERS);
  const [transactions, setTransactions] = useState(INITIAL_TRANSACTIONS);
  const [currentVoucher, setCurrentVoucher] = useState(null);

  // Xử lý quét mã từ camera hoặc nút test
  const handleVoucherScanned = useCallback(
    (scannedText) => {
      const cleanCode = scannedText.trim();
      let found = voucherDb[cleanCode];

      if (!found) {
        if (cleanCode.startsWith("ECO-")) {
          found = {
            code: cleanCode,
            title: "Giảm 10.000đ",
            subtitle: "Áp dụng tại Căn tin & Ministop",
            brand: "Chiến Dịch EcoPass",
            discountValue: 10000,
            used: false,
          };
        } else {
          found = {
            code: cleanCode,
            title: "Mã Không Tồn Tại",
            subtitle: "Không tìm thấy trên hệ thống",
            used: true,
            usedAt: "Không xác định",
          };
        }
      }

      setCurrentVoucher(found);
    },
    [voucherDb]
  );

  // Xác nhận dùng voucher thành công
  const handleConfirmRedeem = (voucher) => {
    // Cập nhật trạng thái đã dùng
    setVoucherDb((prev) => ({
      ...prev,
      [voucher.code]: {
        ...voucher,
        used: true,
        usedAt: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
        usedLocation: "Quầy #01 • Ministop Căn Tin",
      },
    }));

    // Ghi nhận giao dịch thành công
    const newTx = {
      id: `tx-${Date.now()}`,
      code: voucher.code,
      time: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
      discount: voucher.discountValue || 10000,
      status: "success",
    };

    setTransactions((prev) => [newTx, ...prev]);

    setTimeout(() => {
      setCurrentVoucher(null);
    }, 1000);
  };

  // Đóng modal - nếu là mã lỗi/từ chối thì ghi nhận vào lịch sử đơn thất bại
  const handleCloseModal = () => {
    if (currentVoucher && currentVoucher.used) {
      const failTx = {
        id: `tx-fail-${Date.now()}`,
        code: currentVoucher.code,
        time: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
        discount: 0,
        status: "failed",
        reason: currentVoucher.usedAt ? "Mã đã qua sử dụng" : "Mã không tồn tại",
      };
      setTransactions((prev) => [failTx, ...prev]);
    }
    setCurrentVoucher(null);
  };

  // Gửi báo cáo ca trực về hệ thống
  const handleSendReport = () => {
    console.log("Đã gửi báo cáo ca:", {
      terminal: "POS-HUTECH-01",
      transactions,
      timestamp: new Date().toISOString(),
    });
  };

  return (
    <POSShell
      activeTab={activeTab}
      bottomDock={
        <POSDock
          activeTab={activeTab}
          onTabChange={(tab) => setActiveTab(tab)}
          count={transactions.length}
        />
      }
    >
      {/* Top Header */}
      <POSHeader counterName="Quầy #01" />

      {/* Main Tab Screen Area */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {activeTab === "scan" && (
          <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
            <POSScannerTab
              onVoucherScanned={handleVoucherScanned}
              onSimulateCode={handleVoucherScanned}
            />
          </div>
        )}

        {activeTab === "history" && (
          <ShiftHistoryTab
            transactions={transactions}
            onSendReport={handleSendReport}
          />
        )}

        {activeTab === "account" && (
          <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
            <AccountTab />
          </div>
        )}
      </div>

      {/* Validation Screen Modal */}
      {currentVoucher && (
        <ValidationModal
          voucher={currentVoucher}
          onConfirmRedeem={handleConfirmRedeem}
          onClose={handleCloseModal}
        />
      )}
    </POSShell>
  );
};

"use client";

import React, { useState } from "react";
import { IPhoneShell } from "./IPhoneShell";
import { FloatingDock } from "./FloatingDock";
import { HomeScreen } from "./HomeScreen";
import { ScannerScreen, DetectedProduct } from "./ScannerScreen";
import { SurveyModal } from "./SurveyModal";
import { WalletScreen, VoucherItem } from "./WalletScreen";
import { ProfileScreen, UserProfileData } from "./ProfileScreen";
import { playVoucherTing } from "../../lib/sound";

const INITIAL_VOUCHERS: VoucherItem[] = [
  {
    id: "welcome-01",
    code: "ECO-WELCOME-10K",
    title: "Giảm 10.000đ",
    subtitle: "Đơn từ 50k tại Ministop & Căn Tin",
    brand: "Quà Chào Mừng",
    expiresIn: "Còn 6 ngày",
    used: false,
  },
  {
    id: "welcome-02",
    code: "ECO-WARRIOR-15K",
    title: "Giảm 15.000đ",
    subtitle: "Đơn từ 40.000đ tại Căn Tin & Ministop",
    brand: "TCP Group (Warrior)",
    expiresIn: "Còn 3 ngày",
    used: false,
  },
];

export const EcoPassApp: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"home" | "scan" | "wallet" | "profile">("home");
  const [vouchers, setVouchers] = useState<VoucherItem[]>(INITIAL_VOUCHERS);
  const [currentPoints, setCurrentPoints] = useState<number>(120);
  const [maxPoints, setMaxPoints] = useState<number>(350);
  const [detectedProduct, setDetectedProduct] = useState<DetectedProduct | null>(null);
  const [showSurvey, setShowSurvey] = useState(false);

  // Read URL query params (?tab=scan hoặc ?scan=true)
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab");
      if (tab === "scan" || params.get("scan") === "true") {
        setActiveTab("scan");
      } else if (tab === "wallet") {
        setActiveTab("wallet");
      }
    }
  }, []);

  // User Profile state with localStorage persistence
  const [userProfile, setUserProfile] = useState<UserProfileData>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("ecopass_profile");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          // ignore error
        }
      }
    }
    return {
      fullName: "Nguyễn Văn An",
      phone: "0908 123 456",
    };
  });

  const handleSaveProfile = (updated: UserProfileData) => {
    setUserProfile(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem("ecopass_profile", JSON.stringify(updated));
    }
  };

  // Triggered when a product is scanned
  const handleProductDetected = (product: DetectedProduct) => {
    setDetectedProduct(product);
    setShowSurvey(true);
  };

  // Triggered when survey 3s is submitted
  const handleSurveyComplete = (result: { choice: string; voucherGranted: any }) => {
    setShowSurvey(false);
    setDetectedProduct(null);

    // 1. Add +10 Green Points
    setCurrentPoints((prev) => {
      const next = prev + 10;
      if (next > maxPoints) setMaxPoints(next);
      return next;
    });

    // 2. Add new earned voucher to wallet
    const newVoucher: VoucherItem = {
      id: result.voucherGranted.id,
      code: result.voucherGranted.code,
      title: result.voucherGranted.title,
      subtitle: result.voucherGranted.subtitle,
      brand: result.voucherGranted.brand,
      expiresIn: result.voucherGranted.expiresIn,
      used: false,
    };

    setVouchers((prev) => [newVoucher, ...prev]);
    setActiveTab("wallet");
  };

  // Triggered when user redeems a milestone with their green points
  const handleRedeemMilestone = (milestone: {
    id: string;
    pointsCost: number;
    title: string;
    subtitle: string;
    brand: string;
  }) => {
    if (currentPoints < milestone.pointsCost) return;

    // Play chime sound & vibrate
    playVoucherTing();
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate([60, 40, 60]);
    }

    // Deduct points
    setCurrentPoints((prev) => prev - milestone.pointsCost);

    // Add generated voucher
    const newVoucher: VoucherItem = {
      id: `eco-ms-${Date.now()}`,
      code: `ECO-MS-${Math.floor(100 + Math.random() * 900)}-VN`,
      title: milestone.title,
      subtitle: milestone.subtitle,
      brand: milestone.brand,
      expiresIn: "Còn 7 ngày",
      used: false,
    };

    setVouchers((prev) => [newVoucher, ...prev]);
  };

  return (
    <IPhoneShell
      activeTab={activeTab}
      bottomDock={
        activeTab !== "scan" && activeTab !== "profile" ? (
          <FloatingDock
            activeTab={activeTab}
            onTabChange={(tab) => setActiveTab(tab)}
            voucherCount={vouchers.filter((v) => !v.used).length}
          />
        ) : null
      }
    >
      {/* 1. Main View Routing (Only this scrollable area changes) */}
      {activeTab === "home" && (
        <HomeScreen
          onStartScan={() => setActiveTab("scan")}
          onOpenWallet={() => setActiveTab("wallet")}
          onOpenProfile={() => setActiveTab("profile")}
          userName={userProfile.fullName}
          currentPoints={currentPoints}
          maxPoints={maxPoints}
        />
      )}

      {activeTab === "scan" && (
        <ScannerScreen
          onBack={() => setActiveTab("home")}
          onProductDetected={handleProductDetected}
        />
      )}

      {activeTab === "wallet" && (
        <WalletScreen
          vouchers={vouchers}
          currentPoints={currentPoints}
          onBack={() => setActiveTab("home")}
          onRedeemMilestone={handleRedeemMilestone}
        />
      )}

      {activeTab === "profile" && (
        <ProfileScreen
          onBack={() => setActiveTab("home")}
          userProfile={userProfile}
          onSaveProfile={handleSaveProfile}
          currentPoints={currentPoints}
        />
      )}

      {/* 2. Micro-Survey Modal */}
      {showSurvey && detectedProduct && (
        <SurveyModal
          product={detectedProduct}
          onComplete={handleSurveyComplete}
          onCancel={() => {
            setShowSurvey(false);
            setDetectedProduct(null);
          }}
        />
      )}
    </IPhoneShell>
  );
};

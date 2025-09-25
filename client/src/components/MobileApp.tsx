import { useState, useEffect } from "react";
import { Route, Switch, Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import HomePage from "@/pages/home-page";
import AuthPage from "@/pages/auth-page";
import MiningFactory from "@/pages/mining-factory.tsx";
import PurchasePowerPage from "@/pages/purchase-power-page.tsx";
import WalletPage from "@/pages/wallet-page.tsx";
import DepositPage from "@/pages/deposit-page.tsx";
import WithdrawPage from "@/pages/withdraw-page.tsx";
import TransferPage from "@/pages/transfer-page.tsx";
import AllMiners from "@/pages/all-miners.tsx";
import AccountPage from "@/pages/account-page";
import AdminUsers from "@/pages/admin/AdminUsers";
import ActiveUsers from "@/pages/admin/ActiveUsers";
import InactiveUsers from "@/pages/admin/InactiveUsers";
import DefaultUsers from "@/pages/admin/DefaultUsers";
import BannedUsers from "@/pages/admin/BannedUsers";
import AdminTransactions from "@/pages/admin/AdminTransactions";
import AdminDeposits from "@/pages/admin/AdminDeposits";
import AdminWithdrawals from "@/pages/admin/AdminWithdrawals";
import AdminAddresses from "@/pages/admin/AdminAddresses";
import UserProfile from "@/pages/admin/UserProfile";
import TransactionsPage from "@/pages/transactions-page";
import Whitepaper from "@/pages/whitepaper";
import GlobalPage from "@/pages/global-page";
import BtcMiningPage from "@/pages/btc-mining";
import { ProtectedRoute } from "@/lib/protected-route";
import { AdminProtectedRoute } from "@/lib/admin-protected-route";
import LoadingScreen from "./LoadingScreen";
import { SuspensionModal } from "./SuspensionModal";

export default function MobileApp() {
  const { user } = useAuth();
  const [location] = useLocation();
  const [showLoading, setShowLoading] = useState(true); // Always show loading screen at startup
  const [showBottomNav, setShowBottomNav] = useState(true);
  const [showSuspensionModal, setShowSuspensionModal] = useState(false);
  
  // Check if user account is frozen or banned (not just mining paused)
  const isSuspended = user?.isFrozen || user?.isBanned;
  
  useEffect(() => {
    // Mark that we've loaded once
    if (showLoading) {
      sessionStorage.setItem('firstLoad', 'false');
    }
  }, [showLoading]);

  // Hide bottom nav on certain pages
  useEffect(() => {
    const hideNavPages = ["/", "/auth"];
    setShowBottomNav(!hideNavPages.includes(location));
  }, [location]);

  // Add click handler for suspended users
  useEffect(() => {
    if (isSuspended && !showSuspensionModal) {
      const handleClick = (e: MouseEvent) => {
        // Don't trigger on the modal itself
        const target = e.target as HTMLElement;
        if (!target.closest('.suspension-modal-content')) {
          setShowSuspensionModal(true);
        }
      };
      
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [isSuspended, showSuspensionModal]);

  if (showLoading) {
    return <LoadingScreen onComplete={() => setShowLoading(false)} />;
  }

  const navItems = [
    { 
      path: "/mining", 
      icon: "fas fa-industry", 
      label: "Factory",
      color: "text-primary"
    },
    { 
      path: "/wallet", 
      icon: "fas fa-wallet", 
      label: "Wallet",
      color: "text-accent"
    },
    { 
      path: "/power", 
      icon: "fas fa-microchip", 
      label: "Hashrate",
      color: "text-chart-4"
    },
    { 
      path: "/account", 
      icon: "fas fa-user-circle", 
      label: "Account",
      color: "text-chart-5"
    }
  ];

  if (user?.isAdmin) {
    navItems.push({
      path: "/admin",
      icon: "fas fa-cog",
      label: "Admin",
      color: "text-destructive"
    });
  }

  return (
    <div className="mobile-app">
      {/* Main Content Area */}
      <div className={`app-content ${showBottomNav ? 'pb-20' : ''}`}>
        <Switch>
          <Route path="/" component={HomePage} />
          <Route path="/auth" component={AuthPage} />
          <ProtectedRoute path="/mining" component={MiningFactory} />
          <ProtectedRoute path="/wallet" component={WalletPage} />
          <ProtectedRoute path="/power" component={PurchasePowerPage} />
          <ProtectedRoute path="/global-miners" component={AllMiners} />
          <ProtectedRoute path="/account" component={AccountPage} />
          <ProtectedRoute path="/deposit" component={DepositPage} />
          <ProtectedRoute path="/withdraw" component={WithdrawPage} />
          <ProtectedRoute path="/transfer" component={TransferPage} />
          <ProtectedRoute path="/transactions" component={TransactionsPage} />
          <ProtectedRoute path="/btc-mining" component={BtcMiningPage} />
          <Route path="/whitepaper" component={Whitepaper} />
          <Route path="/global" component={GlobalPage} />
          <AdminProtectedRoute path="/admin" component={AdminUsers} />
          <AdminProtectedRoute path="/admin/users" component={AdminUsers} />
          <AdminProtectedRoute path="/admin/users/active" component={ActiveUsers} />
          <AdminProtectedRoute path="/admin/users/inactive" component={InactiveUsers} />
          <AdminProtectedRoute path="/admin/users/banned" component={BannedUsers} />
          <AdminProtectedRoute path="/admin/users/default" component={DefaultUsers} />
          <AdminProtectedRoute path="/admin/users/:userId" component={UserProfile} />
          <AdminProtectedRoute path="/admin/transactions" component={AdminTransactions} />
          <AdminProtectedRoute path="/admin/deposits" component={AdminDeposits} />
          <AdminProtectedRoute path="/admin/withdrawals" component={AdminWithdrawals} />
          <AdminProtectedRoute path="/admin/addresses" component={AdminAddresses} />
        </Switch>
      </div>

      {/* Bottom Navigation */}
      {showBottomNav && user && (
        <nav className="bottom-nav">
          <div className="nav-container">
            {navItems.map((item) => {
              const isActive = location === item.path;
              return (
                <Link key={item.path} href={item.path}>
                  <button
                    className={`nav-item ${isActive ? 'active' : ''}`}
                    data-testid={`nav-${item.label.toLowerCase()}`}
                  >
                    <i className={`${item.icon} nav-icon ${isActive ? item.color : 'text-muted-foreground'}`}></i>
                    <span className={`nav-label ${isActive ? item.color : 'text-muted-foreground'}`}>
                      {item.label}
                    </span>
                    {isActive && (
                      <div className="nav-indicator" />
                    )}
                  </button>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
      
      {/* Suspension Modal */}
      <SuspensionModal 
        isOpen={showSuspensionModal} 
        onClose={() => setShowSuspensionModal(false)}  // Add onClose
        isFrozen={user?.isFrozen || undefined}
        isSuspended={user?.miningSuspended || undefined}
      />
    </div>
  );
}
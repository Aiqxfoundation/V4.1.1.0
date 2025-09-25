import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  Loader2, 
  ArrowDownCircle, 
  ArrowUpCircle, 
  ArrowRight, 
  TrendingDown, 
  TrendingUp,
  Activity,
  AlertCircle
} from "lucide-react";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";

interface Transaction {
  id: string;
  userId: string;
  user?: { username: string };
  type: 'deposit' | 'withdrawal';
  amount: string;
  currency: string;
  network: string;
  status: 'pending' | 'approved' | 'rejected';
  address?: string;
  txHash?: string;
  createdAt: string;
  updatedAt: string;
}

export default function AdminTransactions() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  // Query for pending counts
  const { data: pendingDeposits = [], isLoading: depositsLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/deposits/pending"],
    enabled: !!user?.isAdmin,
    refetchInterval: 10000, // Refresh every 10 seconds for instant updates
    refetchOnWindowFocus: true, // Refresh when admin returns to tab
    staleTime: 5000 // Consider data fresh for 5 seconds
  });

  const { data: pendingWithdrawals = [], isLoading: withdrawalsLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/withdrawals/pending"],
    enabled: !!user?.isAdmin,
    refetchInterval: 10000, // Refresh every 10 seconds for instant updates
    refetchOnWindowFocus: true, // Refresh when admin returns to tab
    staleTime: 5000 // Consider data fresh for 5 seconds
  });

  // Calculate recent activity (last 24 hours)
  const getRecentCount = (transactions: Transaction[]) => {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return transactions.filter(t => new Date(t.createdAt) > oneDayAgo).length;
  };

  const recentDeposits = getRecentCount(pendingDeposits);
  const recentWithdrawals = getRecentCount(pendingWithdrawals);

  return (
    <div className="min-h-screen bg-black text-white p-4 pb-24">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Transaction Management</h1>
        <p className="text-gray-400">Manage and process all platform transactions</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400 mb-1">Total Pending</p>
                <p className="text-3xl font-bold text-[#f7931a]">
                  {pendingDeposits.length + pendingWithdrawals.length}
                </p>
              </div>
              <Activity className="h-8 w-8 text-[#f7931a]" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400 mb-1">Recent Activity</p>
                <p className="text-3xl font-bold text-blue-500">
                  {recentDeposits + recentWithdrawals}
                </p>
                <p className="text-xs text-gray-500 mt-1">Last 24 hours</p>
              </div>
              <TrendingUp className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400 mb-1">Requires Action</p>
                <div className="flex items-center gap-2 mt-1">
                  {pendingDeposits.length > 0 || pendingWithdrawals.length > 0 ? (
                    <>
                      <AlertCircle className="h-5 w-5 text-yellow-500 animate-pulse" />
                      <span className="text-2xl font-bold text-yellow-500">Urgent</span>
                    </>
                  ) : (
                    <span className="text-2xl font-bold text-green-500">All Clear</span>
                  )}
                </div>
              </div>
              {pendingDeposits.length > 0 || pendingWithdrawals.length > 0 ? (
                <div className="relative">
                  <div className="absolute inset-0 bg-yellow-500 blur-xl opacity-50 animate-pulse"></div>
                  <AlertCircle className="h-8 w-8 text-yellow-500 relative" />
                </div>
              ) : (
                <Activity className="h-8 w-8 text-green-500" />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Deposits Card */}
        <Card 
          className="bg-gradient-to-br from-zinc-900 to-zinc-800 border-zinc-700 hover:border-green-500/50 transition-all duration-300 cursor-pointer group relative overflow-hidden"
          onClick={() => setLocation('/admin/deposits')}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          <CardHeader className="relative">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-green-500/10 rounded-lg group-hover:bg-green-500/20 transition-colors">
                <ArrowDownCircle className="h-8 w-8 text-green-500" />
              </div>
              {pendingDeposits.length > 0 && (
                <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/50 animate-pulse">
                  {pendingDeposits.length} Pending
                </Badge>
              )}
            </div>
            <CardTitle className="text-2xl text-white group-hover:text-green-400 transition-colors">
              Manage Deposits
            </CardTitle>
            <CardDescription className="text-gray-400">
              Review and process incoming deposit transactions
            </CardDescription>
          </CardHeader>
          <CardContent className="relative">
            <div className="space-y-3 mb-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Pending Deposits</span>
                <span className="text-xl font-bold text-yellow-500">
                  {depositsLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    pendingDeposits.length
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Recent (24h)</span>
                <span className="text-sm text-gray-400">
                  {recentDeposits} new
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between pt-4 border-t border-zinc-700">
              <span className="text-sm text-green-400 font-medium">View All Deposits</span>
              <ArrowRight className="h-5 w-5 text-green-400 group-hover:translate-x-1 transition-transform" />
            </div>
          </CardContent>
        </Card>

        {/* Withdrawals Card */}
        <Card 
          className="bg-gradient-to-br from-zinc-900 to-zinc-800 border-zinc-700 hover:border-red-500/50 transition-all duration-300 cursor-pointer group relative overflow-hidden"
          onClick={() => setLocation('/admin/withdrawals')}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          <CardHeader className="relative">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-red-500/10 rounded-lg group-hover:bg-red-500/20 transition-colors">
                <ArrowUpCircle className="h-8 w-8 text-red-500" />
              </div>
              {pendingWithdrawals.length > 0 && (
                <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/50 animate-pulse">
                  {pendingWithdrawals.length} Pending
                </Badge>
              )}
            </div>
            <CardTitle className="text-2xl text-white group-hover:text-red-400 transition-colors">
              Manage Withdrawals
            </CardTitle>
            <CardDescription className="text-gray-400">
              Review and process outgoing withdrawal requests
            </CardDescription>
          </CardHeader>
          <CardContent className="relative">
            <div className="space-y-3 mb-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Pending Withdrawals</span>
                <span className="text-xl font-bold text-yellow-500">
                  {withdrawalsLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    pendingWithdrawals.length
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Recent (24h)</span>
                <span className="text-sm text-gray-400">
                  {recentWithdrawals} new
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between pt-4 border-t border-zinc-700">
              <span className="text-sm text-red-400 font-medium">View All Withdrawals</span>
              <ArrowRight className="h-5 w-5 text-red-400 group-hover:translate-x-1 transition-transform" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity Section */}
      <div className="mt-8">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-[#f7931a]" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={() => setLocation('/admin/users')}
                className="p-4 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors text-left"
                data-testid="button-manage-users"
              >
                <p className="text-sm text-gray-400 mb-1">User Management</p>
                <p className="text-white font-medium">View All Users</p>
              </button>
              <button
                onClick={() => setLocation('/admin/addresses')}
                className="p-4 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors text-left"
                data-testid="button-manage-addresses"
              >
                <p className="text-sm text-gray-400 mb-1">Wallet Addresses</p>
                <p className="text-white font-medium">Manage Addresses</p>
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
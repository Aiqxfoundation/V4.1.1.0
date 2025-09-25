import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Users, UserCheck, UserX, UserMinus, ArrowRight, Activity, Ban
} from "lucide-react";
import { useLocation } from "wouter";

interface User {
  id: string;
  username: string;
  email?: string;
  usdtBalance: string;
  btcBalance: string;
  b2bBalance: string;
  hashPower: string;
  baseHashPower: string;
  referralHashBonus: string;
  totalReferralEarnings: string;
  totalReferralCodes: number;
  isAdmin: boolean;
  isFrozen: boolean;
  isBanned: boolean;
  miningActive: boolean;
  hasStartedMining?: boolean;
  hasPaidPurchase: boolean;
  createdAt: string;
  referralCode?: string;
  referredBy?: string;
}

export default function AdminUsers() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();


  // Query all users to get counts
  const { data: allUsers = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
    enabled: !!user?.isAdmin
  });

  // Categorize users for counts
  const activeUsers = allUsers.filter(u => !u.isFrozen && !u.isBanned && u.miningActive);
  const inactiveUsers = allUsers.filter(u => (u.isFrozen || !u.miningActive) && !u.isBanned);
  const bannedUsers = allUsers.filter(u => u.isBanned === true);
  const defaultUsers = allUsers.filter(u => {
    const hashPower = parseFloat(u.hashPower || "0");
    return hashPower === 100;
  });

  // Navigation function
  const navigateToCategory = (category: 'active' | 'inactive' | 'banned' | 'default') => {
    setLocation(`/admin/users/${category}`);
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">User Management</h1>
        <p className="text-gray-400">Select a category to manage users</p>
      </div>

      {/* Category Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Active Users Card */}
        <Card 
          className="bg-gradient-to-br from-green-900/20 to-zinc-900 border-green-500/30 hover:border-green-500 transition-all cursor-pointer group"
          onClick={() => navigateToCategory('active')}
          data-testid="card-active-users"
        >
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <UserCheck className="h-8 w-8 text-green-500" />
              <Activity className="h-4 w-4 text-green-400 animate-pulse" />
            </div>
            <CardTitle className="text-xl font-semibold text-white mt-3">
              Active Users
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="text-3xl font-bold text-white">
                {isLoading ? (
                  <span className="animate-pulse">...</span>
                ) : (
                  activeUsers.length.toLocaleString()
                )}
              </div>
              <p className="text-sm text-gray-400">
                Currently active and mining
              </p>
            </div>
            
            <Button 
              className="w-full bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-500/30 hover:border-green-500/50 group-hover:translate-x-1 transition-all"
              onClick={(e) => {
                e.stopPropagation();
                navigateToCategory('active');
              }}
              data-testid="button-view-active"
            >
              View Active Users
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>

        {/* Inactive Users Card */}
        <Card 
          className="bg-gradient-to-br from-yellow-900/20 to-zinc-900 border-yellow-500/30 hover:border-yellow-500 transition-all cursor-pointer group"
          onClick={() => navigateToCategory('inactive')}
          data-testid="card-inactive-users"
        >
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <UserX className="h-8 w-8 text-yellow-500" />
              <div className="h-2 w-2 bg-yellow-500 rounded-full" />
            </div>
            <CardTitle className="text-xl font-semibold text-white mt-3">
              Inactive Users
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="text-3xl font-bold text-white">
                {isLoading ? (
                  <span className="animate-pulse">...</span>
                ) : (
                  inactiveUsers.length.toLocaleString()
                )}
              </div>
              <p className="text-sm text-gray-400">
                Frozen or not mining
              </p>
            </div>
            
            <Button 
              className="w-full bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-400 border border-yellow-500/30 hover:border-yellow-500/50 group-hover:translate-x-1 transition-all"
              onClick={(e) => {
                e.stopPropagation();
                navigateToCategory('inactive');
              }}
              data-testid="button-view-inactive"
            >
              View Inactive Users
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>

        {/* Banned Users Card */}
        <Card 
          className="bg-gradient-to-br from-red-900/20 to-zinc-900 border-red-500/30 hover:border-red-500 transition-all cursor-pointer group"
          onClick={() => navigateToCategory('banned')}
          data-testid="card-banned-users"
        >
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <Ban className="h-8 w-8 text-red-500" />
              <div className="h-2 w-2 bg-red-500 rounded-full" />
            </div>
            <CardTitle className="text-xl font-semibold text-white mt-3">
              Banned Users
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="text-3xl font-bold text-white">
                {isLoading ? (
                  <span className="animate-pulse">...</span>
                ) : (
                  bannedUsers.length.toLocaleString()
                )}
              </div>
              <p className="text-sm text-gray-400">
                Currently banned users
              </p>
            </div>
            
            <Button 
              className="w-full bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 hover:border-red-500/50 group-hover:translate-x-1 transition-all"
              onClick={(e) => {
                e.stopPropagation();
                navigateToCategory('banned');
              }}
              data-testid="button-view-banned"
            >
              View Banned Users
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>

        {/* Default Users Card */}
        <Card 
          className="bg-gradient-to-br from-purple-900/20 to-zinc-900 border-purple-500/30 hover:border-purple-500 transition-all cursor-pointer group"
          onClick={() => navigateToCategory('default')}
          data-testid="card-default-users"
        >
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <UserMinus className="h-8 w-8 text-purple-500" />
              <div className="h-2 w-2 bg-purple-500 rounded-full animate-pulse" />
            </div>
            <CardTitle className="text-xl font-semibold text-white mt-3">
              Default Users
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="text-3xl font-bold text-white">
                {isLoading ? (
                  <span className="animate-pulse">...</span>
                ) : (
                  defaultUsers.length.toLocaleString()
                )}
              </div>
              <p className="text-sm text-gray-400">
                Base hash power (100 MH/s)
              </p>
            </div>
            
            <Button 
              className="w-full bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 border border-purple-500/30 hover:border-purple-500/50 group-hover:translate-x-1 transition-all"
              onClick={(e) => {
                e.stopPropagation();
                navigateToCategory('default');
              }}
              data-testid="button-view-default"
            >
              View Default Users
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Summary Stats */}
      <Card className="bg-zinc-900 border-zinc-800 mt-8">
        <CardHeader>
          <CardTitle className="text-lg font-medium text-gray-400">
            Total Platform Users
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-500" />
              <span className="text-2xl font-bold text-white">
                {isLoading ? (
                  <span className="animate-pulse">...</span>
                ) : (
                  allUsers.length.toLocaleString()
                )}
              </span>
            </div>
            <div className="flex gap-4 text-sm">
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 bg-green-500 rounded-full" />
                <span className="text-gray-400">
                  {allUsers.length > 0 ? ((activeUsers.length / allUsers.length) * 100).toFixed(1) : '0'}% Active
                </span>
              </div>
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 bg-yellow-500 rounded-full" />
                <span className="text-gray-400">
                  {allUsers.length > 0 ? ((inactiveUsers.length / allUsers.length) * 100).toFixed(1) : '0'}% Inactive
                </span>
              </div>
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 bg-red-500 rounded-full" />
                <span className="text-gray-400">
                  {allUsers.length > 0 ? ((bannedUsers.length / allUsers.length) * 100).toFixed(1) : '0'}% Banned
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
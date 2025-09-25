import { useState, useMemo, useCallback, memo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { formatHashPower } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  ArrowLeft, Ban, Search, UserX, Calendar, 
  Hash, ChevronLeft, ChevronRight, Shield, AlertTriangle
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

function BannedUsers() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [pageSize, setPageSize] = useState<string>("10");
  const [currentPage, setCurrentPage] = useState(1);

  // Query all users
  const { data: allUsers = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
    enabled: !!user?.isAdmin
  });

  // Memoize expensive filtering and sorting operations
  const bannedUsers = useMemo(() => 
    allUsers.filter(u => u.isBanned === true),
    [allUsers]
  );

  const searchedUsers = useMemo(() => {
    if (!searchQuery) return bannedUsers;
    const lowercaseQuery = searchQuery.toLowerCase();
    return bannedUsers.filter(u => 
      u.username.toLowerCase().includes(lowercaseQuery) ||
      (u.email && u.email.toLowerCase().includes(lowercaseQuery))
    );
  }, [bannedUsers, searchQuery]);

  const sortedUsers = useMemo(() => 
    [...searchedUsers].sort((a, b) => 
      a.username.toLowerCase().localeCompare(b.username.toLowerCase())
    ),
    [searchedUsers]
  );

  // Memoize pagination calculations
  const paginationData = useMemo(() => {
    const pageSizeNum = parseInt(pageSize);
    const totalPages = Math.ceil(sortedUsers.length / pageSizeNum);
    const paginatedUsers = sortedUsers.slice(
      (currentPage - 1) * pageSizeNum,
      currentPage * pageSizeNum
    );
    return { pageSizeNum, totalPages, paginatedUsers };
  }, [sortedUsers, pageSize, currentPage]);
  
  const { pageSizeNum, totalPages, paginatedUsers } = paginationData;

  // Unban mutation
  const unbanUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      await apiRequest('PUT', `/api/users/${userId}/unban`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "User Unbanned",
        description: "The user has been successfully unbanned.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to unban user",
        variant: "destructive"
      });
    }
  });

  // Memoize navigation functions
  const navigateToProfile = useCallback((userId: string) => {
    setLocation(`/admin/users/${userId}`);
  }, [setLocation]);

  const navigateBack = useCallback(() => {
    setLocation('/admin/users');
  }, [setLocation]);

  // Memoize date formatting function
  const formatDate = useCallback((dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }, []);

  // Memoize unban handler - FIX FOR HOOKS VIOLATION
  const handleUnban = useCallback((id: string) => (e: React.MouseEvent) => {
    e.stopPropagation();
    unbanUserMutation.mutate(id);
  }, [unbanUserMutation]);

  return (
    <div className="container mx-auto p-2 sm:p-4 md:p-6 space-y-4 sm:space-y-6 max-w-7xl">
      {/* Header with Back Button */}
      <div className="flex items-center gap-4 mb-6">
        <Button 
          variant="ghost" 
          size="icon"
          onClick={navigateBack}
          className="hover:bg-zinc-800"
          data-testid="button-back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <Ban className="h-8 w-8 text-red-500" />
            <div>
              <h1 className="text-3xl font-bold text-white">Banned Users</h1>
              <p className="text-gray-400">
                {isLoading ? "Loading..." : `${bannedUsers.length} users currently banned`}
              </p>
            </div>
          </div>
        </div>
        <AlertTriangle className="h-5 w-5 text-red-400" />
      </div>

      {/* Search and Controls */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by username or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-zinc-900 border-zinc-800 text-white"
            data-testid="input-search-banned"
          />
        </div>
        <Select value={pageSize} onValueChange={setPageSize}>
          <SelectTrigger className="w-full sm:w-[130px] bg-zinc-900 border-zinc-800 text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-800">
            <SelectItem value="10">10 per page</SelectItem>
            <SelectItem value="20">20 per page</SelectItem>
            <SelectItem value="50">50 per page</SelectItem>
            <SelectItem value="100">100 per page</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Banned Users Table */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 space-y-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : paginatedUsers.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-zinc-800 hover:bg-zinc-800/50">
                    <TableHead className="text-gray-400 font-medium">Username</TableHead>
                    <TableHead className="text-gray-400 font-medium hidden sm:table-cell">Registration</TableHead>
                    <TableHead className="text-gray-400 font-medium hidden md:table-cell">USDT Balance</TableHead>
                    <TableHead className="text-gray-400 font-medium hidden lg:table-cell">Hash Power</TableHead>
                    <TableHead className="text-gray-400 font-medium">Status</TableHead>
                    <TableHead className="text-gray-400 font-medium text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedUsers.map((bannedUser) => (
                    <TableRow 
                      key={bannedUser.id} 
                      className="border-zinc-800 hover:bg-zinc-800/30 cursor-pointer"
                      onClick={() => navigateToProfile(bannedUser.id)}
                      data-testid={`row-banned-user-${bannedUser.id}`}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <UserX className="h-4 w-4 text-red-400" />
                          <div>
                            <div className="text-white">{bannedUser.username}</div>
                            {bannedUser.isAdmin && (
                              <Badge variant="destructive" className="mt-1">
                                <Shield className="h-3 w-3 mr-1" />
                                Admin
                              </Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <div className="flex items-center gap-1 text-gray-400 text-sm">
                          <Calendar className="h-3 w-3" />
                          {formatDate(bannedUser.createdAt)}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span className="text-gray-300">${bannedUser.usdtBalance}</span>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <div className="flex items-center gap-1">
                          <Hash className="h-3 w-3 text-gray-400" />
                          <span className="text-gray-300">{formatHashPower(parseFloat(bannedUser.hashPower))}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="destructive" className="bg-red-500/20 text-red-400 border-red-500/30">
                          BANNED
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleUnban(bannedUser.id)}
                          disabled={unbanUserMutation.isPending}
                          className="border-green-500/30 text-green-400 hover:bg-green-500/10"
                          data-testid={`button-unban-${bannedUser.id}`}
                        >
                          {unbanUserMutation.isPending ? "Unbanning..." : "Unban"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="p-12 text-center">
              <Ban className="h-12 w-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 text-lg">
                {searchQuery ? "No banned users found matching your search" : "No banned users"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-400">
            Showing {((currentPage - 1) * pageSizeNum) + 1} to {Math.min(currentPage * pageSizeNum, sortedUsers.length)} of {sortedUsers.length} banned users
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="border-zinc-700 text-gray-400 hover:bg-zinc-800"
              data-testid="button-prev-page"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="border-zinc-700 text-gray-400 hover:bg-zinc-800"
              data-testid="button-next-page"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// Export without memo to fix typing with route components
export default BannedUsers;
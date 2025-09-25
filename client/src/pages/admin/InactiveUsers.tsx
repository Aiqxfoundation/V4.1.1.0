import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatHashPower } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  ArrowLeft, UserX, Search, Settings, Calendar, 
  Hash, ChevronLeft, ChevronRight, AlertCircle, Mail
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

export default function InactiveUsers() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [pageSize, setPageSize] = useState<string>("10");
  const [currentPage, setCurrentPage] = useState(1);


  // Query all users
  const { data: allUsers = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
    enabled: !!user?.isAdmin
  });

  // Filter for inactive users only (frozen or not mining)
  const inactiveUsers = allUsers.filter(u => (u.isFrozen || !u.miningActive) && !u.isBanned);

  // Apply search filter
  const searchedUsers = inactiveUsers.filter(u => 
    u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.email && u.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Sort alphabetically by username
  const sortedUsers = [...searchedUsers].sort((a, b) => 
    a.username.toLowerCase().localeCompare(b.username.toLowerCase())
  );

  // Pagination
  const pageSizeNum = parseInt(pageSize);
  const totalPages = Math.ceil(sortedUsers.length / pageSizeNum);
  const paginatedUsers = sortedUsers.slice(
    (currentPage - 1) * pageSizeNum,
    currentPage * pageSizeNum
  );

  // Navigation
  const navigateToProfile = (userId: string) => {
    setLocation(`/admin/users/${userId}`);
  };

  const navigateBack = () => {
    setLocation('/admin/users');
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

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
            <UserX className="h-8 w-8 text-yellow-500" />
            <div>
              <h1 className="text-3xl font-bold text-white">Inactive Users</h1>
              <p className="text-gray-400">
                {isLoading ? "Loading..." : `${inactiveUsers.length} users frozen or not mining`}
              </p>
            </div>
          </div>
        </div>
        <AlertCircle className="h-5 w-5 text-yellow-400" />
      </div>

      {/* Controls Bar */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search by username or email..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-10 bg-zinc-800 border-zinc-700 text-white placeholder-gray-500"
                  data-testid="input-search"
                />
              </div>
            </div>

            {/* Page Size Selector */}
            <Select value={pageSize} onValueChange={(value) => {
              setPageSize(value);
              setCurrentPage(1);
            }}>
              <SelectTrigger className="w-[200px] bg-zinc-800 border-zinc-700 text-white">
                <SelectValue placeholder="Users per page" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800">
                <SelectItem value="10">1-10 users per page</SelectItem>
                <SelectItem value="100">10-100 users per page</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-xl text-white">
            {searchQuery 
              ? `Found ${searchedUsers.length} inactive users matching "${searchQuery}"`
              : `All Inactive Users (${sortedUsers.length} total)`
            }
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center space-x-4">
                  <Skeleton className="h-12 w-12 rounded-full bg-zinc-800" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-1/4 bg-zinc-800" />
                    <Skeleton className="h-4 w-1/2 bg-zinc-800" />
                  </div>
                </div>
              ))}
            </div>
          ) : sortedUsers.length === 0 ? (
            <div className="text-center py-12">
              <UserX className="h-12 w-12 text-gray-500 mx-auto mb-4" />
              <p className="text-gray-400">No inactive users found</p>
              {searchQuery && (
                <p className="text-sm text-gray-500 mt-2">
                  Try adjusting your search query
                </p>
              )}
            </div>
          ) : (
            <>
              <div className="w-full overflow-x-auto rounded-lg border border-zinc-800">
                <Table>
                  <TableHeader>
                    <TableRow className="border-zinc-800 bg-zinc-900/50">
                      <TableHead className="text-gray-400 font-medium text-xs sm:text-sm">Username</TableHead>
                      <TableHead className="text-gray-400 font-medium text-xs sm:text-sm hidden md:table-cell">Email</TableHead>
                      <TableHead className="text-gray-400 font-medium text-xs sm:text-sm hidden sm:table-cell">Join Date</TableHead>
                      <TableHead className="text-gray-400 font-medium text-xs sm:text-sm">Hash Power</TableHead>
                      <TableHead className="text-right text-gray-400 font-medium text-xs sm:text-sm">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedUsers.map((user, index) => (
                      <TableRow 
                        key={user.id}
                        className={`
                          border-zinc-800 transition-colors
                          ${index % 2 === 0 ? 'bg-zinc-900/30' : 'bg-zinc-900/60'}
                          hover:bg-zinc-800/50
                        `}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-yellow-500/20 flex items-center justify-center">
                              <span className="text-yellow-500 text-xs font-semibold">
                                {user.username.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <p className="text-white font-medium">{user.username}</p>
                              <div className="flex gap-1 mt-1">
                                {user.isFrozen && (
                                  <Badge className="bg-yellow-500/20 text-yellow-400 text-xs">
                                    Frozen
                                  </Badge>
                                )}
                                {!user.miningActive && (
                                  <Badge className="bg-gray-500/20 text-gray-400 text-xs">
                                    Not Mining
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {user.email ? (
                            <div className="flex items-center gap-2 text-gray-300">
                              <Mail className="h-3 w-3 text-gray-500" />
                              <span className="text-sm">{user.email}</span>
                            </div>
                          ) : (
                            <span className="text-gray-500 text-sm">No email</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <div className="flex items-center gap-2 text-gray-300">
                            <Calendar className="h-3 w-3 text-gray-500" />
                            <span className="text-xs sm:text-sm">{formatDate(user.createdAt)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Hash className="h-3 w-3 text-[#f7931a]" />
                            <span className="text-[#f7931a] font-medium">
                              {formatHashPower(parseFloat(user.hashPower))}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => navigateToProfile(user.id)}
                            className="bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-white text-xs sm:text-sm"
                            data-testid={`button-settings-${user.username}`}
                          >
                            <Settings className="h-3 w-3 mr-0 sm:mr-1" />
                            <span className="hidden sm:inline">Settings</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6 px-2">
                  <p className="text-sm text-gray-400">
                    Showing {((currentPage - 1) * pageSizeNum) + 1}-{Math.min(currentPage * pageSizeNum, sortedUsers.length)} of {sortedUsers.length} users
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="bg-zinc-800 border-zinc-700 hover:bg-zinc-700 disabled:opacity-50"
                      data-testid="button-prev"
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Previous
                    </Button>
                    <div className="flex items-center gap-1 px-3">
                      <span className="text-sm text-gray-400">Page</span>
                      <span className="text-sm font-medium text-white">{currentPage}</span>
                      <span className="text-sm text-gray-400">of {totalPages}</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="bg-zinc-800 border-zinc-700 hover:bg-zinc-700 disabled:opacity-50"
                      data-testid="button-next"
                    >
                      Next
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
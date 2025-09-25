import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Loader2, 
  Search, 
  Copy, 
  ExternalLink, 
  CheckCircle, 
  XCircle,
  ArrowLeft,
  Filter,
  ArrowUpRight,
  RefreshCw
} from "lucide-react";
import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface Withdrawal {
  id: string;
  userId: string;
  user?: { username: string };
  type: 'withdrawal';
  amount: string;
  currency: string;
  network: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  address?: string;
  txHash?: string;
  createdAt: string;
  updatedAt: string;
}

export default function AdminWithdrawals() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"pending" | "completed" | "rejected">("pending");
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<Withdrawal | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<Withdrawal | null>(null);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [approveData, setApproveData] = useState({ txHash: "" });

  // Fetch all withdrawals
  const { data: allWithdrawals = [], isLoading, refetch } = useQuery<Withdrawal[]>({
    queryKey: ["/api/admin/withdrawals"],
    enabled: !!user?.isAdmin,
    refetchInterval: 10000, // Refresh every 10 seconds for instant updates
    refetchOnWindowFocus: true, // Refresh when admin returns to tab
    staleTime: 5000 // Consider data fresh for 5 seconds
  });

  // Filter withdrawals
  const filteredWithdrawals = allWithdrawals.filter(withdrawal => {
    const matchesSearch = 
      withdrawal.user?.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      withdrawal.txHash?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      false;
    const matchesStatus = withdrawal.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Count withdrawals by status
  const statusCounts = {
    pending: allWithdrawals.filter(w => w.status === 'pending').length,
    completed: allWithdrawals.filter(w => w.status === 'completed').length,
    rejected: allWithdrawals.filter(w => w.status === 'rejected').length
  };

  // Mutations
  const approveWithdrawalMutation = useMutation({
    mutationFn: async ({ id, txHash }: { id: string; txHash?: string }) => {
      const res = await apiRequest("PATCH", `/api/withdrawals/${id}/approve`, { txHash });
      return res.json();
    },
    onSuccess: () => {
      toast({ 
        title: "Success", 
        description: "Withdrawal has been processed successfully",
        className: "bg-green-500/20 border-green-500/50"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/withdrawals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/withdrawals/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/balances"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      setShowApproveDialog(false);
      setSelectedWithdrawal(null);
      setApproveData({ txHash: "" });
    },
    onError: () => {
      toast({ 
        title: "Error", 
        description: "Failed to approve withdrawal",
        variant: "destructive"
      });
    }
  });

  const rejectWithdrawalMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("PATCH", `/api/withdrawals/${id}/reject`);
      return res.json();
    },
    onSuccess: () => {
      toast({ 
        title: "Success", 
        description: "Withdrawal has been rejected",
        className: "bg-red-500/20 border-red-500/50"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/withdrawals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/withdrawals/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/balances"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
    },
    onError: () => {
      toast({ 
        title: "Error", 
        description: "Failed to reject withdrawal",
        variant: "destructive"
      });
    }
  });

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ 
        title: "Copied!", 
        description: `${label} copied to clipboard`,
        duration: 2000
      });
    } catch (error) {
      toast({ 
        title: "Failed to copy", 
        variant: "destructive",
        duration: 2000
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { className: "bg-yellow-500/20 text-yellow-500 border-yellow-500/50", icon: <Loader2 className="h-3 w-3 animate-spin" /> },
      approved: { className: "bg-green-500/20 text-green-500 border-green-500/50", icon: <CheckCircle className="h-3 w-3" /> },
      rejected: { className: "bg-red-500/20 text-red-500 border-red-500/50", icon: <XCircle className="h-3 w-3" /> },
      completed: { className: "bg-blue-500/20 text-blue-500 border-blue-500/50", icon: <CheckCircle className="h-3 w-3" /> }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    
    return (
      <Badge className={`${config.className} flex items-center gap-1`}>
        {config.icon}
        <span className="capitalize">{status}</span>
      </Badge>
    );
  };

  const getBlockchainExplorerUrl = (txHash: string, network: string) => {
    const explorers: Record<string, string> = {
      'BTC': `https://blockchair.com/bitcoin/transaction/${txHash}`,
      'ETH': `https://etherscan.io/tx/${txHash}`,
      'TRC20': `https://tronscan.org/#/transaction/${txHash}`,
      'ERC20': `https://etherscan.io/tx/${txHash}`,
      'BEP20': `https://bscscan.com/tx/${txHash}`
    };
    return explorers[network] || '#';
  };

  const handleApproveWithdrawal = (withdrawal: Withdrawal) => {
    setSelectedWithdrawal(withdrawal);
    setApproveData({ txHash: "" });
    setShowApproveDialog(true);
  };

  const getStatusBadgeColor = (status?: string) => {
    switch(status) {
      case 'pending': return 'bg-yellow-500/20 text-yellow-500 border-yellow-500/50';
      case 'approved': return 'bg-green-500/20 text-green-500 border-green-500/50';
      case 'completed': return 'bg-green-500/20 text-green-500 border-green-500/50';
      case 'rejected': return 'bg-red-500/20 text-red-500 border-red-500/50';
      default: return 'bg-gray-500/20 text-gray-500 border-gray-500/50';
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  const handleReject = (id: string) => {
    rejectWithdrawalMutation.mutate(id);
  };

  return (
    <div className="min-h-screen bg-black text-white px-1 py-2 pb-24">
      {/* Header */}
      <div className="mb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation('/admin/transactions')}
              className="hover:bg-zinc-800"
              data-testid="button-back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold text-white">Withdrawal Management</h1>
          </div>
          <Button
            onClick={() => refetch()}
            variant="outline"
            size="sm"
            className="border-zinc-700 hover:bg-zinc-800"
            data-testid="button-refresh"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardContent className="p-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search by username or transaction hash..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-zinc-800 border-zinc-700 text-white placeholder-gray-400"
              data-testid="input-search"
            />
          </div>
        </CardContent>
      </Card>

      {/* Filter Tabs and Table */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <Tabs defaultValue="pending" onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}>
            <TabsList className="grid w-full grid-cols-3 bg-zinc-800 gap-0">
              <TabsTrigger value="pending" className="text-[10px] sm:text-sm px-1 data-[state=active]:bg-[#f7931a] data-[state=active]:text-black">
                Pending ({statusCounts.pending})
              </TabsTrigger>
              <TabsTrigger value="completed" className="text-[10px] sm:text-sm px-1 data-[state=active]:bg-[#f7931a] data-[state=active]:text-black">
                Completed ({statusCounts.completed})
              </TabsTrigger>
              <TabsTrigger value="rejected" className="text-[10px] sm:text-sm px-1 data-[state=active]:bg-[#f7931a] data-[state=active]:text-black">
                Rejected ({statusCounts.rejected})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-[#f7931a]" />
            </div>
          ) : filteredWithdrawals.length === 0 ? (
            <div className="text-center py-12">
              <Filter className="h-12 w-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-500">No withdrawals found</p>
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="sm:hidden space-y-2 p-3">
                {filteredWithdrawals.map((withdrawal) => (
                  <Card 
                    key={withdrawal.id}
                    className="bg-zinc-900 border-zinc-800 p-3 cursor-pointer active:bg-zinc-800"
                    onClick={() => setSelectedTransaction(withdrawal)}
                    data-testid={`card-withdrawal-${withdrawal.id}`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{withdrawal.user?.username || 'Unknown'}</p>
                        <p className="text-red-400 font-bold">
                          {withdrawal.currency === 'USDT' ? '$' : ''}
                          {parseFloat(withdrawal.amount).toFixed(withdrawal.currency === 'USDT' ? 2 : 4)}
                          {withdrawal.currency !== 'USDT' ? ' ' + withdrawal.currency : ''}
                        </p>
                        <p className="text-[10px] text-gray-400">
                          {new Date(withdrawal.createdAt).toLocaleDateString()} {new Date(withdrawal.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge className={getStatusBadgeColor(withdrawal.status)}>
                          {withdrawal.status}
                        </Badge>
                        {withdrawal.status === 'pending' && (
                          <div className="mt-2 space-x-1">
                            <Button 
                              size="sm" 
                              className="h-6 px-2 text-[10px] bg-green-600 hover:bg-green-700"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleApproveWithdrawal(withdrawal);
                              }}
                              data-testid={`button-quick-approve-${withdrawal.id}`}
                            >
                              ✓
                            </Button>
                            <Button 
                              size="sm" 
                              variant="destructive" 
                              className="h-6 px-2 text-[10px]"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleReject(withdrawal.id);
                              }}
                              data-testid={`button-quick-reject-${withdrawal.id}`}
                            >
                              ✗
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
              
              {/* Desktop Table View */}
              <div className="hidden sm:block w-full overflow-x-auto">
                <Table>
                <TableHeader>
                  <TableRow className="border-zinc-800 hover:bg-transparent">
                    <TableHead className="text-[10px] text-gray-400 px-1 py-1">Username</TableHead>
                    <TableHead className="text-[10px] text-gray-400 px-1 py-1">Amount</TableHead>
                    <TableHead className="hidden sm:table-cell text-[10px] text-gray-400 px-1 py-1">Currency</TableHead>
                    <TableHead className="text-[10px] text-gray-400 px-1 py-1 hidden sm:table-cell">Network</TableHead>
                    <TableHead className="text-[10px] text-gray-400 px-1 py-1 hidden md:table-cell">Address</TableHead>
                    <TableHead className="text-[10px] text-gray-400 px-1 py-1">TxHash</TableHead>
                    <TableHead className="text-[10px] text-gray-400 px-1 py-1">Date</TableHead>
                    <TableHead className="text-[10px] text-gray-400 px-1 py-1">Status</TableHead>
                    <TableHead className="text-[10px] text-gray-400 px-1 py-1">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredWithdrawals.map((withdrawal) => (
                    <TableRow 
                      key={withdrawal.id} 
                      className="border-zinc-800 hover:bg-zinc-800/50 transition-colors"
                    >
                      <TableCell className="font-medium text-[11px] px-1 py-2">{withdrawal.user?.username || 'N/A'}</TableCell>
                      <TableCell className="text-[11px] px-1 py-2">
                        <span className="text-red-500 font-semibold">
                          <span className="sm:hidden">
                            {withdrawal.currency === 'USDT' ? '$' : ''}
                            {withdrawal.currency === 'USDT' ? Math.round(parseFloat(withdrawal.amount)) : parseFloat(withdrawal.amount).toFixed(4)}
                          </span>
                          <span className="hidden sm:inline">
                            {withdrawal.currency === 'USDT' ? '$' : ''}
                            {parseFloat(withdrawal.amount).toFixed(withdrawal.currency === 'USDT' ? 2 : 8)}
                          </span>
                        </span>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-[11px] px-1 py-2">
                        <Badge variant="outline" className="border-zinc-700">
                          {withdrawal.currency}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-[11px] px-1 py-2 hidden sm:table-cell">
                        <Badge variant="outline" className="border-zinc-700">
                          {withdrawal.network}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-[11px] px-1 py-2 hidden md:table-cell">
                        {withdrawal.address ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400 max-w-[100px] truncate">
                              {withdrawal.address}
                            </span>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 hover:bg-zinc-700"
                              onClick={() => copyToClipboard(withdrawal.address!, 'Wallet address')}
                              data-testid={`button-copy-address-${withdrawal.id}`}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <span className="text-gray-600">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-[11px] px-1 py-2">
                        {withdrawal.txHash ? (
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-gray-400">
                              <span className="sm:hidden">{withdrawal.txHash.slice(0, 6)}...</span>
                              <span className="hidden sm:inline max-w-[100px] truncate">{withdrawal.txHash}</span>
                            </span>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 hover:bg-zinc-700"
                              onClick={() => copyToClipboard(withdrawal.txHash!, 'Transaction hash')}
                              data-testid={`button-copy-tx-${withdrawal.id}`}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 hover:bg-zinc-700"
                              onClick={() => window.open(getBlockchainExplorerUrl(withdrawal.txHash!, withdrawal.network), '_blank')}
                              data-testid={`button-explorer-${withdrawal.id}`}
                            >
                              <ExternalLink className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <span className="text-gray-600">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-[11px] px-1 py-2 text-gray-400">
                        <span className="sm:hidden">{new Date(withdrawal.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                        <span className="hidden sm:inline">{new Date(withdrawal.createdAt).toLocaleString()}</span>
                      </TableCell>
                      <TableCell className="text-[11px] px-1 py-2">{getStatusBadge(withdrawal.status)}</TableCell>
                      <TableCell className="text-[11px] px-1 py-2">
                        {withdrawal.status === 'pending' ? (
                          <div className="flex gap-2">
                            <Button
                              className="h-6 px-1 text-[10px] sm:h-7 sm:px-2 sm:text-xs bg-green-500 hover:bg-green-600 text-white"
                              onClick={() => handleApproveWithdrawal(withdrawal)}
                              data-testid={`button-approve-${withdrawal.id}`}
                            >
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Approve
                            </Button>
                            <Button
                              className="h-6 px-1 text-[10px] sm:h-7 sm:px-2 sm:text-xs"
                              variant="destructive"
                              onClick={() => rejectWithdrawalMutation.mutate(withdrawal.id)}
                              data-testid={`button-reject-${withdrawal.id}`}
                            >
                              <XCircle className="h-3 w-3 mr-1" />
                              Reject
                            </Button>
                          </div>
                        ) : (
                          <span className="text-gray-600">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Approve Withdrawal Dialog */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle>Approve Withdrawal</DialogTitle>
            <DialogDescription>
              Confirm the withdrawal details and add the transaction hash after processing
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Username</Label>
              <Input
                value={selectedWithdrawal?.user?.username || ''}
                disabled
                className="bg-zinc-800 border-zinc-700"
              />
            </div>
            <div>
              <Label>Amount</Label>
              <Input
                value={`${selectedWithdrawal?.amount} ${selectedWithdrawal?.currency}`}
                disabled
                className="bg-zinc-800 border-zinc-700"
              />
            </div>
            <div>
              <Label>Wallet Address</Label>
              <Input
                value={selectedWithdrawal?.address || ''}
                disabled
                className="bg-zinc-800 border-zinc-700"
              />
            </div>
            <div>
              <Label>Transaction Hash (optional)</Label>
              <Input
                value={approveData.txHash}
                onChange={(e) => setApproveData(prev => ({ ...prev, txHash: e.target.value }))}
                placeholder="Enter transaction hash after processing"
                className="bg-zinc-800 border-zinc-700"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowApproveDialog(false)}
              className="border-zinc-700"
            >
              Cancel
            </Button>
            <Button
              className="bg-green-500 hover:bg-green-600"
              onClick={() => {
                if (selectedWithdrawal) {
                  approveWithdrawalMutation.mutate({
                    id: selectedWithdrawal.id,
                    txHash: approveData.txHash || undefined
                  });
                }
              }}
              disabled={approveWithdrawalMutation.isPending}
            >
              {approveWithdrawalMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              Approve Withdrawal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transaction Detail Dialog */}
      <Dialog open={!!selectedTransaction} onOpenChange={() => setSelectedTransaction(null)}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-md">
          <DialogHeader>
            <DialogTitle>Transaction Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <p className="text-[10px] text-gray-400">Username</p>
              <p className="text-sm font-medium">{selectedTransaction?.user?.username || 'N/A'}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400">Amount</p>
              <p className="text-lg font-bold text-red-400">
                {selectedTransaction?.currency === 'USDT' ? '$' : ''}
                {selectedTransaction?.amount} {selectedTransaction?.currency}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400">Network</p>
              <p className="text-sm">{selectedTransaction?.network}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400">Transaction Hash</p>
              <div className="flex items-center gap-2">
                <p className="text-xs truncate flex-1">{selectedTransaction?.txHash || 'N/A'}</p>
                {selectedTransaction?.txHash && (
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    onClick={() => copyToClipboard(selectedTransaction.txHash!, 'Transaction hash')}
                    data-testid="button-copy-tx-detail"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
            <div>
              <p className="text-[10px] text-gray-400">Withdrawal Address</p>
              <div className="flex items-center gap-2">
                <p className="text-xs truncate flex-1">{selectedTransaction?.address || 'N/A'}</p>
                {selectedTransaction?.address && (
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    onClick={() => copyToClipboard(selectedTransaction.address!, 'Withdrawal address')}
                    data-testid="button-copy-address-detail"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
            <div>
              <p className="text-[10px] text-gray-400">Date & Time</p>
              <p className="text-sm">{formatDate(selectedTransaction?.createdAt)}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400">Status</p>
              <Badge className={getStatusBadgeColor(selectedTransaction?.status)}>
                {selectedTransaction?.status}
              </Badge>
            </div>
          </div>
          {selectedTransaction?.status === 'pending' && (
            <DialogFooter className="mt-4">
              <Button 
                className="bg-green-600 hover:bg-green-700 flex-1"
                onClick={() => {
                  setSelectedWithdrawal(selectedTransaction);
                  setSelectedTransaction(null);
                  setShowApproveDialog(true);
                }}
                data-testid="button-approve-detail"
              >
                Approve
              </Button>
              <Button 
                variant="destructive" 
                className="flex-1"
                onClick={() => {
                  handleReject(selectedTransaction.id);
                  setSelectedTransaction(null);
                }}
                data-testid="button-reject-detail"
              >
                Reject
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
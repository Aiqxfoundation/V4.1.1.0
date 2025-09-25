import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { formatHashPower } from "@/lib/utils";
import { useLocation, useRoute } from "wouter";
import { 
  ArrowLeft, Loader2, User, Wallet, Activity, Users2, Hash, 
  Ban, Pause, Play, Edit, CheckCircle, AlertTriangle, 
  TrendingUp, TrendingDown, Calendar, DollarSign,
  Code, UserCheck, UserX, Coins, Users, ArrowUpRight
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";

interface UserDetails {
  id: string;
  username: string;
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
  hasPaidPurchase: boolean;
  createdAt: string;
  referralCode?: string;
  referredBy?: string;
}

interface Transaction {
  id: string;
  type: 'deposit' | 'withdrawal' | 'transfer_in' | 'transfer_out';
  amount: string;
  currency: string;
  status: string;
  createdAt: string;
  txHash?: string;
  userId?: string;  // The user who initiated the transaction
  fromUser?: string;
  toUser?: string;
}

interface ReferralCode {
  id: string;
  code: string;
  isUsed: boolean;
  usedBy?: string;
  usedByUsername?: string;
  createdAt: string;
}

export default function UserProfile(): JSX.Element {
  const { user: adminUser } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/admin/users/:userId");
  const userId = params?.userId;
  
  // Separate states for each balance edit dialog
  const [showUsdtEdit, setShowUsdtEdit] = useState(false);
  const [showBtcEdit, setShowBtcEdit] = useState(false);
  const [showB2bEdit, setShowB2bEdit] = useState(false);
  const [showHashPowerEdit, setShowHashPowerEdit] = useState(false);
  
  // Separate states for each balance edit value
  const [usdtEdit, setUsdtEdit] = useState("");
  const [btcEdit, setBtcEdit] = useState("");
  const [b2bEdit, setB2bEdit] = useState("");
  const [hashPowerEdit, setHashPowerEdit] = useState("");

  // Fetch user details
  const { data: allUsers = [], isLoading: isLoadingUsers } = useQuery<UserDetails[]>({
    queryKey: ["/api/admin/users"],
    enabled: !!adminUser?.isAdmin
  });

  const userDetails = allUsers.find(u => u.id === userId);

  // Fetch transactions
  const { data: transactions = [], isLoading: isLoadingTransactions } = useQuery<Transaction[]>({
    queryKey: ["/api/admin/transactions"],
    enabled: !!adminUser?.isAdmin
  });

  // Filter transactions by userId - check all possible fields
  const userTransactions = transactions.filter(t => {
    // Check if the transaction belongs to this user
    return t.userId === userId || 
           t.fromUser === userId || 
           t.toUser === userId;
  });

  // Group transactions by asset type
  const usdtTransactions = userTransactions.filter(t => t.currency === 'USDT');
  const btcTransactions = userTransactions.filter(t => t.currency === 'BTC');
  const b2bTransactions = userTransactions.filter(t => t.currency === 'B2B');

  // Fetch referral data
  const { data: referrals = [], isLoading: isLoadingReferrals } = useQuery<any[]>({
    queryKey: ["/api/admin/referrals"],
    enabled: !!adminUser?.isAdmin
  });

  // Calculate referral statistics - now using username as referredBy
  const referredUsers = allUsers.filter(u => u.referredBy === userDetails?.username);
  const verifiedReferrals = referredUsers.filter(u => u.hasPaidPurchase);
  const unverifiedReferrals = referredUsers.filter(u => !u.hasPaidPurchase);

  // Calculate transaction totals
  const deposits = userTransactions.filter(t => t.type === 'deposit');
  const withdrawals = userTransactions.filter(t => t.type === 'withdrawal');
  const transfersIn = userTransactions.filter(t => t.type === 'transfer_in' || (t.type as any === 'transfer' && t.toUser === userId));
  const transfersOut = userTransactions.filter(t => t.type === 'transfer_out' || (t.type as any === 'transfer' && t.fromUser === userId));
  
  const totalDeposits = deposits.reduce((sum, t) => sum + parseFloat(t.amount), 0);
  const totalWithdrawals = withdrawals.reduce((sum, t) => sum + parseFloat(t.amount), 0);
  const totalTransfersIn = transfersIn.reduce((sum, t) => sum + parseFloat(t.amount), 0);
  const totalTransfersOut = transfersOut.reduce((sum, t) => sum + parseFloat(t.amount), 0);
  
  const depositCount = deposits.length;
  const withdrawalCount = withdrawals.length;
  const transferInCount = transfersIn.length;
  const transferOutCount = transfersOut.length;

  // Mutations
  const freezeUserMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/users/${userId}/freeze`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "User Frozen", description: "User account has been frozen" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Action Failed", 
        description: error.message || "Failed to freeze user account",
        variant: "destructive"
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    }
  });

  const unfreezeUserMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/users/${userId}/unfreeze`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "User Unfrozen", description: "User account has been unfrozen" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Action Failed", 
        description: error.message || "Failed to unfreeze user account",
        variant: "destructive"
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    }
  });

  const banUserMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/users/${userId}/ban`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "User Banned", description: "User has been banned", variant: "destructive" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Action Failed", 
        description: error.message || "Failed to ban user",
        variant: "destructive"
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    }
  });

  const unbanUserMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/users/${userId}/unban`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "User Unbanned", description: "User has been unbanned" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Action Failed", 
        description: error.message || "Failed to unban user",
        variant: "destructive"
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    }
  });

  const suspendMiningMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/admin/users/${userId}/suspend-mining`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Mining Suspended", description: "User's mining has been suspended" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Action Failed", 
        description: error.message || "Failed to suspend mining",
        variant: "destructive"
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    }
  });

  const resumeMiningMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/admin/users/${userId}/resume-mining`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Mining Resumed", description: "User's mining has been resumed" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Action Failed", 
        description: error.message || "Failed to resume mining",
        variant: "destructive"
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    }
  });

  // Individual mutations for each balance type
  const updateUsdtMutation = useMutation({
    mutationFn: async (value: string) => {
      const res = await apiRequest("PATCH", `/api/admin/users/${userId}/balances`, { usdt: value });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "USDT Balance Updated", description: "USDT balance has been updated" });
      setShowUsdtEdit(false);
    },
    onError: (error: any) => {
      toast({ 
        title: "Update Failed", 
        description: error.message || "Failed to update USDT balance",
        variant: "destructive"
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    }
  });

  const updateBtcMutation = useMutation({
    mutationFn: async (value: string) => {
      const res = await apiRequest("PATCH", `/api/admin/users/${userId}/balances`, { btc: value });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "BTC Balance Updated", description: "BTC balance has been updated" });
      setShowBtcEdit(false);
    },
    onError: (error: any) => {
      toast({ 
        title: "Update Failed", 
        description: error.message || "Failed to update BTC balance",
        variant: "destructive"
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    }
  });

  const updateB2bMutation = useMutation({
    mutationFn: async (value: string) => {
      const res = await apiRequest("PATCH", `/api/admin/users/${userId}/balances`, { b2b: value });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "B2B Balance Updated", description: "B2B balance has been updated" });
      setShowB2bEdit(false);
    },
    onError: (error: any) => {
      toast({ 
        title: "Update Failed", 
        description: error.message || "Failed to update B2B balance",
        variant: "destructive"
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    }
  });

  const updateHashPowerMutation = useMutation({
    mutationFn: async (value: string) => {
      const res = await apiRequest("PATCH", `/api/admin/users/${userId}/balances`, { hashPower: value });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Hash Power Updated", description: "Hash power has been updated" });
      setShowHashPowerEdit(false);
    },
    onError: (error: any) => {
      toast({ 
        title: "Update Failed", 
        description: error.message || "Failed to update hash power",
        variant: "destructive"
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    }
  });

  // Individual handler functions for each balance
  const handleEditUsdt = () => {
    if (userDetails) {
      setUsdtEdit(userDetails.usdtBalance);
      setShowUsdtEdit(true);
    }
  };

  const handleEditBtc = () => {
    if (userDetails) {
      setBtcEdit(userDetails.btcBalance);
      setShowBtcEdit(true);
    }
  };

  const handleEditB2b = () => {
    if (userDetails) {
      setB2bEdit(userDetails.b2bBalance);
      setShowB2bEdit(true);
    }
  };

  const handleEditHashPower = () => {
    if (userDetails) {
      setHashPowerEdit(userDetails.hashPower);
      setShowHashPowerEdit(true);
    }
  };

  // Validate and format balance input
  const validateAndFormatBalance = (value: string, decimals: number, min: number = 0, max: number = 1000000000): { valid: boolean; formatted: string; error?: string } => {
    const parsed = parseFloat(value);
    
    if (value === '' || isNaN(parsed)) {
      return { valid: false, formatted: '', error: 'Please enter a valid number' };
    }
    
    if (parsed < min) {
      return { valid: false, formatted: value, error: `Minimum value is ${min}` };
    }
    
    if (parsed > max) {
      return { valid: false, formatted: value, error: `Maximum value is ${max.toLocaleString()}` };
    }
    
    return { valid: true, formatted: parsed.toFixed(decimals) };
  };

  if (isLoadingUsers) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-[#f7931a]" />
      </div>
    );
  }

  if (!userDetails) {
    return (
      <div className="container mx-auto p-4 sm:p-6">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-6">
            <p className="text-red-500">User not found</p>
            <Button 
              onClick={() => setLocation('/admin/users')} 
              className="mt-4"
              variant="outline"
            >
              Back to Users
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-2 sm:p-4 md:p-6 space-y-4 sm:space-y-6 max-w-7xl">
      {/* Edit Balance Dialogs - Only render when userDetails is available */}
      <Dialog open={showUsdtEdit} onOpenChange={setShowUsdtEdit}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle>Edit USDT Balance</DialogTitle>
            <DialogDescription>
              Update {userDetails.username}'s USDT balance. Current balance: ${parseFloat(userDetails.usdtBalance).toFixed(2)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="usdt-balance">New Balance</Label>
              <Input
                id="usdt-balance"
                type="number"
                step="0.01"
                value={usdtEdit}
                onChange={(e) => setUsdtEdit(e.target.value)}
                className="bg-zinc-800 border-zinc-700 text-white"
                placeholder="Enter new balance"
                data-testid="input-usdt-balance"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowUsdtEdit(false)}
              className="border-zinc-700 hover:bg-zinc-800"
              data-testid="button-cancel-usdt"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                const validation = validateAndFormatBalance(usdtEdit, 2, 0, 10000000);
                if (validation.valid) {
                  updateUsdtMutation.mutate(validation.formatted);
                } else {
                  toast({ title: "Invalid Input", description: validation.error, variant: "destructive" });
                }
              }}
              className="bg-[#f7931a] hover:bg-[#f7931a]/80"
              disabled={updateUsdtMutation.isPending || !usdtEdit || isNaN(parseFloat(usdtEdit)) || parseFloat(usdtEdit) < 0}
              data-testid="button-save-usdt"
            >
              {updateUsdtMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showBtcEdit} onOpenChange={setShowBtcEdit}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle>Edit BTC Balance</DialogTitle>
            <DialogDescription>
              Update {userDetails.username}'s BTC balance. Current balance: {parseFloat(userDetails.btcBalance).toFixed(8)} BTC
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="btc-balance">New Balance</Label>
              <Input
                id="btc-balance"
                type="number"
                step="0.00000001"
                value={btcEdit}
                onChange={(e) => setBtcEdit(e.target.value)}
                className="bg-zinc-800 border-zinc-700 text-white"
                placeholder="Enter new balance"
                data-testid="input-btc-balance"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowBtcEdit(false)}
              className="border-zinc-700 hover:bg-zinc-800"
              data-testid="button-cancel-btc"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                const validation = validateAndFormatBalance(btcEdit, 8, 0, 21000000);
                if (validation.valid) {
                  updateBtcMutation.mutate(validation.formatted);
                } else {
                  toast({ title: "Invalid Input", description: validation.error, variant: "destructive" });
                }
              }}
              className="bg-[#f7931a] hover:bg-[#f7931a]/80"
              disabled={updateBtcMutation.isPending || !btcEdit || isNaN(parseFloat(btcEdit)) || parseFloat(btcEdit) < 0}
              data-testid="button-save-btc"
            >
              {updateBtcMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showB2bEdit} onOpenChange={setShowB2bEdit}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle>Edit B2B Balance</DialogTitle>
            <DialogDescription>
              Update {userDetails.username}'s B2B balance. Current balance: {parseFloat(userDetails.b2bBalance).toFixed(8)} B2B
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="b2b-balance">New Balance</Label>
              <Input
                id="b2b-balance"
                type="number"
                step="0.00000001"
                value={b2bEdit}
                onChange={(e) => setB2bEdit(e.target.value)}
                className="bg-zinc-800 border-zinc-700 text-white"
                placeholder="Enter new balance"
                data-testid="input-b2b-balance"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowB2bEdit(false)}
              className="border-zinc-700 hover:bg-zinc-800"
              data-testid="button-cancel-b2b"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                const validation = validateAndFormatBalance(b2bEdit, 8, 0, 100000000);
                if (validation.valid) {
                  updateB2bMutation.mutate(validation.formatted);
                } else {
                  toast({ title: "Invalid Input", description: validation.error, variant: "destructive" });
                }
              }}
              className="bg-[#f7931a] hover:bg-[#f7931a]/80"
              disabled={updateB2bMutation.isPending || !b2bEdit || isNaN(parseFloat(b2bEdit)) || parseFloat(b2bEdit) < 0}
              data-testid="button-save-b2b"
            >
              {updateB2bMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showHashPowerEdit} onOpenChange={setShowHashPowerEdit}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle>Edit Hash Power</DialogTitle>
            <DialogDescription>
              Update {userDetails.username}'s hash power. Current hash power: {formatHashPower(parseFloat(userDetails.hashPower))}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="hashpower-balance">New Hash Power (MH/s)</Label>
              <Input
                id="hashpower-balance"
                type="number"
                step="0.01"
                value={hashPowerEdit}
                onChange={(e) => setHashPowerEdit(e.target.value)}
                className="bg-zinc-800 border-zinc-700 text-white"
                placeholder="Enter new hash power"
                data-testid="input-hashpower-balance"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowHashPowerEdit(false)}
              className="border-zinc-700 hover:bg-zinc-800"
              data-testid="button-cancel-hashpower"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                const validation = validateAndFormatBalance(hashPowerEdit, 2, 0, 1000000000);
                if (validation.valid) {
                  updateHashPowerMutation.mutate(validation.formatted);
                } else {
                  toast({ title: "Invalid Input", description: validation.error, variant: "destructive" });
                }
              }}
              className="bg-[#f7931a] hover:bg-[#f7931a]/80"
              disabled={updateHashPowerMutation.isPending || !hashPowerEdit || isNaN(parseFloat(hashPowerEdit)) || parseFloat(hashPowerEdit) < 0}
              data-testid="button-save-hashpower"
            >
              {updateHashPowerMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Back Button */}
      <Button 
        onClick={() => setLocation('/admin/users')} 
        variant="ghost" 
        className="hover:bg-zinc-800"
        data-testid="button-back"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Users
      </Button>

      {/* User Header Section */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-[#f7931a] to-[#f7931a]/60 rounded-full flex items-center justify-center">
                <User className="h-8 w-8 text-white" />
              </div>
              <div>
                <CardTitle className="text-2xl text-white mb-1">
                  {userDetails.username}
                </CardTitle>
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 text-sm text-gray-400">
                  <span>ID: {userDetails.id.slice(0, 8)}</span>
                  <span>Joined: {new Date(userDetails.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex gap-2 mt-2">
                  {userDetails.isBanned ? (
                    <Badge className="bg-red-500/20 text-red-500">Banned</Badge>
                  ) : userDetails.isFrozen ? (
                    <Badge className="bg-yellow-500/20 text-yellow-500">Frozen</Badge>
                  ) : (
                    <Badge className="bg-green-500/20 text-green-500">Active</Badge>
                  )}
                  {userDetails.miningActive && (
                    <Badge className="bg-[#f7931a]/20 text-[#f7931a]">Mining Active</Badge>
                  )}
                  {userDetails.isAdmin && (
                    <Badge className="bg-purple-500/20 text-purple-500">Admin</Badge>
                  )}
                </div>
              </div>
            </div>
            
            {/* Quick Actions */}
            <div className="flex gap-2">
              {userDetails.isFrozen ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => unfreezeUserMutation.mutate()}
                  className="border-green-500/50 text-green-500 hover:bg-green-500/10"
                  data-testid="button-unfreeze"
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Unfreeze
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => freezeUserMutation.mutate()}
                  className="border-yellow-500/50 text-yellow-500 hover:bg-yellow-500/10"
                  data-testid="button-freeze"
                >
                  <Pause className="h-4 w-4 mr-1" />
                  Freeze
                </Button>
              )}
              {userDetails.isBanned ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => unbanUserMutation.mutate()}
                  className="border-green-500/50 text-green-500 hover:bg-green-500/10"
                  data-testid="button-unban"
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Unban
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => banUserMutation.mutate()}
                  className="border-red-500/50 text-red-500 hover:bg-red-500/10"
                  data-testid="button-ban"
                >
                  <Ban className="h-4 w-4 mr-1" />
                  Ban
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="bg-zinc-900 border border-zinc-800">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="mining">Mining</TabsTrigger>
          <TabsTrigger value="referrals">Referrals</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Balance Cards */}
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-400 flex items-center justify-between">
                  <span>
                    <DollarSign className="inline h-4 w-4 mr-1" />
                    USDT Balance
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleEditUsdt}
                    className="h-6 w-6 p-0 hover:bg-zinc-800"
                    data-testid="button-edit-usdt"
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl sm:text-3xl font-bold text-green-500 break-all">
                  ${parseFloat(userDetails.usdtBalance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-400 flex items-center justify-between">
                  <span>
                    <Coins className="inline h-4 w-4 mr-1" />
                    B2B Balance
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleEditB2b}
                    className="h-6 w-6 p-0 hover:bg-zinc-800"
                    data-testid="button-edit-b2b"
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl sm:text-3xl font-bold text-purple-500 break-all">
                  {parseFloat(userDetails.b2bBalance).toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 8 })}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-400 flex items-center justify-between">
                  <span>
                    <Wallet className="inline h-4 w-4 mr-1" />
                    BTC Balance
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleEditBtc}
                    className="h-6 w-6 p-0 hover:bg-zinc-800"
                    data-testid="button-edit-btc"
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl sm:text-3xl font-bold text-[#f7931a] break-all">
                  {parseFloat(userDetails.btcBalance).toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 8 })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Transaction Summary Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Total Deposits
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-500 mb-1">
                  ${totalDeposits.toFixed(2)}
                </div>
                <p className="text-sm text-gray-400">
                  {depositCount} transaction{depositCount !== 1 ? 's' : ''}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
                  <ArrowUpRight className="h-4 w-4" />
                  Total Withdrawals
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-500 mb-1">
                  ${totalWithdrawals.toFixed(2)}
                </div>
                <p className="text-sm text-gray-400">
                  {withdrawalCount} transaction{withdrawalCount !== 1 ? 's' : ''}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Referral Statistics Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Users Referred
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-[#f7931a] mb-1">
                  {referredUsers.length}
                </div>
                <p className="text-sm text-gray-400">
                  {verifiedReferrals.length} verified, {unverifiedReferrals.length} unverified
                </p>
              </CardContent>
            </Card>

            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Combined Referral Hashrate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-[#f7931a] mb-1">
                  {formatHashPower(referredUsers.reduce((sum, u) => sum + parseFloat(u.hashPower || '0'), 0))}
                </div>
                <p className="text-sm text-gray-400">
                  From {referredUsers.length} referred user{referredUsers.length !== 1 ? 's' : ''}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* User Info Card */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle>User Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-400">Referral Code</Label>
                  <p className="text-white font-mono">{userDetails.referralCode || 'None'}</p>
                </div>
                <div>
                  <Label className="text-gray-400">Invited By</Label>
                  <p className="text-white">{userDetails.referredBy ? `@${userDetails.referredBy}` : 'None'}</p>
                </div>
                <div>
                  <Label className="text-gray-400">Account Status</Label>
                  <div className="flex gap-2 mt-1">
                    {userDetails.hasPaidPurchase && (
                      <Badge className="bg-blue-500/20 text-blue-500">Verified Purchaser</Badge>
                    )}
                    {userDetails.isAdmin && (
                      <Badge className="bg-purple-500/20 text-purple-500">Admin</Badge>
                    )}
                  </div>
                </div>
                <div>
                  <Label className="text-gray-400">Registration Date</Label>
                  <p className="text-white">{new Date(userDetails.createdAt).toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Mining Tab */}
        <TabsContent value="mining" className="space-y-4">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Mining Details</span>
                <div className="flex gap-2">
                  {userDetails.miningActive ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => suspendMiningMutation.mutate()}
                      className="border-yellow-500/50 text-yellow-500 hover:bg-yellow-500/10"
                      data-testid="button-suspend-mining"
                    >
                      <Pause className="h-4 w-4 mr-1" />
                      Suspend Mining
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => resumeMiningMutation.mutate()}
                      className="border-green-500/50 text-green-500 hover:bg-green-500/10"
                      data-testid="button-resume-mining"
                    >
                      <Play className="h-4 w-4 mr-1" />
                      Resume Mining
                    </Button>
                  )}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label className="text-gray-400">Total Hash Power</Label>
                  <p className="text-2xl font-bold text-[#f7931a]">
                    {formatHashPower(parseFloat(userDetails.hashPower))}
                  </p>
                </div>
                <div>
                  <Label className="text-gray-400">Mining Status</Label>
                  <div className="mt-2">
                    {userDetails.miningActive ? (
                      <Badge className="bg-green-500/20 text-green-500">Active</Badge>
                    ) : (
                      <Badge className="bg-red-500/20 text-red-500">Suspended</Badge>
                    )}
                  </div>
                </div>
                <div>
                  <Label className="text-gray-400">Base Hash Power</Label>
                  <p className="text-xl text-white">
                    {formatHashPower(parseFloat(userDetails.baseHashPower))}
                  </p>
                </div>
                <div>
                  <Label className="text-gray-400">Referral Bonus</Label>
                  <p className="text-xl text-green-500">
                    +{formatHashPower(parseFloat(userDetails.referralHashBonus))}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Referrals Tab */}
        <TabsContent value="referrals" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-400">
                  Total Invited
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">
                  {referredUsers.length}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-400">
                  Verified Referrals
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-500">
                  {verifiedReferrals.length}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-400">
                  Unverified Miners
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-500">
                  {unverifiedReferrals.length}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-400">
                  Total Earnings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-500">
                  {parseFloat(userDetails.totalReferralEarnings).toFixed(2)}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Referred Users List */}
          {referredUsers.length > 0 && (
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader>
                <CardTitle>Referred Users</CardTitle>
              </CardHeader>
              <CardContent className="p-0 sm:p-6">
                <div className="w-full overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-zinc-800">
                        <TableHead>Username</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Hash Power</TableHead>
                        <TableHead>Joined</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {referredUsers.map((user) => (
                        <TableRow key={user.id} className="border-zinc-800">
                          <TableCell className="font-medium text-white">
                            {user.username}
                          </TableCell>
                          <TableCell>
                            {user.hasPaidPurchase ? (
                              <Badge className="bg-green-500/20 text-green-500">Verified</Badge>
                            ) : (
                              <Badge className="bg-yellow-500/20 text-yellow-500">Unverified</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-[#f7931a]">
                            {formatHashPower(parseFloat(user.hashPower))}
                          </TableCell>
                          <TableCell className="text-gray-400">
                            {new Date(user.createdAt).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Transactions Tab */}
        <TabsContent value="transactions" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-400">
                  Total Deposits
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-500">
                  ${totalDeposits.toFixed(2)}
                </div>
                <p className="text-xs text-gray-400 mt-1">{depositCount} transactions</p>
              </CardContent>
            </Card>

            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-400">
                  Total Withdrawals
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-500">
                  ${totalWithdrawals.toFixed(2)}
                </div>
                <p className="text-xs text-gray-400 mt-1">{withdrawalCount} transactions</p>
              </CardContent>
            </Card>
          </div>

          {/* Transaction History Table */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle>Recent Transactions</CardTitle>
            </CardHeader>
            <CardContent className="p-0 sm:p-6">
              {userTransactions.length === 0 ? (
                <p className="text-gray-400 text-center py-8">No transactions found</p>
              ) : (
                <div className="w-full overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-zinc-800">
                        <TableHead className="text-xs sm:text-sm">Date</TableHead>
                        <TableHead className="text-xs sm:text-sm">Type & Asset</TableHead>
                        <TableHead className="text-xs sm:text-sm">Amount</TableHead>
                        <TableHead className="text-xs sm:text-sm">Status</TableHead>
                        <TableHead className="text-xs sm:text-sm hidden sm:table-cell">TX Hash</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {userTransactions
                        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                        .slice(0, 10)
                        .map((tx) => (
                        <TableRow key={tx.id} className="border-zinc-800">
                          <TableCell className="text-gray-400 text-xs sm:text-sm whitespace-nowrap">
                            {new Date(tx.createdAt).toLocaleDateString()}
                            <br />
                            <span className="text-xs text-gray-500">
                              {new Date(tx.createdAt).toLocaleTimeString()}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              {tx.type === 'deposit' ? (
                                <Badge className="bg-green-500/20 text-green-500 text-xs w-fit">Deposit</Badge>
                              ) : tx.type === 'withdrawal' ? (
                                <Badge className="bg-red-500/20 text-red-500 text-xs w-fit">Withdrawal</Badge>
                              ) : tx.type === 'transfer_in' ? (
                                <Badge className="bg-blue-500/20 text-blue-500 text-xs w-fit">Transfer In</Badge>
                              ) : tx.type === 'transfer_out' ? (
                                <Badge className="bg-orange-500/20 text-orange-500 text-xs w-fit">Transfer Out</Badge>
                              ) : (
                                <Badge className="bg-purple-500/20 text-purple-500 text-xs w-fit">Transfer</Badge>
                              )}
                              <span className="text-xs">
                                {tx.currency === 'USDT' ? (
                                  <Badge className="bg-[#4ade80]/20 text-[#4ade80] font-semibold border-[#4ade80]/30">USDT</Badge>
                                ) : tx.currency === 'BTC' ? (
                                  <Badge className="bg-[#f7931a]/20 text-[#f7931a] font-semibold border-[#f7931a]/30">BTC</Badge>
                                ) : tx.currency === 'B2B' ? (
                                  <Badge className="bg-[#a855f7]/20 text-[#a855f7] font-semibold border-[#a855f7]/30">B2B</Badge>
                                ) : (
                                  <Badge className="font-semibold">{tx.currency}</Badge>
                                )}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="font-medium text-white">
                            <div className="flex flex-col">
                              <span className="text-sm sm:text-base">
                                {tx.currency === 'USDT' ? '$' : ''}
                                {parseFloat(tx.amount).toLocaleString('en-US', { 
                                  minimumFractionDigits: tx.currency === 'USDT' ? 2 : 4,
                                  maximumFractionDigits: tx.currency === 'USDT' ? 2 : 8
                                })}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={tx.status === 'completed' || tx.status === 'approved' ? 'default' : 'secondary'}
                              className="text-xs"
                            >
                              {tx.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-gray-400 font-mono text-xs hidden sm:table-cell">
                            {tx.txHash ? (
                              <span title={tx.txHash}>
                                {tx.txHash.slice(0, 8)}...
                              </span>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
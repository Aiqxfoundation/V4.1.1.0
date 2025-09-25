import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, ChevronRight, Copy, CheckCircle, RefreshCw, Bitcoin, TrendingUp, ArrowUpDown, Shield, AlertTriangle, Cpu, Clock, Info, AlertCircle } from "lucide-react";
import { useLocation } from "wouter";
import { SuspensionModal } from "@/components/SuspensionModal";

interface Transaction {
  id: string;
  type: 'deposit' | 'withdrawal' | 'transfer_in' | 'transfer_out';
  amount: string;
  currency?: 'USDT' | 'BTC' | 'B2B';
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  createdAt: string;
  network?: string;
  address?: string;
  fromUsername?: string;
  toUsername?: string;
}

interface TransactionData {
  deposits: Transaction[];
  withdrawals: Transaction[];
  sentTransfers: Transaction[];
  receivedTransfers: Transaction[];
}

export default function WalletPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  
  // Check if user account is frozen or banned (not just mining paused)
  const isSuspended = user?.isFrozen || user?.isBanned;
  const [showSuspensionModal, setShowSuspensionModal] = useState(false);
  
  // Helper function to safely parse float values
  const safeParseFloat = (value: string | number | undefined | null): number => {
    if (value === undefined || value === null || value === '') {
      return 0;
    }
    const parsed = parseFloat(String(value));
    return isNaN(parsed) ? 0 : parsed;
  };
  const [selectedAsset, setSelectedAsset] = useState<'BTC' | 'B2B' | 'USDT' | null>(null);
  const [showDepositDialog, setShowDepositDialog] = useState(false);
  const [showWithdrawDialog, setShowWithdrawDialog] = useState(false);
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [showPowerRestrictionDialog, setShowPowerRestrictionDialog] = useState(false);
  const [recipientUsername, setRecipientUsername] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawAddress, setWithdrawAddress] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [depositTxHash, setDepositTxHash] = useState("");
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<any>(null);
  const [currentUTCTime, setCurrentUTCTime] = useState("");
  const [showConvertDialog, setShowConvertDialog] = useState(false);
  const [convertFrom, setConvertFrom] = useState<'BTC' | 'USDT'>('BTC');
  const [convertTo, setConvertTo] = useState<'BTC' | 'USDT'>('USDT');
  const [convertAmount, setConvertAmount] = useState("");
  const [selectedDepositAddress, setSelectedDepositAddress] = useState<string | null>(null);
  const [cachedAddresses, setCachedAddresses] = useState<string[]>([]);
  const [addressAssignment, setAddressAssignment] = useState<{
    address: string;
    assignedAt: string;
    expiresAt: string;
    currency: string;
  } | null>(null);
  const [cooldownTimeRemaining, setCooldownTimeRemaining] = useState<string>('');
  const [selectedChain, setSelectedChain] = useState<'ERC20' | 'BSC'>('ERC20');

  // Mutation to assign a deposit address
  const assignAddressMutation = useMutation({
    mutationFn: async (params: { currency: 'USDT' | 'BTC'; network?: 'ERC20' | 'BSC' }) => {
      const response = await apiRequest('POST', '/api/deposit-addresses/assign', params);
      return await response.json();
    },
    onSuccess: (data) => {
      setAddressAssignment(data);
      setSelectedDepositAddress(data.address);
      if (!data.isNewAssignment) {
        toast({
          title: "Existing Address",
          description: "You already have an address assigned. Please wait for the cooldown to expire before requesting a new one.",
        });
      } else {
        toast({
          title: "Address Assigned",
          description: "A deposit address has been assigned to you for 24 hours.",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to assign deposit address",
        variant: "destructive",
      });
    }
  });

  // Calculate cooldown timer
  useEffect(() => {
    if (!addressAssignment) {
      setCooldownTimeRemaining('');
      return;
    }

    const calculateTimeRemaining = () => {
      const expiresAt = new Date(addressAssignment.expiresAt);
      const now = new Date();
      const diff = expiresAt.getTime() - now.getTime();

      if (diff <= 0) {
        setCooldownTimeRemaining('');
        setAddressAssignment(null);
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setCooldownTimeRemaining(`${hours}h ${minutes}m ${seconds}s`);
    };

    calculateTimeRemaining();
    const interval = setInterval(calculateTimeRemaining, 1000);

    return () => clearInterval(interval);
  }, [addressAssignment]);

  // Fetch wallet balances from server
  const { data: walletBalances } = useQuery<{
    btcBalance: string;
    usdtBalance: string;
    b2bBalance: string;
  }>({
    queryKey: ['/api/wallet/balances'],
    refetchInterval: 5000, // Refresh every 5 seconds for better real-time updates
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    enabled: !!user,
  });

  // Update UTC time every second
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const utcTime = now.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
      setCurrentUTCTime(utcTime);
    };
    
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

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

  // Handle deposit address request
  const handleGetDepositAddress = () => {
    if (selectedAsset === 'USDT') {
      assignAddressMutation.mutate({ currency: 'USDT', network: selectedChain });
    } else if (selectedAsset === 'BTC') {
      assignAddressMutation.mutate({ currency: 'BTC' });
    }
  };

  // Use server balance data if available, fallback to user object
  const usdtBalance = walletBalances ? safeParseFloat(walletBalances.usdtBalance) : safeParseFloat(user?.usdtBalance);
  const gbtcBalance = walletBalances ? safeParseFloat(walletBalances.b2bBalance) : safeParseFloat(user?.b2bBalance);
  const btcBalance = walletBalances ? safeParseFloat(walletBalances.btcBalance) : safeParseFloat(user?.btcBalance);
  const userHashPower = safeParseFloat(user?.hashPower); // Hash power in MH/s

  // Fetch BTC price (real-time)
  const { data: btcPriceData } = useQuery<{
    btcPrice: string;
    hashratePrice: string;
    requiredHashratePerBTC: string;
    timestamp: string;
  }>({
    queryKey: ['/api/btc/prices'],
    refetchInterval: 30000, // Refresh every 30 seconds
    enabled: !!user,
  });

  const btcPrice = safeParseFloat(btcPriceData?.btcPrice) || 111000;

  // Fetch global deposit addresses from API
  const { data: globalAddresses } = useQuery<{ usdt: string; eth: string; btc: string }>({
    queryKey: ["/api/deposit-addresses"],
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Cache for 10 minutes
    refetchOnWindowFocus: false
  });

  // Use global addresses or fallback to defaults
  const systemB2BAddress = "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh";
  const systemBTCAddress = globalAddresses?.btc || "bc1qy8zzqsarhp0s63txsfnn3q3nvuu0g83mv3hwrv";
  const systemUSDTAddress = globalAddresses?.usdt || "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb";

  // Fetch transactions
  const { data: transactions } = useQuery<TransactionData>({
    queryKey: ["/api/transactions"],
    enabled: !!user && !!selectedAsset,
    staleTime: 300000,
    gcTime: 600000 // Cache for 5 minutes
  });
  
  // Fetch conversions
  const { data: conversions } = useQuery({
    queryKey: ["/api/conversions"],
    enabled: !!user,
    staleTime: 300000,
    gcTime: 600000
  });

  // Combine and sort transactions for display - filter by asset type
  const getTransactionHistory = () => {
    if (!transactions) return [];
    
    const allTransactions: any[] = [];
    
    // Add conversions to history
    if (conversions && Array.isArray(conversions)) {
      conversions.forEach(conv => {
        // Show conversions relevant to selected asset
        if (selectedAsset === 'BTC' && (conv.fromCurrency === 'BTC' || conv.toCurrency === 'BTC')) {
          allTransactions.push({
            ...conv,
            displayType: 'Convert',
            displayAmount: parseFloat(conv.fromCurrency === 'BTC' ? conv.fromAmount : conv.toAmount).toFixed(8),
            network: `${conv.fromCurrency} → ${conv.toCurrency}`
          });
        } else if (selectedAsset === 'USDT' && (conv.fromCurrency === 'USDT' || conv.toCurrency === 'USDT')) {
          allTransactions.push({
            ...conv,
            displayType: 'Convert',
            displayAmount: parseFloat(conv.fromCurrency === 'USDT' ? conv.fromAmount : conv.toAmount).toFixed(2),
            network: `${conv.fromCurrency} → ${conv.toCurrency}`
          });
        }
      });
    }
    
    // For B2B, only show B2B-related transactions
    if (selectedAsset === 'B2B') {
      // Add B2B deposits
      transactions.deposits?.filter(d => d.network === 'B2B' || d.currency === 'B2B').forEach(d => {
        allTransactions.push({
          ...d,
          displayType: 'Deposit',
          displayAmount: parseFloat(d.amount).toFixed(8)
        });
      });
      
      // Add B2B withdrawals
      transactions.withdrawals?.filter(w => w.network === 'B2B' || w.currency === 'B2B').forEach(w => {
        allTransactions.push({
          ...w,
          displayType: 'Withdraw',
          displayAmount: parseFloat(w.amount).toFixed(8)
        });
      });
      
      // Add all transfers (B2B only)
      transactions.sentTransfers?.forEach(t => {
        allTransactions.push({
          ...t,
          displayType: 'Transfer Out',
          displayAmount: parseFloat(t.amount).toFixed(8)
        });
      });
      
      transactions.receivedTransfers?.forEach(t => {
        allTransactions.push({
          ...t,
          displayType: 'Transfer In',
          displayAmount: parseFloat(t.amount).toFixed(8)
        });
      });
    } else if (selectedAsset === 'USDT') {
      // For USDT, only show USDT transactions
      transactions.deposits?.filter(d => d.currency === 'USDT' || (!d.currency && d.network !== 'BTC' && d.network !== 'B2B')).forEach(d => {
        allTransactions.push({
          ...d,
          displayType: 'Deposit',
          displayAmount: parseFloat(d.amount).toFixed(2)
        });
      });
      
      transactions.withdrawals?.filter(w => w.currency === 'USDT' || (!w.currency && w.network !== 'BTC' && w.network !== 'B2B')).forEach(w => {
        allTransactions.push({
          ...w,
          displayType: 'Withdraw',
          displayAmount: parseFloat(w.amount).toFixed(2)
        });
      });
    } else if (selectedAsset === 'BTC') {
      // For BTC, only show BTC transactions
      transactions.deposits?.filter(d => d.currency === 'BTC' || d.network === 'BTC').forEach(d => {
        allTransactions.push({
          ...d,
          displayType: 'Deposit',
          displayAmount: parseFloat(d.amount).toFixed(8)
        });
      });
      
      transactions.withdrawals?.filter(w => w.currency === 'BTC' || w.network === 'BTC').forEach(w => {
        allTransactions.push({
          ...w,
          displayType: 'Withdraw',
          displayAmount: parseFloat(w.amount).toFixed(8)
        });
      });
    }
    
    // Sort by date (newest first)
    return allTransactions.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  };

  const depositMutation = useMutation({
    mutationFn: async (data: { amount: string; txHash: string }) => {
      const res = await apiRequest("POST", "/api/deposits", {
        amount: data.amount,
        txHash: data.txHash,
        currency: selectedAsset === 'BTC' ? 'BTC' : selectedAsset === 'USDT' ? 'USDT' : 'B2B',
        network: selectedAsset === 'USDT' ? selectedChain : selectedAsset === 'BTC' ? 'BTC' : 'B2B'
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ 
        title: "Deposit Submitted Successfully!", 
        description: "Your deposit is being processed. You can deposit again after 24 hours." 
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/deposits/cooldown"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/balances"] });
      setShowDepositDialog(false);
      setDepositAmount("");
      setDepositTxHash("");
    },
    onError: (error: Error) => {
      toast({ 
        title: "Deposit Failed", 
        description: error.message, 
        variant: "destructive" 
      });
      // Refetch cooldown status
      queryClient.invalidateQueries({ queryKey: ["/api/deposits/cooldown"] });
    }
  });

  const withdrawMutation = useMutation({
    mutationFn: async (data: { amount: string; address: string; network?: string }) => {
      const res = await apiRequest("POST", "/api/withdrawals", {
        amount: data.amount,
        address: data.address,
        network: selectedAsset === 'USDT' ? 'ERC20' : selectedAsset === 'BTC' ? 'BTC' : 'B2B'
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ 
        title: "Withdrawal Requested Successfully!", 
        description: `Your ${selectedAsset} withdrawal is being processed. You can withdraw again after 24 hours.` 
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/withdrawals/cooldown"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/balances"] });
      setShowWithdrawDialog(false);
      setWithdrawAmount("");
      setWithdrawAddress("");
    },
    onError: (error: Error) => {
      toast({ 
        title: "Withdrawal Failed", 
        description: error.message, 
        variant: "destructive" 
      });
      // Refetch cooldown status
      queryClient.invalidateQueries({ queryKey: ["/api/withdrawals/cooldown"] });
    }
  });

  // Conversion mutation
  const convertMutation = useMutation({
    mutationFn: async (data: { fromCurrency: string; toCurrency: string; amount: string }) => {
      const res = await apiRequest("POST", "/api/convert", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      queryClient.invalidateQueries({ queryKey: ['/api/conversions'] });
      toast({
        title: "Conversion Successful",
        description: `Your ${convertFrom} has been converted to ${convertTo}`,
        className: "bg-green-800 text-white",
      });
      setShowConvertDialog(false);
      setConvertAmount("");
      setSelectedAsset(null); // Go back to main view
    },
    onError: (error: any) => {
      toast({
        title: "Conversion Failed",
        description: error.message || "Failed to convert",
        variant: "destructive",
      });
    },
  });

  const transferMutation = useMutation({
    mutationFn: async (data: { toUsername: string; amount: string }) => {
      const res = await apiRequest("POST", "/api/transfer", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ 
        title: "Transfer Successful", 
        description: `Successfully sent ${transferAmount} B2B` 
      });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      setShowTransferDialog(false);
      setRecipientUsername("");
      setTransferAmount("");
    },
    onError: (error: Error) => {
      toast({ 
        title: "Transfer Failed", 
        description: error.message, 
        variant: "destructive" 
      });
    }
  });

  const handleDeposit = () => {
    if (!depositAmount || !depositTxHash) {
      toast({ 
        title: "Invalid Input", 
        description: "Please enter amount and transaction hash", 
        variant: "destructive" 
      });
      return;
    }
    
    const amount = safeParseFloat(depositAmount);
    const minDeposit = selectedAsset === 'B2B' ? 0.001 : selectedAsset === 'BTC' ? 0.0001 : 20; // 20 USDT minimum
    
    if (amount < minDeposit) {
      toast({ 
        title: "Below Minimum", 
        description: `Minimum deposit for ${selectedAsset} is ${minDeposit} ${selectedAsset}`, 
        variant: "destructive" 
      });
      return;
    }
    
    depositMutation.mutate({ amount: depositAmount, txHash: depositTxHash });
  };
  
  // Format cooldown time for display
  const formatCooldownTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const handleWithdraw = () => {
    if (!withdrawAmount || !withdrawAddress) {
      toast({ 
        title: "Invalid Input", 
        description: "Please enter amount and address", 
        variant: "destructive" 
      });
      return;
    }
    
    const amount = safeParseFloat(withdrawAmount);
    const maxAmount = selectedAsset === 'B2B' ? gbtcBalance : usdtBalance;
    const minWithdrawal = selectedAsset === 'B2B' ? 0.01 : selectedAsset === 'BTC' ? 0.001 : 100; // 100 USDT minimum
    
    if (amount < minWithdrawal) {
      toast({ 
        title: "Below Minimum", 
        description: `Minimum withdrawal for ${selectedAsset} is ${minWithdrawal} ${selectedAsset}`, 
        variant: "destructive" 
      });
      return;
    }
    
    if (amount > maxAmount) {
      toast({ 
        title: "Insufficient Balance", 
        description: `You don't have enough ${selectedAsset}`, 
        variant: "destructive" 
      });
      return;
    }
    
    withdrawMutation.mutate({ amount: withdrawAmount, address: withdrawAddress });
  };

  const handleTransfer = () => {
    if (!recipientUsername || !transferAmount) {
      toast({ 
        title: "Invalid Input", 
        description: "Please enter recipient and amount", 
        variant: "destructive" 
      });
      return;
    }
    if (safeParseFloat(transferAmount) > gbtcBalance) {
      toast({ 
        title: "Insufficient Balance", 
        description: "You don't have enough B2B", 
        variant: "destructive" 
      });
      return;
    }
    transferMutation.mutate({ toUsername: recipientUsername, amount: transferAmount });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    // Convert to UTC and format as YYYY-MM-DD HH:MM:SS
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    const seconds = String(date.getUTCSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'approved': return 'text-green-500';
      case 'pending': return 'text-yellow-500';
      case 'rejected': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  const copyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    setCopiedAddress(true);
    toast({ 
      title: "Copied", 
      description: "Address copied to clipboard" 
    });
    setTimeout(() => setCopiedAddress(false), 500); // Faster feedback
  };

  // Main wallet view
  if (!selectedAsset) {
    return (
      <div className="mobile-page bg-[#1a1a1a]">
        {/* Header */}
        <div className="mobile-header bg-[#1a1a1a] border-b border-gray-800">
          <h1 className="text-lg font-medium text-white">My Assets</h1>
        </div>

        {/* Assets List */}
        <div className="mobile-content">
          {/* Exchange Button */}
          <Button
            onClick={() => setShowConvertDialog(true)}
            className="w-full mb-4 bg-gradient-to-r from-[#f7931a] to-[#e68a00] hover:from-[#e68a00] hover:to-[#d17a00] text-white font-medium"
            data-testid="button-exchange"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Exchange
          </Button>
          
          {/* BTC Asset - Real Bitcoin */}
          <Card 
            className="p-4 mb-3 bg-[#242424] border-gray-800 cursor-pointer hover:bg-[#2a2a2a] transition-colors"
            onClick={() => setSelectedAsset('BTC')}
            data-testid="card-asset-btc"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-[#f7931a] flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 16 16" fill="white">
                    <path d="M5.5 13v1.25c0 .138.112.25.25.25h1a.25.25 0 0 0 .25-.25V13h.5v1.25c0 .138.112.25.25.25h1a.25.25 0 0 0 .25-.25V13h.084c1.992 0 3.416-1.033 3.416-2.82 0-1.502-1.007-2.323-2.186-2.44v-.088c.97-.242 1.683-.974 1.683-2.19C11.997 3.93 10.847 3 9.092 3H9V1.75a.25.25 0 0 0-.25-.25h-1a.25.25 0 0 0-.25.25V3h-.573V1.75a.25.25 0 0 0-.25-.25H5.75a.25.25 0 0 0-.25.25V3l-1.998.011a.25.25 0 0 0-.25.25v.989c0 .137.11.25.248.25l.755-.005a.75.75 0 0 1 .745.75v5.505a.75.75 0 0 1-.75.75l-.748.011a.25.25 0 0 0-.25.25v1c0 .138.112.25.25.25zm1.427-8.513h1.719c.906 0 1.438.498 1.438 1.312 0 .871-.575 1.362-1.877 1.362h-1.28zm0 4.051h1.84c1.137 0 1.756.58 1.756 1.524 0 .953-.626 1.45-2.158 1.45H6.927z"/>
                  </svg>
                </div>
                <div>
                  <p className="text-white font-medium">BTC</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-500" />
            </div>
            
            <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
              <div>
                <p className="text-[#f7931a] text-xs">Balance</p>
                <p className="text-white font-medium">{btcBalance.toFixed(8)}</p>
              </div>
              <div>
                <p className="text-[#f7931a] text-xs">Value (USD)</p>
                <p className="text-white font-medium">${(btcBalance * btcPrice).toFixed(2)}</p>
              </div>
            </div>
          </Card>

          {/* B2B Asset */}
          <Card 
            className="p-4 mb-3 bg-[#242424] border-gray-800 cursor-pointer hover:bg-[#2a2a2a] transition-colors"
            onClick={() => setSelectedAsset('B2B')}
            data-testid="card-asset-gbtc"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-[#f7931a] flex items-center justify-center">
                  <svg width="20" height="20" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M5.5 13v1.25c0 .138.112.25.25.25h1a.25.25 0 0 0 .25-.25V13h.5v1.25c0 .138.112.25.25.25h1a.25.25 0 0 0 .25-.25V13h.084c1.992 0 3.416-1.033 3.416-2.82 0-1.502-1.007-2.323-2.186-2.44v-.088c.97-.242 1.683-.974 1.683-2.19C11.997 3.93 10.847 3 9.092 3H9V1.75a.25.25 0 0 0-.25-.25h-1a.25.25 0 0 0-.25.25V3h-.573V1.75a.25.25 0 0 0-.25-.25H5.75a.25.25 0 0 0-.25.25V3l-1.998.011a.25.25 0 0 0-.25.25v.989c0 .137.11.25.248.25l.755-.005a.75.75 0 0 1 .745.75v5.505a.75.75 0 0 1-.75.75l-.748.011a.25.25 0 0 0-.25.25v1c0 .138.112.25.25.25zm1.427-8.513h1.719c.906 0 1.438.498 1.438 1.312 0 .871-.575 1.362-1.877 1.362h-1.28zm0 4.051h1.84c1.137 0 1.756.58 1.756 1.524 0 .953-.626 1.45-2.158 1.45H6.927z" fill="#000000"/>
                  </svg>
                </div>
                <div>
                  <p className="text-white font-medium">B2B</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-500" />
            </div>
            
            <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
              <div>
                <p className="text-[#f7931a] text-xs">Balance</p>
                <p className="text-white font-medium">{gbtcBalance.toFixed(8)}</p>
              </div>
              <div>
                <p className="text-[#f7931a] text-xs"></p>
                <p className="text-white font-medium"></p>
              </div>
            </div>
          </Card>

          {/* USDT Asset */}
          <Card 
            className="p-4 mb-3 bg-[#242424] border-gray-800 cursor-pointer hover:bg-[#2a2a2a] transition-colors"
            onClick={() => setSelectedAsset('USDT')}
            data-testid="card-asset-usdt"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#50AF95] to-[#26A17B] flex items-center justify-center">
                  <span className="text-white font-bold text-xl">₮</span>
                </div>
                <div>
                  <p className="text-white font-medium">USDT</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-500" />
            </div>
            
            <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
              <div>
                <p className="text-[#26a17b] text-xs">Balance</p>
                <p className="text-white font-medium">{usdtBalance.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-[#26a17b] text-xs"></p>
                <p className="text-white font-medium"></p>
              </div>
            </div>
          </Card>

        </div>
        
        {/* Exchange Dialog */}
        <Dialog open={showConvertDialog} onOpenChange={setShowConvertDialog}>
          <DialogContent className="sm:max-w-md bg-[#242424] border-gray-800">
            <DialogHeader>
              <DialogTitle className="text-white font-medium">
                Exchange
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* From-To Section with Switch Button */}
              <div className="relative">
                <div className="grid grid-cols-[1fr,auto,1fr] gap-2 items-center">
                  {/* From Currency */}
                  <div className="bg-[#1a1a1a] rounded-lg p-3 border border-gray-700">
                    <p className="text-xs text-gray-400 mb-1">From</p>
                    <div className="flex items-center justify-center space-x-2">
                      {convertFrom === 'BTC' ? (
                        <>
                          <div className="w-5 h-5 bg-[#f7931a] rounded-full flex items-center justify-center">
                            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M5.5 13v1.25c0 .138.112.25.25.25h1a.25.25 0 0 0 .25-.25V13h.5v1.25c0 .138.112.25.25.25h1a.25.25 0 0 0 .25-.25V13h.084c1.992 0 3.416-1.033 3.416-2.82 0-1.502-1.007-2.323-2.186-2.44v-.088c.97-.242 1.683-.974 1.683-2.19C11.997 3.93 10.847 3 9.092 3H9V1.75a.25.25 0 0 0-.25-.25h-1a.25.25 0 0 0-.25.25V3h-.573V1.75a.25.25 0 0 0-.25-.25H5.75a.25.25 0 0 0-.25.25V3l-1.998.011a.25.25 0 0 0-.25.25v.989c0 .137.11.25.248.25l.755-.005a.75.75 0 0 1 .745.75v5.505a.75.75 0 0 1-.75.75l-.748.011a.25.25 0 0 0-.25.25v1c0 .138.112.25.25.25zm1.427-8.513h1.719c.906 0 1.438.498 1.438 1.312 0 .871-.575 1.362-1.877 1.362h-1.28zm0 4.051h1.84c1.137 0 1.756.58 1.756 1.524 0 .953-.626 1.45-2.158 1.45H6.927z" fill="#000000"/>
                            </svg>
                          </div>
                          <span className="text-white font-medium">BTC</span>
                        </>
                      ) : (
                        <>
                          <div className="w-5 h-5 bg-gradient-to-br from-[#50AF95] to-[#26A17B] rounded-full flex items-center justify-center">
                            <span className="text-white font-bold text-xs">₮</span>
                          </div>
                          <span className="text-white font-medium">USDT</span>
                        </>
                      )}
                    </div>
                  </div>
                  
                  {/* Switch Button */}
                  <Button
                    onClick={() => {
                      const temp = convertFrom;
                      setConvertFrom(convertTo);
                      setConvertTo(temp);
                    }}
                    className="rounded-full p-2 bg-[#1a1a1a] hover:bg-[#2a2a2a] border border-gray-700"
                    variant="ghost"
                    size="icon"
                  >
                    <ArrowUpDown className="w-4 h-4 text-white" />
                  </Button>
                  
                  {/* To Currency */}
                  <div className="bg-[#1a1a1a] rounded-lg p-3 border border-gray-700">
                    <p className="text-xs text-gray-400 mb-1">To</p>
                    <div className="flex items-center justify-center space-x-2">
                      {convertTo === 'BTC' ? (
                        <>
                          <div className="w-5 h-5 bg-[#f7931a] rounded-full flex items-center justify-center">
                            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M5.5 13v1.25c0 .138.112.25.25.25h1a.25.25 0 0 0 .25-.25V13h.5v1.25c0 .138.112.25.25.25h1a.25.25 0 0 0 .25-.25V13h.084c1.992 0 3.416-1.033 3.416-2.82 0-1.502-1.007-2.323-2.186-2.44v-.088c.97-.242 1.683-.974 1.683-2.19C11.997 3.93 10.847 3 9.092 3H9V1.75a.25.25 0 0 0-.25-.25h-1a.25.25 0 0 0-.25.25V3h-.573V1.75a.25.25 0 0 0-.25-.25H5.75a.25.25 0 0 0-.25.25V3l-1.998.011a.25.25 0 0 0-.25.25v.989c0 .137.11.25.248.25l.755-.005a.75.75 0 0 1 .745.75v5.505a.75.75 0 0 1-.75.75l-.748.011a.25.25 0 0 0-.25.25v1c0 .138.112.25.25.25zm1.427-8.513h1.719c.906 0 1.438.498 1.438 1.312 0 .871-.575 1.362-1.877 1.362h-1.28zm0 4.051h1.84c1.137 0 1.756.58 1.756 1.524 0 .953-.626 1.45-2.158 1.45H6.927z" fill="#000000"/>
                            </svg>
                          </div>
                          <span className="text-white font-medium">BTC</span>
                        </>
                      ) : (
                        <>
                          <div className="w-5 h-5 bg-gradient-to-br from-[#50AF95] to-[#26A17B] rounded-full flex items-center justify-center">
                            <span className="text-white font-bold text-xs">₮</span>
                          </div>
                          <span className="text-white font-medium">USDT</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              <div>
                <Label className="text-gray-400 text-sm">
                  Amount ({convertFrom})
                </Label>
                <Input
                  type="number"
                  value={convertAmount}
                  onChange={(e) => setConvertAmount(e.target.value)}
                  placeholder={convertFrom === 'BTC' ? "0.00000000" : "0.00"}
                  step={convertFrom === 'BTC' ? "0.00000001" : "0.01"}
                  max={convertFrom === 'BTC' ? btcBalance || 0 : usdtBalance || 0}
                  className="bg-[#1a1a1a] border-gray-700 text-white placeholder:text-gray-600"
                  data-testid="input-convert-amount"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Available: {convertFrom === 'BTC' 
                    ? `${btcBalance.toFixed(8)} BTC` 
                    : `${usdtBalance.toFixed(2)} USDT`}
                </p>
              </div>
              
              {/* Conversion Preview */}
              {convertAmount && safeParseFloat(convertAmount) > 0 && (
                <Card className="p-3 bg-gradient-to-r from-green-900/20 to-green-800/10 border-green-600/30">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Exchange Rate</span>
                      <span className="text-white">
                        {convertFrom === 'BTC' || convertTo === 'BTC' 
                          ? `1 BTC = $${btcPrice.toLocaleString()}`
                          : '1 USDT = $1.00'}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Fee (0.01%)</span>
                      <span className="text-white">
                        {(() => {
                          const amount = safeParseFloat(convertAmount);
                          if (convertFrom === 'BTC' && convertTo === 'USDT') {
                            return `${(amount * btcPrice * 0.0001).toFixed(2)} USDT`;
                          } else if (convertFrom === 'USDT' && convertTo === 'BTC') {
                            return `${(amount / btcPrice * 0.0001).toFixed(8)} BTC`;
                          }
                          return '0';
                        })()}
                      </span>
                    </div>
                    <div className="border-t border-gray-700 pt-2">
                      <div className="flex justify-between">
                        <span className="text-gray-400">You'll Receive</span>
                        <span className="text-green-400 font-bold">
                          {(() => {
                            const amount = safeParseFloat(convertAmount);
                            if (convertFrom === 'BTC' && convertTo === 'USDT') {
                              return `${(amount * btcPrice * 0.9999).toFixed(2)} USDT`;
                            } else if (convertFrom === 'USDT' && convertTo === 'BTC') {
                              return `${(amount / btcPrice * 0.9999).toFixed(8)} BTC`;
                            }
                            return '0';
                          })()}
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>
              )}
              
              <Button
                onClick={() => {
                  convertMutation.mutate({
                    fromCurrency: convertFrom,
                    toCurrency: convertTo,
                    amount: convertAmount
                  });
                }}
                disabled={convertMutation.isPending || !convertAmount || safeParseFloat(convertAmount) <= 0}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-medium"
                data-testid="button-confirm-convert"
              >
                {convertMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Exchanging...
                  </>
                ) : (
                  `Exchange ${convertFrom} to ${convertTo}`
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Asset detail view
  return (
    <div className="mobile-page bg-[#1a1a1a]">
      {/* Header */}
      <div className="mobile-header bg-[#1a1a1a] border-b border-gray-800">
        <div className="flex items-center">
          <Button
            onClick={() => setSelectedAsset(null)}
            variant="ghost"
            size="sm"
            className="p-0 mr-3"
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </Button>
          <h1 className="text-lg font-medium text-white">Asset Detail</h1>
        </div>
      </div>

      {/* Content */}
      <div className="mobile-content">
        {/* Asset Info */}
        <div className="flex items-center space-x-3 mb-6">
          <div className={`w-12 h-12 rounded-full ${selectedAsset === 'BTC' || selectedAsset === 'B2B' ? 'bg-[#f7931a]' : 'bg-[#26a17b]'} flex items-center justify-center`}>
            {selectedAsset === 'BTC' ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 16 16" fill="white">
                <path d="M5.5 13v1.25c0 .138.112.25.25.25h1a.25.25 0 0 0 .25-.25V13h.5v1.25c0 .138.112.25.25.25h1a.25.25 0 0 0 .25-.25V13h.084c1.992 0 3.416-1.033 3.416-2.82 0-1.502-1.007-2.323-2.186-2.44v-.088c.97-.242 1.683-.974 1.683-2.19C11.997 3.93 10.847 3 9.092 3H9V1.75a.25.25 0 0 0-.25-.25h-1a.25.25 0 0 0-.25.25V3h-.573V1.75a.25.25 0 0 0-.25-.25H5.75a.25.25 0 0 0-.25.25V3l-1.998.011a.25.25 0 0 0-.25.25v.989c0 .137.11.25.248.25l.755-.005a.75.75 0 0 1 .745.75v5.505a.75.75 0 0 1-.75.75l-.748.011a.25.25 0 0 0-.25.25v1c0 .138.112.25.25.25zm1.427-8.513h1.719c.906 0 1.438.498 1.438 1.312 0 .871-.575 1.362-1.877 1.362h-1.28zm0 4.051h1.84c1.137 0 1.756.58 1.756 1.524 0 .953-.626 1.45-2.158 1.45H6.927z"/>
              </svg>
            ) : selectedAsset === 'USDT' ? (
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#50AF95] to-[#26A17B] flex items-center justify-center">
                <span className="text-white font-bold text-2xl">₮</span>
              </div>
            ) : (
              <svg width="28" height="28" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M5.5 13v1.25c0 .138.112.25.25.25h1a.25.25 0 0 0 .25-.25V13h.5v1.25c0 .138.112.25.25.25h1a.25.25 0 0 0 .25-.25V13h.084c1.992 0 3.416-1.033 3.416-2.82 0-1.502-1.007-2.323-2.186-2.44v-.088c.97-.242 1.683-.974 1.683-2.19C11.997 3.93 10.847 3 9.092 3H9V1.75a.25.25 0 0 0-.25-.25h-1a.25.25 0 0 0-.25.25V3h-.573V1.75a.25.25 0 0 0-.25-.25H5.75a.25.25 0 0 0-.25.25V3l-1.998.011a.25.25 0 0 0-.25.25v.989c0 .137.11.25.248.25l.755-.005a.75.75 0 0 1 .745.75v5.505a.75.75 0 0 1-.75.75l-.748.011a.25.25 0 0 0-.25.25v1c0 .138.112.25.25.25zm1.427-8.513h1.719c.906 0 1.438.498 1.438 1.312 0 .871-.575 1.362-1.877 1.362h-1.28zm0 4.051h1.84c1.137 0 1.756.58 1.756 1.524 0 .953-.626 1.45-2.158 1.45H6.927z" fill="#000000"/>
              </svg>
            )}
          </div>
          <div>
            <p className="text-white font-medium text-lg">{selectedAsset}</p>
          </div>
        </div>

        {/* Real-time Price Ticker for BTC */}
        {selectedAsset === 'BTC' && (
          <Card className="p-3 mb-4 bg-gradient-to-r from-[#f7931a]/20 to-[#f7931a]/10 border-[#f7931a]/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#f7931a]" />
                <p className="text-xs text-gray-400">Live Price</p>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-lg font-bold text-white">${btcPrice.toLocaleString()}</p>
                <RefreshCw className="w-3 h-3 text-gray-500 animate-spin" />
              </div>
            </div>
          </Card>
        )}

        {/* Balance Info */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <p className="text-gray-500 text-xs mb-1">Balance</p>
            <p className="text-white font-medium">
              {selectedAsset === 'BTC' ? btcBalance.toFixed(8) : 
               selectedAsset === 'B2B' ? gbtcBalance.toFixed(8) : 
               usdtBalance.toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-gray-500 text-xs mb-1">{selectedAsset === 'BTC' || selectedAsset === 'B2B' ? 'USD Value' : ''}</p>
            <p className="text-white font-medium">
              {selectedAsset === 'BTC' ? `$${(btcBalance * btcPrice).toFixed(2)}` : 
               selectedAsset === 'B2B' ? `$${(gbtcBalance * 1).toFixed(2)}` : 
               ''}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <Button
            onClick={() => {
              if (selectedAsset === 'B2B') return null;
              // Reset address when reopening dialog
              setSelectedDepositAddress(null);
              setShowDepositDialog(true);
            }}
            disabled={selectedAsset === 'B2B'}
            className={`bg-transparent border-2 ${
              selectedAsset === 'B2B' 
                ? 'border-gray-600 text-gray-600 cursor-not-allowed opacity-50' 
                : 'border-[#f7931a] text-[#f7931a] hover:bg-[#f7931a] hover:text-black'
            } font-medium text-sm`}
            data-testid="button-deposit"
          >
            Deposit
          </Button>
          <Button
            onClick={() => setShowWithdrawDialog(true)}
            className="bg-transparent border-2 border-[#f7931a] text-[#f7931a] hover:bg-[#f7931a] hover:text-black font-medium text-sm"
            data-testid="button-withdraw"
          >
            Withdraw
          </Button>
          <Button
            onClick={() => {
              if (selectedAsset === 'BTC') {
                setLocation('/btc-mining');
              } else if (selectedAsset === 'B2B') {
                // Check if user has at least 10MH/s hash power
                if (userHashPower >= 10) {
                  setShowTransferDialog(true);
                } else {
                  setShowPowerRestrictionDialog(true);
                }
              }
            }}
            disabled={selectedAsset === 'USDT'}
            className={`bg-transparent border-2 ${
              selectedAsset === 'USDT' 
                ? 'border-gray-600 text-gray-600 cursor-not-allowed' 
                : 'border-[#f7931a] text-[#f7931a] hover:bg-[#f7931a] hover:text-black'
            } font-medium text-sm`}
            data-testid={selectedAsset === 'BTC' ? "button-mine" : "button-transfer"}
          >
            {selectedAsset === 'BTC' ? 'Mine' : 'Transfer'}
          </Button>
        </div>
        

        {/* Financial Records */}
        <div>
          <h3 className="text-gray-400 text-sm font-medium mb-3">Financial Records</h3>
          <div className="space-y-2">
            {getTransactionHistory().length > 0 ? (
              getTransactionHistory().slice(0, 10).map((tx) => (
                <Card 
                  key={tx.id} 
                  className="p-3 bg-[#242424] border-gray-800 cursor-pointer hover:bg-[#2a2a2a]"
                  data-testid={`transaction-${tx.id}`}
                  onClick={() => {
                    // Only show details for B2B transfers
                    if (selectedAsset === 'B2B' && (tx.displayType === 'Transfer Out' || tx.displayType === 'Transfer In')) {
                      setSelectedTransfer(tx);
                    }
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white text-sm font-medium">{tx.displayType}</p>
                      <div className="flex items-center space-x-3 mt-1">
                        <div>
                          <p className="text-gray-500 text-xs">Amount</p>
                          <p className={`text-sm ${
                            selectedAsset === 'B2B' && (tx.displayType === 'Transfer Out' || tx.displayType === 'Transfer In')
                              ? 'text-[#f7931a] underline' 
                              : 'text-white'
                          }`}>
                            {tx.displayAmount}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500 text-xs">Status</p>
                          <p className={`text-sm capitalize ${getStatusColor(tx.status)}`}>
                            {tx.status === 'approved' ? 'Completed' : tx.status}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-gray-500 text-xs">Time</p>
                      <p className="text-gray-400 text-xs">{formatDate(tx.createdAt)}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-600 float-right -mt-8" />
                </Card>
              ))
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500 text-sm">No transactions yet</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Deposit Dialog - Mobile Optimized */}
      {showDepositDialog && (
        <div className="fixed inset-0 z-50 bg-[#1a1a1a] overflow-y-auto">
          <div className="min-h-screen flex flex-col">
            <div className="p-3 bg-[#242424] border-b border-gray-800 flex items-center justify-between">
              <h2 className="text-white font-medium text-lg">
                Deposit {selectedAsset}
              </h2>
              <Button
                onClick={() => {
                  setShowDepositDialog(false);
                  setDepositAmount("");
                  setDepositTxHash("");
                  setSelectedDepositAddress(null);
                }}
                variant="ghost"
                size="sm"
                className="text-gray-400 hover:text-white p-1"
              >
                <span className="text-2xl">&times;</span>
              </Button>
            </div>
            
            <div className="flex-1 p-3 space-y-3">
              {/* Chain Selection for USDT */}
              {selectedAsset === 'USDT' && (
                <div className="bg-[#242424] rounded-lg p-3">
                  <Label className="text-gray-400 text-sm mb-2 block">
                    Select Network
                  </Label>
                  <Select value={selectedChain} onValueChange={(value: 'ERC20' | 'BSC') => setSelectedChain(value)}>
                    <SelectTrigger className="bg-[#1a1a1a] border-gray-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#242424] border-gray-700">
                      <SelectItem value="ERC20" className="text-white hover:bg-[#2a2a2a]">
                        Ethereum (ERC20)
                      </SelectItem>
                      <SelectItem value="BSC" className="text-white hover:bg-[#2a2a2a]">
                        Binance Smart Chain (BSC)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Deposit Address Section */}
              <div className="bg-[#242424] rounded-lg p-3">
                <Label className="text-gray-400 text-sm mb-2 block flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  {selectedAsset} Deposit Address
                </Label>
                {!selectedDepositAddress ? (
                  <div className="mt-2">
                    <Button
                      onClick={handleGetDepositAddress}
                      disabled={assignAddressMutation.isPending || !!cooldownTimeRemaining}
                      className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-4 text-base disabled:opacity-50 disabled:cursor-not-allowed"
                      data-testid="button-get-deposit-address"
                    >
                      {assignAddressMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin inline" />
                          Getting Address...
                        </>
                      ) : cooldownTimeRemaining ? (
                        <>
                          <Clock className="mr-2 h-4 w-4 inline" />
                          Cooldown: {cooldownTimeRemaining}
                        </>
                      ) : (
                        'Get Deposit Address'
                      )}
                    </Button>
                    <p className="text-xs text-gray-500 text-center mt-1">
                      {cooldownTimeRemaining 
                        ? 'You can request a new address after cooldown expires' 
                        : 'Click to get a secure deposit address'}
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-3">
                      {/* Address Display with Copy */}
                      <div className="p-2 bg-[#1a1a1a] rounded-lg">
                        <p className="text-xs text-gray-500 mb-1">Your deposit address:</p>
                        <div className="flex items-center gap-2">
                          <Input
                            value={selectedDepositAddress}
                            readOnly
                            className="bg-transparent border-gray-700 text-white font-mono text-xs"
                          />
                          <Button
                            onClick={() => copyAddress(selectedDepositAddress || '')}
                            variant="ghost"
                            size="sm"
                            className="px-2"
                            data-testid="button-copy-deposit-address"
                          >
                            {copiedAddress ? (
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            ) : (
                              <Copy className="w-4 h-4 text-gray-400" />
                            )}
                          </Button>
                        </div>
                      </div>
                      
                      {/* Warning Message */}
                      <div className="bg-red-900/20 border border-red-900/50 rounded-lg p-2">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                          <div className="text-xs text-red-400">
                            <p>Send only {selectedAsset} to this address. Other tokens will be lost.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Only show deposit form if address is selected */}
              {selectedDepositAddress && (
                <>
                  {/* Amount Input Field */}
                  <div className="bg-[#242424] rounded-lg p-3">
                    <Label htmlFor="deposit-amount" className="text-gray-400 text-sm">
                      Deposit Amount
                    </Label>
                    <Input
                      id="deposit-amount"
                      type="number"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      placeholder={selectedAsset === 'BTC' ? "0.00000000" : selectedAsset === 'USDT' ? "0.00" : "0.00000000"}
                      step={selectedAsset === 'BTC' ? "0.00000001" : selectedAsset === 'USDT' ? "0.01" : "0.00000001"}
                      className="bg-[#1a1a1a] border-gray-700 text-white placeholder:text-gray-600 mt-1"
                      data-testid="input-deposit-amount"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Minimum: {selectedAsset === 'BTC' ? '0.0001 BTC' : selectedAsset === 'USDT' ? '20 USDT' : '0.001 B2B'}
                    </p>
                  </div>

                  {/* Transaction Hash Input */}
                  <div className="bg-[#242424] rounded-lg p-3">
                    <Label htmlFor="deposit-txhash" className="text-gray-400 text-sm">
                      Transaction Hash
                    </Label>
                    <Input
                      id="deposit-txhash"
                      type="text"
                      value={depositTxHash}
                      onChange={(e) => setDepositTxHash(e.target.value)}
                      placeholder="Enter transaction hash after sending"
                      className="bg-[#1a1a1a] border-gray-700 text-white placeholder:text-gray-600 font-mono text-xs mt-1"
                      data-testid="input-deposit-txhash"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Enter the transaction hash from your wallet
                    </p>
                  </div>

                  {/* Submit Button */}
                  <Button
                    onClick={handleDeposit}
                    disabled={!depositAmount || !depositTxHash || depositMutation.isPending}
                    className="w-full font-medium bg-[#f7931a] hover:bg-[#e88309] text-black disabled:opacity-50 py-3"
                    data-testid="button-submit-deposit"
                  >
                    {depositMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Processing Deposit...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Submit Deposit
                      </>
                    )}
                  </Button>
                </>
              )}

              {/* Instructions Section */}
              <div className="bg-[#242424] rounded-lg p-3 border border-[#f7931a]/20">
                <h3 className="text-[#f7931a] font-medium mb-3 text-sm">
                  Instructions
                </h3>
                <div className="space-y-2 text-xs text-gray-300">
                  <div className="flex items-start">
                    <span className="text-[#f7931a] mr-2 font-medium">1.</span>
                    <p>{selectedAsset === 'USDT' ? 'Select your preferred blockchain network' : 'Click "Get Deposit Address" to receive your deposit address'}</p>
                  </div>
                  <div className="flex items-start">
                    <span className="text-[#f7931a] mr-2 font-medium">2.</span>
                    <p>Click "Get Deposit Address" to receive your unique deposit address</p>
                  </div>
                  <div className="flex items-start">
                    <span className="text-[#f7931a] mr-2 font-medium">3.</span>
                    <p>Send {selectedAsset} to the displayed address{selectedAsset === 'USDT' ? ' using the selected network' : ''}</p>
                  </div>
                  <div className="flex items-start">
                    <span className="text-[#f7931a] mr-2 font-medium">4.</span>
                    <p>Enter the transaction amount and transaction hash</p>
                  </div>
                  <div className="flex items-start">
                    <span className="text-[#f7931a] mr-2 font-medium">5.</span>
                    <p>Click "Submit Deposit" to complete the process</p>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-[#f7931a]/10">
                  <p className="text-xs text-gray-400">
                    <span className="text-[#f7931a]">Note:</span> Processing time varies by network confirmation speed
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Withdraw Dialog - Full Page */}
      {showWithdrawDialog && (
        <div className="fixed inset-0 z-50 bg-[#1a1a1a] overflow-y-auto">
          <div className="min-h-screen flex flex-col">
            <div className="p-4 bg-[#242424] border-b border-gray-800 flex items-center justify-between">
              <h2 className="text-white font-medium text-lg">
                Withdraw {selectedAsset}
              </h2>
              <Button
                onClick={() => setShowWithdrawDialog(false)}
                variant="ghost"
                size="sm"
                className="text-gray-400 hover:text-white p-1"
              >
                <span className="text-2xl">&times;</span>
              </Button>
            </div>
            
            <div className="flex-1 p-4 space-y-4">
              {/* Amount Input */}
              <div className="bg-[#242424] rounded-lg p-4">
                <Label htmlFor="withdraw-amount" className="text-gray-400 text-sm">Amount</Label>
                <Input
                  id="withdraw-amount"
                  type="number"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder={selectedAsset === 'B2B' ? "0.00000000" : "0.00"}
                  step={selectedAsset === 'B2B' ? "0.00000001" : "0.01"}
                  max={selectedAsset === 'B2B' ? gbtcBalance || 0 : usdtBalance || 0}
                  className="bg-[#1a1a1a] border-gray-700 text-white placeholder:text-gray-600 mt-2"
                  data-testid="input-withdraw-amount"
                />
                <p className="text-xs text-gray-500 mt-2">
                  Available: {selectedAsset === 'B2B' 
                    ? `${gbtcBalance.toFixed(8)} B2B` 
                    : `${usdtBalance.toFixed(2)} USDT`}
                </p>
              </div>
              
              {/* Address Input */}
              <div className="bg-[#242424] rounded-lg p-4">
                <Label htmlFor="withdraw-address" className="text-gray-400 text-sm">
                  Wallet Address {selectedAsset === 'USDT' && '(ERC20 Network)'}
                </Label>
                <Input
                  id="withdraw-address"
                  value={withdrawAddress}
                  onChange={(e) => setWithdrawAddress(e.target.value)}
                  placeholder={`Enter ${selectedAsset} address`}
                  className="bg-[#1a1a1a] border-gray-700 text-white placeholder:text-gray-600 font-mono text-xs mt-2"
                  data-testid="input-withdraw-address"
                />
              </div>
              
              {/* Withdrawal Information */}
              <div className="bg-[#242424] rounded-lg p-4">
                <h3 className="text-white text-sm font-medium mb-3">Withdrawal Details</h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Minimum Withdrawal:</span>
                    <span className="text-gray-300">
                      {selectedAsset === 'USDT' ? '50 USDT' : 
                       selectedAsset === 'BTC' ? '0.001 BTC' : '0.01 B2B'}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Network Fee:</span>
                    <span className="text-gray-300">
                      {selectedAsset === 'USDT' ? '1 USDT' : 
                       selectedAsset === 'BTC' ? '0.0001 BTC' : '0.0001 B2B'}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Processing Time:</span>
                    <span className="text-gray-300">24-48 hours</span>
                  </div>
                  {selectedAsset === 'USDT' && (
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Network:</span>
                      <span className="text-gray-300">ERC20 (Ethereum)</span>
                    </div>
                  )}
                </div>
                <div className="mt-3 pt-3 border-t border-gray-700">
                  <p className="text-[10px] text-gray-500">
                    Please ensure you have sufficient balance to cover both the withdrawal amount and network fee. 
                    Withdrawals are processed within 24-48 hours after verification.
                  </p>
                </div>
              </div>
              
              {/* Submit Button */}
            {selectedAsset === 'B2B' ? (
              <Button
                disabled
                className="w-full bg-gray-700 cursor-not-allowed opacity-50"
                data-testid="button-confirm-withdraw"
              >
                B2B Withdrawals Coming Soon
              </Button>
            ) : (
              <Button
                onClick={handleWithdraw}
                disabled={withdrawMutation.isPending}
                className="w-full font-medium bg-[#f7931a] hover:bg-[#e88309] text-black disabled:opacity-50"
                data-testid="button-confirm-withdraw"
              >
                {withdrawMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Processing...
                  </>
                ) : (
                  'Submit Withdrawal'
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    )}

      {/* Transfer Dialog (B2B only) */}
      <Dialog open={showTransferDialog} onOpenChange={setShowTransferDialog}>
        <DialogContent className="sm:max-w-md bg-[#242424] border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-white font-medium">
              Transfer B2B
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="recipient" className="text-gray-400 text-sm">Recipient Username</Label>
              <Input
                id="recipient"
                value={recipientUsername}
                onChange={(e) => setRecipientUsername(e.target.value)}
                placeholder="Enter username"
                className="bg-[#1a1a1a] border-gray-700 text-white placeholder:text-gray-600"
                data-testid="input-recipient"
              />
            </div>
            <div>
              <Label htmlFor="transfer-amount" className="text-gray-400 text-sm">Amount (B2B)</Label>
              <Input
                id="transfer-amount"
                type="number"
                value={transferAmount}
                onChange={(e) => setTransferAmount(e.target.value)}
                placeholder="0.00000000"
                step="0.00000001"
                max={gbtcBalance || 0}
                className="bg-[#1a1a1a] border-gray-700 text-white placeholder:text-gray-600"
                data-testid="input-transfer-amount"
              />
              <p className="text-xs text-gray-500 mt-1">
                Available: {gbtcBalance.toFixed(8)} B2B
              </p>
            </div>
            <Button
              onClick={handleTransfer}
              disabled={transferMutation.isPending}
              className="w-full bg-[#f7931a] hover:bg-[#e88309] text-black font-medium"
              data-testid="button-confirm-transfer"
            >
              {transferMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Processing...
                </>
              ) : (
                'Send B2B'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Hash Power Restriction Dialog - Compact Version */}
      <Dialog open={showPowerRestrictionDialog} onOpenChange={setShowPowerRestrictionDialog}>
        <DialogContent className="sm:max-w-sm bg-gradient-to-br from-[#2a2a2a] to-[#1a1a1a] border border-[#f7931a]/30">
          <DialogHeader>
            <DialogTitle className="text-[#f7931a] font-semibold text-base flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Hash Power Requirement
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-3">
            {/* Current Hash Power Display */}
            <div className="bg-[#242424] border border-[#f7931a]/20 rounded-lg p-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-gray-400 text-xs">Your Current Hash Power</p>
                  <p className="text-white font-semibold">
                    {userHashPower.toFixed(2)} MH/s
                  </p>
                  <p className="text-gray-500 text-xs mt-1">
                    {userHashPower < 10 ? `${(10 - userHashPower).toFixed(2)} MH/s more needed` : 'Requirement met'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-gray-400 text-xs">Required</p>
                  <p className="text-[#f7931a] font-semibold">10 MH/s</p>
                  <p className="text-gray-500 text-xs mt-1">Minimum</p>
                </div>
              </div>
              
              {/* Progress Bar */}
              <div className="mt-3">
                <div className="w-full h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-[#f7931a]/60 to-[#f7931a] transition-all duration-500"
                    style={{ width: `${Math.min((userHashPower / 10) * 100, 100)}%` }}
                  ></div>
                </div>
                <p className="text-center text-gray-500 text-xs mt-1">
                  {((userHashPower / 10) * 100).toFixed(1)}% of requirement
                </p>
              </div>
            </div>
            
            {/* Transfer Restriction Notice */}
            <div className="flex items-start gap-2 bg-[#1a1a1a] rounded-lg p-3">
              <AlertTriangle className="h-3 w-3 text-[#f7931a] mt-0.5 shrink-0" />
              <div>
                <p className="text-white text-xs font-medium mb-1">Transfer Restriction</p>
                <p className="text-gray-400 text-xs leading-relaxed">
                  B2B token transfers are exclusively available to users with a minimum hash power of 10 MH/s. This requirement ensures network security and prevents spam transactions.
                </p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Transfer Details Dialog */}
      <Dialog 
        open={!!selectedTransfer} 
        onOpenChange={(open) => {
          if (!open) {
            setTimeout(() => setSelectedTransfer(null), 50); // Instant close
          }
        }}
      >
        <DialogContent className="sm:max-w-md bg-[#1a1a1a] border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-white font-medium text-center">
              {selectedTransfer?.displayType === 'Transfer In' ? 'Transfer In Details' : 'Transfer Out Details'}
            </DialogTitle>
          </DialogHeader>
          {selectedTransfer && (
            <div className="space-y-6 py-4">
              <div className="space-y-1">
                <p className="text-gray-500 text-sm">Amount</p>
                <p className="text-white font-mono text-lg">
                  B2B {safeParseFloat(selectedTransfer.amount).toFixed(8)}
                </p>
              </div>
              
              <div className="space-y-1">
                <p className="text-gray-500 text-sm">Status</p>
                <p className="text-white">
                  {selectedTransfer.status === 'approved' ? 'Completed' : selectedTransfer.status}
                </p>
              </div>
              
              <div className="space-y-1">
                <p className="text-gray-500 text-sm">Transfer Account</p>
                <p className="text-white">
                  {selectedTransfer.displayType === 'Transfer In' 
                    ? selectedTransfer.fromUsername 
                    : selectedTransfer.toUsername}
                </p>
              </div>
              
              <div className="space-y-1">
                <p className="text-gray-500 text-sm">Time</p>
                <p className="text-white">
                  {formatDate(selectedTransfer.createdAt)}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
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
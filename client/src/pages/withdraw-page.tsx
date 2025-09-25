import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Clock } from "lucide-react";

export default function WithdrawPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [amount, setAmount] = useState('');
  const [address, setAddress] = useState('');
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const [cooldownEndTime, setCooldownEndTime] = useState<number | null>(null);
  
  const usdtBalance = parseFloat(user?.usdtBalance || '0');
  const withdrawFee = 1; // 1 USDT flat fee
  const maxWithdraw = Math.max(0, usdtBalance);

  // Check cooldown status
  const { data: cooldownData, refetch: refetchCooldown } = useQuery({
    queryKey: ['/api/withdrawals/cooldown'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/withdrawals/cooldown');
      const data = await res.json();
      // Calculate end time for countdown
      if (!data.canWithdraw && data.hoursRemaining > 0) {
        const endTime = Date.now() + (data.hoursRemaining * 60 * 60 * 1000);
        setCooldownEndTime(endTime);
      } else {
        setCooldownEndTime(null);
      }
      return data;
    },
    staleTime: 60000 // Consider data fresh for 1 minute
  });

  // Update countdown timer with seconds precision
  useEffect(() => {
    if (cooldownEndTime && cooldownEndTime > Date.now()) {
      const updateTimer = () => {
        const remaining = cooldownEndTime - Date.now();
        
        if (remaining <= 0) {
          setTimeRemaining('');
          setCooldownEndTime(null);
          refetchCooldown();
          return;
        }
        
        const hours = Math.floor(remaining / (1000 * 60 * 60));
        const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
        
        if (hours > 0) {
          setTimeRemaining(`${hours}h ${minutes}m ${seconds}s`);
        } else if (minutes > 0) {
          setTimeRemaining(`${minutes}m ${seconds}s`);
        } else {
          setTimeRemaining(`${seconds}s`);
        }
      };
      
      updateTimer();
      const interval = setInterval(updateTimer, 1000); // Update every second
      
      return () => clearInterval(interval);
    } else {
      setTimeRemaining('');
    }
  }, [cooldownEndTime, refetchCooldown]);

  const createWithdrawalMutation = useMutation({
    mutationFn: async (data: { amount: string; address: string; network: string }) => {
      const res = await apiRequest("POST", "/api/withdrawals", data);
      if (!res.ok) {
        const error = await res.json().catch(() => ({ message: "Failed to process withdrawal" }));
        throw new Error(error.message || "Failed to process withdrawal");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ 
        title: "Success", 
        description: "Withdrawal request submitted successfully." 
      });
      setAmount('');
      setAddress('');
      queryClient.invalidateQueries({ queryKey: ["/api/withdrawals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      refetchCooldown();
    },
    onError: (error: any) => {
      // Handle errors professionally - no raw JSON
      let errorMessage = "Unable to process withdrawal. Please try again.";
      
      if (error.message?.includes('wait') || error.message?.includes('cooldown')) {
        errorMessage = "Please wait for the cooldown period before withdrawing.";
      } else if (error.message?.includes('balance') || error.message?.includes('insufficient')) {
        errorMessage = "Insufficient balance for this withdrawal.";
      } else if (error.message?.includes('minimum')) {
        errorMessage = "Amount is below minimum withdrawal limit.";
      } else if (error.message && !error.message.includes('ZodError') && !error.message.includes('Validation')) {
        errorMessage = error.message;
      }
      
      toast({ 
        title: "Withdrawal Failed", 
        description: errorMessage, 
        variant: "destructive" 
      });
    }
  });

  const handleWithdraw = () => {
    const withdrawAmount = parseFloat(amount);
    
    if (!amount || !address) {
      toast({ 
        title: "Missing Information", 
        description: "Please enter amount and wallet address.", 
        variant: "destructive" 
      });
      return;
    }
    
    // Validate address format
    if (!address.match(/^0x[a-fA-F0-9]{40}$/)) {
      toast({ 
        title: "Invalid Address", 
        description: "Please enter a valid ERC20 wallet address.", 
        variant: "destructive" 
      });
      return;
    }
    
    // Check minimum amount (50 USDT + 1 USDT fee = 51 USDT minimum balance needed)
    if (withdrawAmount < 50) {
      toast({ 
        title: "Below Minimum", 
        description: "Minimum withdrawal is 50 USDT.", 
        variant: "destructive" 
      });
      return;
    }
    
    // Check if user has enough balance including fee
    if (withdrawAmount + withdrawFee > usdtBalance) {
      toast({ 
        title: "Insufficient Balance", 
        description: `You need ${(withdrawAmount + withdrawFee).toFixed(2)} USDT (including fee).`, 
        variant: "destructive" 
      });
      return;
    }
    
    createWithdrawalMutation.mutate({
      amount: withdrawAmount.toString(),
      address: address.trim(),
      network: 'ERC20'
    });
  };

  // Query pending withdrawals
  const { data: pendingWithdrawals } = useQuery<any[]>({
    queryKey: ["/api/withdrawals/pending"]
  });

  return (
    <div className="mobile-page min-h-screen overflow-x-hidden">
      {/* Header */}
      <div className="mobile-header">
        <div>
          <h1 className="text-lg font-display font-bold text-primary">WITHDRAW</h1>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground font-mono">BALANCE</p>
          <p className="text-sm font-display font-bold text-accent">
            ${usdtBalance.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="mobile-content pb-6">
        {/* Withdrawal Form */}
        <Card className="mobile-card">
          <div className="space-y-4">
            {/* Address Input */}
            <div>
              <label className="text-xs text-muted-foreground font-mono mb-1.5 block">
                WALLET ADDRESS
              </label>
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="0x..."
                className="font-mono text-sm"
                data-testid="input-withdraw-address"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                ERC20 (Ethereum) network only
              </p>
            </div>

            {/* Amount Input */}
            <div>
              <label className="text-xs text-muted-foreground font-mono mb-1.5 block">
                AMOUNT
              </label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                min="50"
                max={Math.max(0, usdtBalance - withdrawFee)}
                step="0.01"
                className="font-mono text-sm"
                data-testid="input-withdraw-amount"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Min: 50 USDT | Max: {Math.max(0, usdtBalance - withdrawFee).toFixed(2)} USDT
              </p>
            </div>

            {/* Summary */}
            {amount && parseFloat(amount) > 0 && (
              <div className="p-3 bg-muted/30 rounded-lg space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-mono">{parseFloat(amount).toFixed(2)} USDT</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Fee</span>
                  <span className="font-mono">{withdrawFee} USDT</span>
                </div>
                <div className="h-px bg-border"></div>
                <div className="flex justify-between text-sm font-semibold">
                  <span>You receive</span>
                  <span className="text-primary font-mono">
                    {Math.max(0, parseFloat(amount) - withdrawFee).toFixed(2)} USDT
                  </span>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Submit Button */}
        <Button
          onClick={handleWithdraw}
          disabled={
            createWithdrawalMutation.isPending || 
            !amount || 
            !address || 
            parseFloat(amount) < 50 || 
            parseFloat(amount) + withdrawFee > usdtBalance || 
            (cooldownData && !cooldownData.canWithdraw)
          }
          className={`mobile-btn-primary text-lg ${
            cooldownData && !cooldownData.canWithdraw 
              ? 'bg-orange-900/50 hover:bg-orange-900/50 border-orange-500/30' 
              : ''
          }`}
          data-testid="button-submit-withdrawal"
        >
          {createWithdrawalMutation.isPending ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Processing...
            </>
          ) : cooldownData && !cooldownData.canWithdraw && timeRemaining ? (
            <>
              <Clock className="w-5 h-5 mr-2 text-orange-500" />
              <span className="text-orange-500">Cooldown: {timeRemaining}</span>
            </>
          ) : (
            'WITHDRAW'
          )}
        </Button>

        {/* Pending Withdrawals */}
        {pendingWithdrawals && pendingWithdrawals.length > 0 && (
          <Card className="mobile-card">
            <p className="text-xs font-mono text-muted-foreground mb-2">PENDING</p>
            <div className="space-y-2">
              {pendingWithdrawals.map((withdrawal: any) => (
                <div key={withdrawal.id} className="flex justify-between p-2 bg-muted/30 rounded">
                  <span className="text-sm font-mono">{withdrawal.amount} USDT</span>
                  <span className="text-xs text-yellow-500">Processing</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
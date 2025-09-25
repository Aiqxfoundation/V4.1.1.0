import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export default function TransferPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  
  const b2bBalance = parseFloat(user?.b2bBalance || '0');

  const transferMutation = useMutation({
    mutationFn: async (data: { recipient: string; amount: number; memo?: string }) => {
      const res = await apiRequest("POST", "/api/transfer", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ 
        title: "Transfer Successful!", 
        description: `Sent ${amount} B2B to ${recipient}` 
      });
      setRecipient('');
      setAmount('');
      setMemo('');
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Transfer Failed", 
        description: error.message, 
        variant: "destructive" 
      });
    }
  });

  const handleTransfer = () => {
    const transferAmount = parseFloat(amount);
    
    if (!recipient || !amount) {
      toast({ 
        title: "Missing Information", 
        description: "Please enter recipient and amount", 
        variant: "destructive" 
      });
      return;
    }
    
    if (transferAmount > b2bBalance) {
      toast({ 
        title: "Insufficient Balance", 
        description: "You don't have enough B2B", 
        variant: "destructive" 
      });
      return;
    }
    
    transferMutation.mutate({
      recipient,
      amount: transferAmount,
      memo
    });
  };

  // Calculate percentage of supply mined
  const totalSupply = 21000000; // 21M max supply from whitepaper
  const totalMinted = 1312500; // Mock data
  const percentMined = (totalMinted / totalSupply) * 100;
  const isTransferEnabled = percentMined < 25;

  return (
    <div className="mobile-page">
      {/* Header */}
      <div className="mobile-header">
        <div>
          <h1 className="text-lg font-display font-bold text-primary">TRANSFER B2B</h1>
          <p className="text-xs text-muted-foreground font-mono">
            {isTransferEnabled ? "Internal Only" : "All Transfers"}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground font-mono">BALANCE</p>
          <p className="text-sm font-display font-bold text-primary">
            {b2bBalance.toFixed(4)} B2B
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="mobile-content">
        {/* Transfer Status */}
        {isTransferEnabled ? (
          <Card className="mobile-card bg-gradient-to-br from-primary/10 to-chart-4/10">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-mono text-muted-foreground">TRANSFER STATUS</p>
              <div className="w-3 h-3 bg-primary rounded-full mining-pulse"></div>
            </div>
            <p className="text-xs text-primary font-bold mb-2">✓ Internal Transfers Enabled</p>
            <p className="text-xs text-muted-foreground">
              External transfers will be enabled when {(25 - percentMined).toFixed(2)}% more is mined
            </p>
          </Card>
        ) : (
          <Card className="mobile-card bg-gradient-to-br from-accent/10 to-chart-3/10">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-mono text-muted-foreground">TRANSFER STATUS</p>
              <div className="w-3 h-3 bg-accent rounded-full"></div>
            </div>
            <p className="text-xs text-accent font-bold mb-2">✓ All Transfers Enabled</p>
            <p className="text-xs text-muted-foreground">
              B2B is now listed! External transfers are available.
            </p>
          </Card>
        )}

        {/* Balance Display */}
        <Card className="mobile-card">
          <div className="text-center">
            <p className="text-xs text-muted-foreground font-mono mb-2">AVAILABLE TO TRANSFER</p>
            <p className="text-4xl font-display font-black text-primary glow-green">
              {b2bBalance.toFixed(4)}
            </p>
            <p className="text-sm text-muted-foreground font-mono mt-1">B2B</p>
          </div>
        </Card>

        {/* Transfer Form */}
        <Card className="mobile-card">
          <p className="text-sm font-mono text-muted-foreground mb-3">TRANSFER DETAILS</p>
          
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground font-mono mb-1 block">
                RECIPIENT USERNAME *
              </label>
              <Input
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="Enter username"
                data-testid="input-recipient"
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground font-mono mb-1 block">
                AMOUNT (B2B) *
              </label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.0000"
                min="0.0001"
                max={b2bBalance}
                step="0.0001"
                data-testid="input-transfer-amount"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Max: {b2bBalance.toFixed(4)} B2B
              </p>
            </div>

            <div>
              <label className="text-xs text-muted-foreground font-mono mb-1 block">
                MEMO (Optional)
              </label>
              <Textarea
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="Add a note for the recipient"
                className="min-h-[60px] text-xs"
                data-testid="input-memo"
              />
            </div>
          </div>
        </Card>

        {/* Transfer Preview */}
        {recipient && amount && (
          <Card className="mobile-card bg-background">
            <p className="text-xs font-mono text-muted-foreground mb-2">PREVIEW</p>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">To:</span>
                <span className="font-mono">{recipient}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount:</span>
                <span className="font-mono text-primary">{amount} B2B</span>
              </div>
              {memo && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Memo:</span>
                  <span className="truncate max-w-[150px]">{memo}</span>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Transfer Button */}
        <Button
          onClick={handleTransfer}
          disabled={transferMutation.isPending || !recipient || !amount || parseFloat(amount) > b2bBalance}
          className="mobile-btn-primary text-lg"
          data-testid="button-confirm-transfer"
        >
          {transferMutation.isPending ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Processing...
            </>
          ) : (
            <>
              <i className="fas fa-exchange-alt mr-3"></i>
              SEND {amount || '0'} B2B
            </>
          )}
        </Button>

        {/* Info */}
        <Card className="mobile-card">
          <div className="flex items-start space-x-3">
            <i className="fas fa-info-circle text-primary mt-1"></i>
            <div className="text-xs text-muted-foreground">
              <p className="mb-2">• Transfers are instant and irreversible</p>
              <p className="mb-2">• No fees for internal transfers</p>
              <p>• Make sure the recipient username is correct</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
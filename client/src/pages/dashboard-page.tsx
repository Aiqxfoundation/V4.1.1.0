import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { Link } from "wouter";
import bitcoinLogo from "@assets/file_00000000221c61fab63936953b889556_1756633909848.png";
import { formatHashPower } from "@/lib/utils";

export default function DashboardPage() {
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  const [depositForm, setDepositForm] = useState({ network: "BSC", txHash: "", amount: "" });
  const [hashPowerAmount, setHashPowerAmount] = useState([1]);
  const [withdrawAmount, setWithdrawAmount] = useState("");

  const depositMutation = useMutation({
    mutationFn: async (data: { network: string; txHash: string; amount: string }) => {
      const res = await apiRequest("POST", "/api/deposits", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Deposit submitted", description: "Your deposit is pending admin approval." });
      setDepositForm({ network: "BSC", txHash: "", amount: "" });
    },
    onError: (error: Error) => {
      toast({ title: "Deposit failed", description: error.message, variant: "destructive" });
    }
  });

  const purchasePowerMutation = useMutation({
    mutationFn: async (amount: number) => {
      const res = await apiRequest("POST", "/api/purchase-power", { amount });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Hash power purchased", description: `Successfully purchased ${formatHashPower(hashPowerAmount[0] * 100)} of hash power.` });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
    },
    onError: (error: Error) => {
      toast({ title: "Purchase failed", description: error.message, variant: "destructive" });
    }
  });

  const claimRewardsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/claim-rewards");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Rewards claimed", description: "Mining rewards have been claimed successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
    },
    onError: (error: Error) => {
      toast({ title: "Claim failed", description: error.message, variant: "destructive" });
    }
  });

  const handleDeposit = (e: React.FormEvent) => {
    e.preventDefault();
    if (depositForm.txHash && depositForm.amount) {
      depositMutation.mutate(depositForm);
    }
  };

  const handlePurchasePower = () => {
    purchasePowerMutation.mutate(hashPowerAmount[0]);
  };

  const handleClaimRewards = () => {
    claimRewardsMutation.mutate();
  };

  const networkAddresses = {
    BSC: "0xc1de03ab9892b9eb1deed8a2dd453b7fcefea9e9",
    ETH: "0xc1de03ab9892b9eb1deed8a2dd453b7fcefea9e9",
    TRC20: "THLwx1Ejfo8nSUjeVahCxTbxm7jCLkusPc",
    APTOS: "0xa02e7dfd29bde133c04b2b2c3a6f6623bcab6865211635dbc8271d51ec8ae053"
  };

  if (!user) return null;

  return (
    <div className="min-h-screen matrix-bg">
      {/* Floating particles effect */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-primary rounded-full mining-float opacity-60"></div>
        <div className="absolute top-1/3 right-1/3 w-1 h-1 bg-chart-4 rounded-full mining-float opacity-40" style={{animationDelay: '2s'}}></div>
        <div className="absolute bottom-1/4 left-1/3 w-1.5 h-1.5 bg-accent rounded-full mining-float opacity-50" style={{animationDelay: '4s'}}></div>
        <div className="absolute top-1/2 right-1/4 w-1 h-1 bg-primary rounded-full mining-float opacity-30" style={{animationDelay: '1s'}}></div>
      </div>

      {/* Cyber Header */}
      <header className="bg-card/80 border-b border-primary/20 sticky top-0 z-50 backdrop-blur-md">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <div className="w-12 h-12 cyber-border rounded-xl flex items-center justify-center glow-bitcoin">
                  <img src={bitcoinLogo} alt="B2B" className="w-8 h-8 mining-pulse" />
                </div>
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full mining-pulse"></div>
              </div>
              <div>
                <h1 className="text-2xl font-display font-bold text-primary glow-green">
                  CONTROL<span className="text-chart-4">CENTER</span>
                </h1>
                <p className="text-xs text-muted-foreground font-mono">Mining Control Interface</p>
              </div>
            </div>
            
            <nav className="hidden md:flex items-center space-x-8">
              <Link href="/" className="text-foreground hover:text-primary transition-colors font-medium">
                <i className="fas fa-home mr-2"></i>Home
              </Link>
              <Link href="/mining" className="text-foreground hover:text-primary transition-colors font-medium">
                <i className="fas fa-microchip mr-2"></i>Mining
              </Link>
              <button className="text-primary font-medium transition-all hover:glow-green font-display">
                <i className="fas fa-satellite-dish mr-2 mining-spin"></i>Control
              </button>
              {user.isAdmin && (
                <Link href="/admin" className="text-foreground hover:text-primary transition-colors font-medium">
                  <i className="fas fa-cogs mr-2"></i>Admin
                </Link>
              )}
              <button 
                onClick={() => logoutMutation.mutate()}
                className="text-foreground hover:text-destructive transition-colors font-medium"
                data-testid="button-logout"
              >
                <i className="fas fa-sign-out-alt mr-2"></i>Exit
              </button>
            </nav>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="mb-12 text-center">
          <h1 className="text-5xl md:text-6xl font-display font-black mb-4">
            <span className="text-primary glow-green">WELCOME</span>
            <br />
            <span className="text-chart-4 glow-bitcoin" data-testid="text-username">{user.username}</span>
          </h1>
          <p className="text-xl text-muted-foreground font-mono">Command your mining empire from the quantum control center</p>
        </div>
        
        {/* Stats Overview */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <Card className="hologram-card border-accent/30 block-3d">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-mono">USDT_BALANCE</p>
                  <p className="text-2xl font-display font-black text-accent" data-testid="text-usdt-balance">
                    ${parseFloat(user.usdtBalance || '0').toFixed(2)}
                  </p>
                </div>
                <div className="w-12 h-12 cyber-border rounded-lg flex items-center justify-center">
                  <i className="fas fa-dollar-sign text-accent mining-pulse"></i>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="hologram-card border-primary/30 block-3d">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-mono">HASH_POWER</p>
                  <p className="text-2xl font-display font-black text-primary" data-testid="text-hash-power">
                    {parseFloat(user.hashPower || '0').toFixed(2)} TH/s
                  </p>
                </div>
                <div className="w-12 h-12 cyber-border rounded-lg flex items-center justify-center glow-green">
                  <i className="fas fa-microchip text-primary mining-pulse"></i>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="hologram-card border-chart-4/30 block-3d">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-mono">B2B_BALANCE</p>
                  <p className="text-2xl font-display font-black text-chart-4" data-testid="text-gbtc-balance">
                    {parseFloat(user.b2bBalance || '0').toFixed(4)}
                  </p>
                </div>
                <div className="w-12 h-12 cyber-border rounded-lg flex items-center justify-center glow-bitcoin">
                  <img src={bitcoinLogo} alt="B2B" className="w-6 h-6 mining-float" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="hologram-card border-chart-3/30 block-3d">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-mono">PENDING_REWARDS</p>
                  <p className="text-2xl font-display font-black text-chart-3" data-testid="text-unclaimed-rewards">
                    {parseFloat(user.unclaimedBalance || '0').toFixed(4)}
                  </p>
                </div>
                <div className="w-12 h-12 cyber-border rounded-lg flex items-center justify-center">
                  <i className="fas fa-coins text-chart-3 mining-pulse"></i>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-8">
            {/* Deposit Section */}
            <Card className="cyber-border bg-gradient-to-br from-card/80 to-background/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center font-display text-xl">
                  <div className="w-8 h-8 bg-accent rounded-full mr-3 mining-pulse glow-green"></div>
                  QUANTUM DEPOSIT PROTOCOL
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Network Selection */}
                <div className="mb-6">
                  <Label className="text-sm font-mono font-bold mb-4 block text-primary">SELECT_NETWORK:</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(networkAddresses).map(([network, address]) => (
                      <div 
                        key={network}
                        className={`network-badge hologram-card p-4 rounded-xl border cursor-pointer transition-all block-3d ${
                          depositForm.network === network ? 'border-primary glow-green' : 'border-border/30 hover:border-primary/50'
                        }`}
                        onClick={() => setDepositForm(prev => ({ ...prev, network }))}
                        data-testid={`network-${network.toLowerCase()}`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-display font-bold">USDT {network}</span>
                          <div className="flex items-center space-x-2">
                            <span className={`text-xs px-2 py-1 rounded-full font-mono ${
                              network === 'BSC' ? 'bg-accent/20 text-accent' :
                              network === 'ETH' ? 'bg-chart-4/20 text-chart-4' :
                              network === 'TRC20' ? 'bg-destructive/20 text-destructive' :
                              'bg-chart-3/20 text-chart-3'
                            }`}>
                              {network === 'BSC' ? 'BEP-20' : network === 'ETH' ? 'ERC-20' : network}
                            </span>
                            <div className={`w-3 h-3 rounded-full mining-pulse ${depositForm.network === network ? 'bg-primary glow-green' : 'bg-muted-foreground'}`}></div>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground font-mono break-all bg-background/50 p-2 rounded">{address}</p>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Transaction Form */}
                <form onSubmit={handleDeposit} className="space-y-4">
                  <div>
                    <Label htmlFor="txHash">Transaction Hash</Label>
                    <Input
                      id="txHash"
                      type="text"
                      placeholder="Enter your transaction hash"
                      value={depositForm.txHash}
                      onChange={(e) => setDepositForm(prev => ({ ...prev, txHash: e.target.value }))}
                      className="code-font text-sm"
                      required
                      data-testid="input-tx-hash"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="amount">Amount (USDT)</Label>
                    <Input
                      id="amount"
                      type="number"
                      placeholder="0.00"
                      step="0.01"
                      min="1"
                      value={depositForm.amount}
                      onChange={(e) => setDepositForm(prev => ({ ...prev, amount: e.target.value }))}
                      required
                      data-testid="input-deposit-amount"
                    />
                  </div>
                  
                  <Button 
                    type="submit" 
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                    disabled={depositMutation.isPending}
                    data-testid="button-submit-deposit"
                  >
                    {depositMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <i className="fas fa-paper-plane mr-2"></i>
                    )}
                    Submit Deposit
                  </Button>
                </form>
              </CardContent>
            </Card>
            
            {/* Hash Power Purchase */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <i className="fas fa-shopping-cart text-accent mr-3"></i>
                  Purchase Hash Power
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <Label className="text-sm font-medium">Amount (USDT)</Label>
                      <span className="text-sm text-muted-foreground">Rate: 1 USDT = 100 KH/s</span>
                    </div>
                    <Slider
                      value={hashPowerAmount}
                      onValueChange={setHashPowerAmount}
                      max={100}
                      min={1}
                      step={1}
                      className="w-full"
                      data-testid="slider-hash-power"
                    />
                    <div className="flex justify-between text-sm text-muted-foreground mt-2">
                      <span>$1</span>
                      <span className="font-semibold text-primary" data-testid="text-selected-amount">
                        ${hashPowerAmount[0]}
                      </span>
                      <span>$100</span>
                    </div>
                  </div>
                  
                  <div className="bg-background p-4 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">You will receive:</span>
                      <span className="font-semibold text-primary" data-testid="text-hash-power-received">
                        {formatHashPower(hashPowerAmount[0] * 100)}
                      </span>
                    </div>
                  </div>
                  
                  <Button 
                    onClick={handlePurchasePower}
                    className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
                    disabled={purchasePowerMutation.isPending || parseFloat(user.usdtBalance || '0') < hashPowerAmount[0]}
                    data-testid="button-purchase-power"
                  >
                    {purchasePowerMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <i className="fas fa-bolt mr-2"></i>
                    )}
                    Purchase Power
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Right Column */}
          <div className="space-y-8">
            {/* Mining Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <i className="fas fa-pickaxe text-primary mr-3"></i>
                  Mining Operations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Current Block:</span>
                    <span className="font-semibold text-primary">#2</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Block Reward:</span>
                    <span className="font-semibold text-chart-4">50 B2B</span>
                  </div>
                  
                  <div className="pt-4 border-t border-border">
                    <Button 
                      onClick={handleClaimRewards}
                      className="w-full bg-primary text-primary-foreground hover:bg-primary/90 mining-animation"
                      disabled={claimRewardsMutation.isPending || parseFloat(user.unclaimedBalance || '0') === 0}
                      data-testid="button-claim-rewards"
                    >
                      {claimRewardsMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <i className="fas fa-coins mr-2"></i>
                      )}
                      Claim {parseFloat(user.unclaimedBalance || '0').toFixed(4)} B2B
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Link href="/withdraw">
                    <Button className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/80">
                      <i className="fas fa-arrow-up mr-2"></i>
                      Withdraw Funds
                    </Button>
                  </Link>
                  
                  <Link href="/transactions">
                    <Button className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/80">
                      <i className="fas fa-history mr-2"></i>
                      Transaction History
                    </Button>
                  </Link>
                  
                  <Link href="/account">
                    <Button className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/80">
                      <i className="fas fa-user mr-2"></i>
                      My Account
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

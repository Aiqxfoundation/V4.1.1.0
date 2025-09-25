import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Bitcoin, Clock, Lock, TrendingUp, Hash, DollarSign, Calendar, CheckCircle, Zap, Trophy, Gem, Crown } from "lucide-react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

// Time periods with corresponding APR rates
const TIME_PERIODS = [
  { months: 3, label: "3 Months", apr: 10, color: "bg-blue-600", icon: Zap },
  { months: 6, label: "6 Months", apr: 15, color: "bg-purple-600", icon: Trophy },
  { months: 12, label: "1 Year", apr: 20, color: "bg-orange-600", icon: Gem },
  { months: 24, label: "2 Years", apr: 30, color: "bg-red-600", icon: Crown },
];

export default function BtcStakingEnhanced() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  
  const [btcSliderValue, setBtcSliderValue] = useState([1]);
  const [hashrateSliderValue, setHashrateSliderValue] = useState([1000]);
  const [selectedPeriod, setSelectedPeriod] = useState(TIME_PERIODS[2]); // Default to 1 year
  const [useHashrate, setUseHashrate] = useState(true);

  // Fetch BTC prices and hashrate info
  const { data: priceData } = useQuery<{
    btcPrice: string;
    hashratePrice: string;
    btcPerHashrate: string;
    timestamp: string;
  }>({
    queryKey: ['/api/btc/prices'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch user's BTC balance
  const { data: balanceData } = useQuery<{
    btcBalance: string;
  }>({
    queryKey: ['/api/btc/balance'],
    enabled: !!user,
  });

  // Fetch user's active stakes
  const { data: stakesData } = useQuery<{
    stakes: any[];
    currentBtcPrice: string;
    totalStaked: string;
    totalDailyRewards: string;
  }>({
    queryKey: ['/api/btc/stakes'],
    enabled: !!user,
  });

  // Create stake mutation
  const stakeMutation = useMutation({
    mutationFn: async (data: { btcAmount: string; useHashrate: boolean; months: number; apr: number }) => {
      const response = await fetch('/api/btc/stake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create stake');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Stake Created Successfully",
        description: `Your BTC is now locked for ${selectedPeriod.label} earning ${selectedPeriod.apr}% APR`,
        className: "bg-green-800 text-white",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/btc/balance'] });
      queryClient.invalidateQueries({ queryKey: ['/api/btc/stakes'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
    },
    onError: (error: any) => {
      toast({
        title: "Staking Failed",
        description: error.message || "Failed to create stake",
        variant: "destructive",
      });
    },
  });

  const btcBalance = parseFloat(balanceData?.btcBalance || "0");
  const btcPrice = parseFloat(priceData?.btcPrice || "0");
  const userHashPower = parseFloat(user?.hashPower || "0");
  
  const btcAmount = btcSliderValue[0];
  const hashrateAmount = hashrateSliderValue[0];
  
  // Calculate returns based on selected period
  const dailyReward = (btcAmount * selectedPeriod.apr / 100 / 365);
  const totalReturn = (btcAmount * selectedPeriod.apr / 100 * (selectedPeriod.months / 12));
  const totalWithPrincipal = btcAmount + totalReturn;
  const dollarValue = btcAmount * btcPrice;
  const dollarReturn = totalReturn * btcPrice;

  // Update hashrate slider when BTC slider changes
  useEffect(() => {
    if (useHashrate) {
      setHashrateSliderValue([btcAmount * 1000]);
    }
  }, [btcAmount, useHashrate]);

  const handleStake = () => {
    stakeMutation.mutate({
      btcAmount: btcAmount.toString(),
      useHashrate,
      months: selectedPeriod.months,
      apr: selectedPeriod.apr,
    });
  };

  return (
    <div className="mobile-page bg-[#1a1a1a]">
      {/* Header */}
      <div className="mobile-header bg-[#1a1a1a] border-b border-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Button
              onClick={() => setLocation('/wallet')}
              variant="ghost"
              size="sm"
              className="p-0 mr-3"
              data-testid="button-back"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </Button>
            <h1 className="text-lg font-medium text-white">Advanced BTC Staking</h1>
          </div>
          <Badge className={`${selectedPeriod.color} text-white`}>
            {selectedPeriod.apr}% APR
          </Badge>
        </div>
      </div>

      {/* Content */}
      <div className="mobile-content">
        {/* Real-time Price Display */}
        <Card className="p-4 bg-gradient-to-r from-[#f7931a]/20 to-[#f7931a]/10 border-[#f7931a]/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bitcoin className="w-6 h-6 text-[#f7931a]" />
              <div>
                <p className="text-xs text-gray-400">Bitcoin Price</p>
                <p className="text-xl font-bold text-white">
                  ${priceData?.btcPrice ? Number(priceData.btcPrice).toLocaleString() : '0'}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400">Your Balance</p>
              <p className="text-lg font-medium text-[#f7931a]">
                {btcBalance.toFixed(8)} BTC
              </p>
            </div>
          </div>
        </Card>

        <Tabs defaultValue="stake" className="mt-4">
          <TabsList className="grid w-full grid-cols-2 bg-[#242424]">
            <TabsTrigger value="stake" className="data-[state=active]:bg-[#f7931a] data-[state=active]:text-black">
              Create Stake
            </TabsTrigger>
            <TabsTrigger value="active" className="data-[state=active]:bg-[#f7931a] data-[state=active]:text-black">
              Active Stakes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="stake" className="mt-4">
            <Card className="p-4 bg-[#242424] border-gray-800">
              {/* Time Period Selector */}
              <div className="mb-6">
                <Label className="text-white mb-3 block">Select Lock Period</Label>
                <div className="grid grid-cols-2 gap-2">
                  {TIME_PERIODS.map((period) => {
                    const Icon = period.icon;
                    return (
                      <button
                        key={period.months}
                        onClick={() => setSelectedPeriod(period)}
                        className={`p-3 rounded-lg border-2 transition-all ${
                          selectedPeriod.months === period.months
                            ? `${period.color} border-white text-white`
                            : 'bg-[#1a1a1a] border-gray-700 text-gray-400 hover:border-gray-500'
                        }`}
                        data-testid={`button-period-${period.months}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Icon className="w-4 h-4" />
                            <span className="text-sm font-medium">{period.label}</span>
                          </div>
                          <Badge className="bg-black/30 text-xs">
                            {period.apr}%
                          </Badge>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <Separator className="mb-6 bg-gray-700" />

              {/* BTC Amount Slider */}
              <div className="mb-6">
                <div className="flex justify-between items-center mb-2">
                  <Label className="text-white">BTC Amount</Label>
                  <div className="text-right">
                    <p className="text-lg font-bold text-[#f7931a]">{btcAmount} BTC</p>
                    <p className="text-xs text-gray-400">
                      ≈ ${(btcAmount * btcPrice).toLocaleString()}
                    </p>
                  </div>
                </div>
                <Slider
                  value={btcSliderValue}
                  onValueChange={setBtcSliderValue}
                  min={0.1}
                  max={Math.max(10, btcBalance)}
                  step={0.1}
                  className="mb-2"
                  data-testid="slider-btc-amount"
                />
                <div className="flex justify-between text-xs text-gray-400">
                  <span>0.1 BTC</span>
                  <span>{Math.max(10, btcBalance).toFixed(1)} BTC</span>
                </div>
              </div>

              {/* Hashrate Amount Slider */}
              <div className="mb-6">
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-2">
                    <Label className="text-white">B2B Hashrate</Label>
                    <input
                      type="checkbox"
                      checked={useHashrate}
                      onChange={(e) => setUseHashrate(e.target.checked)}
                      className="w-4 h-4 rounded"
                      data-testid="checkbox-use-hashrate"
                    />
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-green-400">
                      {useHashrate ? hashrateAmount.toFixed(0) : '0'} GH/s
                    </p>
                    <p className="text-xs text-gray-400">
                      {useHashrate ? `Required: ${(btcAmount * 1000).toFixed(0)} GH/s` : 'Not used'}
                    </p>
                  </div>
                </div>
                {useHashrate && (
                  <>
                    <Slider
                      value={hashrateSliderValue}
                      onValueChange={setHashrateSliderValue}
                      min={100}
                      max={Math.max(10000, userHashPower)}
                      step={100}
                      className="mb-2"
                      disabled={!useHashrate}
                      data-testid="slider-hashrate-amount"
                    />
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>100 GH/s</span>
                      <span>{Math.max(10000, userHashPower).toFixed(0)} GH/s</span>
                    </div>
                  </>
                )}
              </div>

              <Separator className="mb-6 bg-gray-700" />

              {/* Returns Calculator */}
              <div className="bg-gradient-to-r from-[#1a1a1a] to-[#242424] rounded-lg p-4 mb-6">
                <h3 className="text-white font-medium mb-3 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-green-400" />
                  Projected Returns
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-400">Daily Rewards</span>
                    <span className="text-sm font-medium text-white">
                      {dailyReward.toFixed(8)} BTC
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-400">Total Return</span>
                    <span className="text-sm font-medium text-green-400">
                      +{totalReturn.toFixed(8)} BTC
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-400">Total After {selectedPeriod.label}</span>
                    <span className="text-sm font-bold text-[#f7931a]">
                      {totalWithPrincipal.toFixed(8)} BTC
                    </span>
                  </div>
                  <Separator className="bg-gray-700 my-2" />
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-400">Dollar Value</span>
                    <span className="text-sm font-medium text-white">
                      ${dollarValue.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-400">Dollar Return</span>
                    <span className="text-sm font-medium text-green-400">
                      +${dollarReturn.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Requirements Check */}
              <div className="bg-yellow-900/20 border border-yellow-600/30 rounded p-3 mb-6">
                <p className="text-xs text-yellow-400 mb-2">Requirements Check:</p>
                <ul className="text-xs text-gray-400 space-y-1">
                  <li className="flex items-center gap-1">
                    <CheckCircle className={`w-3 h-3 ${btcBalance >= btcAmount ? 'text-green-400' : 'text-gray-600'}`} />
                    BTC Balance: {btcBalance >= btcAmount ? 'Sufficient' : `Need ${(btcAmount - btcBalance).toFixed(8)} more BTC`}
                  </li>
                  <li className="flex items-center gap-1">
                    <CheckCircle className={`w-3 h-3 ${!useHashrate || userHashPower >= hashrateAmount ? 'text-green-400' : 'text-gray-600'}`} />
                    Hashrate: {!useHashrate ? 'Not Required' : userHashPower >= hashrateAmount ? 'Sufficient' : `Need ${(hashrateAmount - userHashPower).toFixed(0)} more GH/s`}
                  </li>
                  <li className="flex items-center gap-1">
                    <CheckCircle className="w-3 h-3 text-yellow-400" />
                    Lock Period: {selectedPeriod.label} commitment
                  </li>
                </ul>
              </div>

              <Button
                onClick={handleStake}
                className={`w-full ${selectedPeriod.color} hover:opacity-90 text-white font-medium`}
                disabled={
                  btcBalance < btcAmount ||
                  (useHashrate && userHashPower < hashrateAmount) ||
                  stakeMutation.isPending
                }
                data-testid="button-create-stake"
              >
                {stakeMutation.isPending ? (
                  "Creating Stake..."
                ) : (
                  <>
                    <Lock className="w-4 h-4 mr-2" />
                    Lock {btcAmount} BTC for {selectedPeriod.label} @ {selectedPeriod.apr}% APR
                  </>
                )}
              </Button>
            </Card>
          </TabsContent>

          <TabsContent value="active" className="mt-4">
            <Card className="p-4 bg-[#242424] border-gray-800">
              {stakesData?.stakes && stakesData.stakes.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-white font-medium">Your Stakes</h3>
                    <div className="text-right">
                      <p className="text-xs text-gray-400">Total Daily Rewards</p>
                      <p className="text-lg font-bold text-[#f7931a]">
                        {stakesData.totalDailyRewards} BTC
                      </p>
                    </div>
                  </div>
                  
                  {stakesData.stakes.map((stake: any) => {
                    const periodInfo = TIME_PERIODS.find(p => p.apr === parseFloat(stake.aprRate)) || TIME_PERIODS[2];
                    const Icon = periodInfo.icon;
                    
                    return (
                      <div key={stake.id} className="bg-[#1a1a1a] rounded-lg p-4 border border-gray-700">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex items-center gap-2">
                            <Icon className={`w-5 h-5 text-white`} />
                            <div>
                              <p className="text-white font-medium">
                                {parseFloat(stake.btcAmount).toFixed(8)} BTC
                              </p>
                              <p className="text-xs text-gray-400">
                                Staked {new Date(stake.stakedAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <Badge className={`${periodInfo.color} text-white`}>
                            {stake.aprRate}% APR
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <p className="text-gray-400">Daily Reward</p>
                            <p className="text-[#f7931a] font-medium">
                              {parseFloat(stake.dailyReward).toFixed(8)} BTC
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-400">Total Earned</p>
                            <p className="text-green-400 font-medium">
                              {parseFloat(stake.totalRewardsPaid).toFixed(8)} BTC
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-400">Locked Hashrate</p>
                            <p className="text-white font-medium">
                              {parseFloat(stake.gbtcHashrate).toFixed(0)} GH/s
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-400">Unlock Date</p>
                            <p className="text-white font-medium">
                              {new Date(stake.unlockAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        
                        {/* Progress Bar */}
                        <div className="mt-3">
                          <div className="flex justify-between text-xs text-gray-400 mb-1">
                            <span>Progress</span>
                            <span>
                              {Math.floor(
                                ((new Date().getTime() - new Date(stake.stakedAt).getTime()) /
                                  (new Date(stake.unlockAt).getTime() - new Date(stake.stakedAt).getTime())) * 100
                              )}%
                            </span>
                          </div>
                          <div className="w-full bg-gray-700 rounded-full h-2">
                            <div 
                              className={`${periodInfo.color} h-2 rounded-full transition-all`}
                              style={{
                                width: `${Math.min(100, Math.floor(
                                  ((new Date().getTime() - new Date(stake.stakedAt).getTime()) /
                                    (new Date(stake.unlockAt).getTime() - new Date(stake.stakedAt).getTime())) * 100
                                ))}%`
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  
                  <div className="bg-blue-900/20 border border-blue-600/30 rounded p-3">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-blue-400" />
                      <p className="text-xs text-blue-400">
                        Daily rewards are paid at 00:00 UTC
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Bitcoin className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400">No active stakes</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Create your first stake to start earning up to 30% APR
                  </p>
                </div>
              )}
            </Card>
          </TabsContent>
        </Tabs>

        {/* Info Card */}
        <Card className="mt-4 p-4 bg-[#242424] border-gray-800">
          <h3 className="text-[#f7931a] font-medium mb-3 flex items-center gap-2">
            <Hash className="w-4 h-4" />
            APR Rates by Lock Period
          </h3>
          <div className="space-y-2 text-xs">
            {TIME_PERIODS.map((period) => {
              const Icon = period.icon;
              return (
                <div key={period.months} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="w-3 h-3 text-gray-400" />
                    <span className="text-gray-400">{period.label}</span>
                  </div>
                  <Badge className={`${period.color} text-white text-xs`}>
                    {period.apr}% APR
                  </Badge>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
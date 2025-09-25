import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Bitcoin, Clock, Lock, TrendingUp, Hash, DollarSign, Calendar, CheckCircle, Zap, Trophy, Gem, Crown, Cpu } from "lucide-react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "@/lib/utils";

// Custom Slider with Timer Icon Handle
const TimerSlider = ({ value, onValueChange, min, max, step, className }: any) => (
  <SliderPrimitive.Root
    className={cn("relative flex w-full touch-none select-none items-center", className)}
    value={value}
    onValueChange={onValueChange}
    min={min}
    max={max}
    step={step}
  >
    <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-gray-700">
      <SliderPrimitive.Range className="absolute h-full bg-gradient-to-r from-yellow-500 to-yellow-600" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-yellow-500 bg-black shadow-lg ring-offset-background transition-all hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50">
      <Clock className="h-4 w-4 text-yellow-500" />
    </SliderPrimitive.Thumb>
  </SliderPrimitive.Root>
);

// Custom Slider with BTC Icon Handle
const BtcSlider = ({ value, onValueChange, min, max, step, className }: any) => (
  <SliderPrimitive.Root
    className={cn("relative flex w-full touch-none select-none items-center", className)}
    value={value}
    onValueChange={onValueChange}
    min={min}
    max={max}
    step={step}
  >
    <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-gray-700">
      <SliderPrimitive.Range className="absolute h-full bg-gradient-to-r from-[#f7931a] to-[#ffb347]" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f7931a] shadow-lg ring-offset-background transition-all hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50">
      <span className="text-black font-bold text-lg">₿</span>
    </SliderPrimitive.Thumb>
  </SliderPrimitive.Root>
);

// Custom Slider with Hashrate Icon Handle
const HashSlider = ({ value, onValueChange, min, max, step, className, disabled }: any) => (
  <SliderPrimitive.Root
    className={cn("relative flex w-full touch-none select-none items-center", className)}
    value={value}
    onValueChange={onValueChange}
    min={min}
    max={max}
    step={step}
    disabled={disabled}
  >
    <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-gray-700">
      <SliderPrimitive.Range className="absolute h-full bg-gradient-to-r from-green-500 to-green-600" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-green-500 bg-black shadow-lg ring-offset-background transition-all hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50">
      <Cpu className="h-4 w-4 text-green-500" />
    </SliderPrimitive.Thumb>
  </SliderPrimitive.Root>
);

// Function to calculate APR based on lock time (months)
const calculateAPR = (months: number): number => {
  // Linear interpolation: 2% at 1 month to 20% at 24 months (2 years)
  const minMonths = 1;
  const maxMonths = 24;
  const minAPR = 2;
  const maxAPR = 20;
  
  const clampedMonths = Math.max(minMonths, Math.min(maxMonths, months));
  const apr = minAPR + ((clampedMonths - minMonths) * (maxAPR - minAPR)) / (maxMonths - minMonths);
  return Math.round(apr * 10) / 10; // Round to 1 decimal place
};

// Function to format months into readable duration
const formatDuration = (months: number): string => {
  if (months < 12) {
    return `${months} Month${months !== 1 ? 's' : ''}`;
  } else if (months % 12 === 0) {
    const years = months / 12;
    return `${years} Year${years !== 1 ? 's' : ''}`;
  } else {
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    return `${years} Year${years !== 1 ? 's' : ''} ${remainingMonths} Month${remainingMonths !== 1 ? 's' : ''}`;
  }
};

export default function BtcStakingEnhanced() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  
  const [btcSliderValue, setBtcSliderValue] = useState([0]);
  const [hashrateSliderValue, setHashrateSliderValue] = useState([0]);
  const [lockMonths, setLockMonths] = useState([12]); // Default to 1 year (12 months)
  const [isInitialized, setIsInitialized] = useState(false);

  // Fetch BTC prices and hashrate info with real-time updates
  const { data: priceData } = useQuery<{
    btcPrice: string;
    hashratePrice: string;
    requiredHashratePerBTC: string;
    timestamp: string;
  }>({
    queryKey: ['/api/btc/prices'],
    refetchInterval: 10000, // Refresh every 10 seconds
    refetchIntervalInBackground: true,
  });

  // Fetch user's BTC balance with real-time updates
  const { data: balanceData } = useQuery<{
    btcBalance: string;
  }>({
    queryKey: ['/api/btc/balance'],
    enabled: !!user,
    refetchInterval: 3000, // Refresh every 3 seconds
    refetchIntervalInBackground: true,
  });

  // Fetch user's active stakes with real-time updates
  const { data: stakesData } = useQuery<{
    stakes: any[];
    currentBtcPrice: string;
    totalStaked: string;
    totalDailyRewards: string;
  }>({
    queryKey: ['/api/btc/stakes'],
    enabled: !!user,
    refetchInterval: 5000, // Refresh every 5 seconds
    refetchIntervalInBackground: true,
  });

  // Create stake mutation
  const stakeMutation = useMutation({
    mutationFn: async (data: { btcAmount: string; months: number; apr: number }) => {
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
        description: `Your BTC is now locked for ${formatDuration(months)} earning ${apr}% APR`,
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
  
  // Calculate maximum BTC that can be staked based on available hashrate
  const maxBtcBasedOnHashrate = btcPrice > 0 ? userHashPower / btcPrice : 0;
  const maxBtcAllowed = Math.min(btcBalance, maxBtcBasedOnHashrate);
  
  // Automatically initialize sliders to 100% of available resources
  useEffect(() => {
    if (!isInitialized && maxBtcAllowed > 0 && btcPrice > 0) {
      // Set to 100% of what's possible based on both limits
      setBtcSliderValue([maxBtcAllowed]);
      // Set hashrate to match the BTC amount
      setHashrateSliderValue([maxBtcAllowed * btcPrice]);
      setIsInitialized(true);
    }
  }, [btcBalance, userHashPower, btcPrice, maxBtcAllowed, isInitialized]);
  
  const btcAmount = btcSliderValue[0];
  const hashrateAmount = hashrateSliderValue[0];
  const months = lockMonths[0];
  const apr = calculateAPR(months);
  
  // Calculate returns based on lock time
  const dailyReward = (btcAmount * apr / 100 / 365);
  const totalReturn = (btcAmount * apr / 100 * (months / 12));
  const totalWithPrincipal = btcAmount + totalReturn;
  const dollarValue = btcAmount * btcPrice;
  const dollarReturn = totalReturn * btcPrice;

  // Update hashrate slider when BTC slider changes
  // Automatically sync hashrate with BTC amount
  useEffect(() => {
    if (btcPrice > 0) {
      const requiredHashrate = btcAmount * btcPrice;
      setHashrateSliderValue([requiredHashrate]);
    }
  }, [btcAmount, btcPrice]);

  const handleStake = () => {
    stakeMutation.mutate({
      btcAmount: btcAmount.toString(),
      months: months,
      apr: apr,
    });
  };

  return (
    <div className="mobile-page bg-gradient-to-b from-gray-900 to-black">
      {/* Simple Header */}
      <div className="mobile-header bg-gray-900 border-b border-[#f7931a]/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Button
              onClick={() => setLocation('/wallet')}
              variant="ghost"
              size="sm"
              className="p-0 mr-3 hover:bg-[#f7931a]/10"
              data-testid="button-back"
            >
              <ArrowLeft className="w-5 h-5 text-[#f7931a]" />
            </Button>
            <div className="flex items-center gap-2">
              <span className="text-2xl">₿</span>
              <h1 className="text-lg font-semibold">
                <span className="text-white">Bitcoin Staking</span>
              </h1>
            </div>
          </div>
          <Badge className="bg-[#f7931a] text-black font-semibold px-3 py-1">
            {apr}% APR
          </Badge>
        </div>
      </div>

      {/* Content */}
      <div className="mobile-content">
        {/* Clean Stats Display */}
        <Card className="p-4 bg-gray-900 border border-gray-800 mb-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-400 mb-1">BTC Price</p>
              <div className="flex items-center gap-1">
                <p className="text-xl font-bold text-white">
                  ${priceData?.btcPrice ? Number(priceData.btcPrice).toLocaleString() : '0'}
                </p>
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400 mb-1">Your Balance</p>
              <p className="text-xl font-bold text-[#f7931a]">
                {btcBalance.toFixed(8)} ₿
              </p>
              <p className="text-xs text-gray-500">
                ≈ ${(btcBalance * btcPrice).toLocaleString()}
              </p>
            </div>
          </div>
        </Card>

        <Tabs defaultValue="stake" className="mt-4">
          <TabsList className="grid w-full grid-cols-2 bg-gray-900 border border-gray-800">
            <TabsTrigger 
              value="stake" 
              className="data-[state=active]:bg-[#f7931a] data-[state=active]:text-black data-[state=active]:font-semibold"
            >
              Create Stake
            </TabsTrigger>
            <TabsTrigger 
              value="active" 
              className="data-[state=active]:bg-[#f7931a] data-[state=active]:text-black data-[state=active]:font-semibold"
            >
              Active Stakes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="stake" className="mt-4">
            <Card className="p-4 bg-gray-900 border border-gray-800">
              {/* Lock Time Slider */}
              <div className="mb-6">
                <div className="flex justify-between items-center mb-3">
                  <Label className="text-white font-medium">Lock Duration</Label>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-white">{formatDuration(months)}</p>
                    <p className="text-xs text-green-400">APR: {apr}%</p>
                  </div>
                </div>
                <TimerSlider
                  value={lockMonths}
                  onValueChange={setLockMonths}
                  min={1}
                  max={24}
                  step={1}
                  className="mb-2"
                  data-testid="slider-lock-time"
                />
                <div className="flex justify-between text-xs text-gray-400">
                  <span>1 Month</span>
                  <span>2 Years</span>
                </div>
              </div>

              <Separator className="mb-6 bg-gray-700" />

              {/* BTC Amount Slider */}
              <div className="mb-6">
                <div className="flex justify-between items-center mb-3">
                  <Label className="text-white font-medium">BTC Amount</Label>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-[#f7931a]">
                      {btcAmount.toFixed(8)} BTC
                    </p>
                    <p className="text-xs text-gray-400">
                      ≈ ${(btcAmount * btcPrice).toLocaleString()}
                    </p>
                  </div>
                </div>
                <BtcSlider
                  value={btcSliderValue}
                  onValueChange={(value: number[]) => {
                    // Ensure value doesn't exceed max allowed
                    const safeValue = value.map((v: number) => Math.min(v, maxBtcAllowed));
                    setBtcSliderValue(safeValue);
                  }}
                  min={0}
                  max={maxBtcAllowed > 0 ? maxBtcAllowed : 0.001}
                  step={maxBtcAllowed > 0 ? maxBtcAllowed / 100 : 0.001}
                  className="mb-2"
                  data-testid="slider-btc-amount"
                />
                <div className="flex justify-between text-xs text-gray-400">
                  <span>0 BTC</span>
                  <span>
                    {maxBtcAllowed > 0 ? (
                      <>
                        {maxBtcAllowed.toFixed(8)} BTC (100% Max)
                        {maxBtcBasedOnHashrate < btcBalance ? 
                          <span className="text-yellow-500"> - Hashrate limited</span> : 
                          <span className="text-blue-500"> - Balance limited</span>
                        }
                      </>
                    ) : '0 BTC'}
                  </span>
                </div>
              </div>

              {/* Hashrate Amount Slider */}
              <div className="mb-6">
                <div className="flex justify-between items-center mb-3">
                  <Label className="text-white font-medium">Hashrate Required</Label>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-green-400">
                      {hashrateAmount.toFixed(0)} GH/s
                    </p>
                    <p className="text-xs text-gray-400">
                      {userHashPower >= hashrateAmount ? '✓ Ready' : `Need ${(hashrateAmount - userHashPower).toFixed(0)} more`}
                    </p>
                  </div>
                </div>
                <HashSlider
                  value={hashrateSliderValue}
                  onValueChange={setHashrateSliderValue}
                  min={0}
                  max={userHashPower > 0 ? userHashPower : btcPrice * 10}
                  step={userHashPower > 0 ? userHashPower / 100 : 100}
                  className="mb-2"
                  disabled={true}
                  data-testid="slider-hashrate-amount"
                />
                <div className="flex justify-between text-xs text-gray-400">
                  <span>0 GH/s</span>
                  <span>
                    {userHashPower > 0 ? 
                      `${userHashPower.toLocaleString()} GH/s (100% Available)` : 
                      `${(btcPrice * 10).toLocaleString()} GH/s`
                    }
                  </span>
                </div>
              </div>

              <Separator className="mb-6 bg-gray-700" />

              {/* Returns Calculator */}
              <div className="bg-black rounded-lg p-4 mb-6 border border-gray-800">
                <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-green-400" />
                  Projected Returns
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-400">Daily USDT Rewards</span>
                    <span className="text-sm font-medium text-white">
                      ${(dailyReward * btcPrice).toFixed(2)} USDT
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-400">Total USDT Return</span>
                    <span className="text-sm font-medium text-green-400">
                      +${(totalReturn * btcPrice).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} USDT
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-400">Total After {formatDuration(months)}</span>
                    <span className="text-sm font-bold text-[#f7931a]">
                      ${(totalWithPrincipal * btcPrice).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} USDT
                    </span>
                  </div>
                  <Separator className="bg-gray-700 my-2" />
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-400">Staked BTC Value</span>
                    <span className="text-sm font-medium text-white">
                      {btcAmount.toFixed(8)} BTC
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-400">Current BTC Price</span>
                    <span className="text-sm font-medium text-gray-400">
                      ${btcPrice.toLocaleString()} USD
                    </span>
                  </div>
                </div>
              </div>

              {/* Requirements Check */}
              <div className="bg-gray-800 rounded-lg p-3 mb-6">
                <p className="text-sm font-medium text-white mb-2">Requirements Check:</p>
                <ul className="text-xs text-gray-400 space-y-1">
                  <li className="flex items-center gap-1">
                    <CheckCircle className={`w-3 h-3 ${btcBalance >= btcAmount ? 'text-green-400' : 'text-gray-600'}`} />
                    BTC: Using {btcBalance > 0 ? ((btcAmount / btcBalance) * 100).toFixed(0) : '0'}% of {btcBalance.toFixed(8)} BTC
                  </li>
                  <li className="flex items-center gap-1">
                    <CheckCircle className={`w-3 h-3 ${userHashPower >= hashrateAmount ? 'text-green-400' : 'text-gray-600'}`} />
                    Hashrate: {userHashPower > 0 ? ((hashrateAmount / userHashPower) * 100).toFixed(0) : '0'}% of {userHashPower.toLocaleString()} GH/s (Mining continues!)
                  </li>
                  <li className="flex items-center gap-1">
                    <CheckCircle className="w-3 h-3 text-yellow-400" />
                    Lock Period: {formatDuration(months)} @ {apr}% APR
                  </li>
                  <li className="flex items-center gap-1 text-green-400">
                    <CheckCircle className="w-3 h-3 text-green-400" />
                    Auto-set to maximum: {maxBtcAllowed.toFixed(8)} BTC
                  </li>
                  <li className="flex items-center gap-1 text-blue-400">
                    <CheckCircle className="w-3 h-3 text-blue-400" />
                    Your mining continues while hashrate is staked!
                  </li>
                </ul>
              </div>

              <Button
                onClick={handleStake}
                className="w-full bg-[#f7931a] hover:bg-[#f7931a]/90 text-black font-semibold py-3 rounded-lg"
                disabled={
                  btcBalance < btcAmount ||
                  userHashPower < hashrateAmount ||
                  stakeMutation.isPending ||
                  btcAmount <= 0
                }
                data-testid="button-create-stake"
              >
                {stakeMutation.isPending ? (
                  "Creating Stake..."
                ) : btcAmount <= 0 ? (
                  "Select BTC Amount to Stake"
                ) : btcBalance < btcAmount ? (
                  `Insufficient BTC (Need ${(btcAmount - btcBalance).toFixed(8)} more)`
                ) : userHashPower < hashrateAmount ? (
                  `Insufficient Hashrate (Need ${(hashrateAmount - userHashPower).toFixed(0)} more GH/s)`
                ) : (
                  <>
                    <Lock className="w-4 h-4 mr-2" />
                    Lock {btcAmount.toFixed(8)} BTC for {formatDuration(months)} @ {apr}% APR
                  </>
                )}
              </Button>
            </Card>
          </TabsContent>

          <TabsContent value="active" className="mt-4">
            <Card className="p-4 bg-gray-900 border border-gray-800">
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
                    const stakeMonths = stake.lockMonths || 12; // Default to 12 if not set
                    
                    return (
                      <div key={stake.id} className="bg-[#1a1a1a] rounded-lg p-4 border border-gray-700">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex items-center gap-2">
                            <Clock className="w-5 h-5 text-white" />
                            <div>
                              <p className="text-white font-medium">
                                {parseFloat(stake.btcAmount).toFixed(8)} BTC
                              </p>
                              <p className="text-xs text-gray-400">
                                Staked {new Date(stake.stakedAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <Badge className="bg-[#f7931a] text-black">
                            {stake.aprRate}% APR
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <p className="text-gray-400">Daily USDT Reward</p>
                            <p className="text-[#f7931a] font-medium">
                              ${(parseFloat(stake.dailyReward) * parseFloat(stakesData.currentBtcPrice)).toFixed(2)} USDT
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-400">Total USDT Earned</p>
                            <p className="text-green-400 font-medium">
                              ${(parseFloat(stake.totalRewardsPaid) * parseFloat(stakesData.currentBtcPrice)).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} USDT
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
                              className="bg-[#f7931a] h-2 rounded-full transition-all"
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
                        Daily USDT rewards are paid at 00:00 UTC based on current Bitcoin price
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Bitcoin className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400">No active stakes</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Create your first stake to start earning up to 20% APR
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
            Dynamic APR Formula
          </h3>
          <div className="space-y-3 text-xs">
            <div className="bg-[#1a1a1a] rounded p-3">
              <p className="text-gray-400 mb-2">APR increases with lock duration:</p>
              <div className="space-y-1 text-gray-500">
                <div className="flex justify-between">
                  <span>1 Month</span>
                  <span className="text-green-400">2% APR</span>
                </div>
                <div className="flex justify-between">
                  <span>3 Months</span>
                  <span className="text-green-400">5% APR</span>
                </div>
                <div className="flex justify-between">
                  <span>6 Months</span>
                  <span className="text-green-400">8% APR</span>
                </div>
                <div className="flex justify-between">
                  <span>1 Year</span>
                  <span className="text-green-400">11% APR</span>
                </div>
                <div className="flex justify-between">
                  <span>18 Months</span>
                  <span className="text-green-400">15.5% APR</span>
                </div>
                <div className="flex justify-between">
                  <span>2 Years</span>
                  <span className="text-green-400">20% APR</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-3 h-3 text-[#f7931a]" />
              <p className="text-gray-400">
                Longer lock periods earn higher rewards
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
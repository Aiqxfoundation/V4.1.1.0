import { useState, useEffect, useMemo, useRef, memo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Link, useLocation } from "wouter";
import { useMiningWebSocket } from "@/hooks/useWebSocket";
import { BlockParticipationList } from "@/components/BlockParticipationList";
import { Badge } from "@/components/ui/badge";
import { Wifi, WifiOff } from "lucide-react";
import { 
  Activity, 
  BarChart3, 
  Cpu, 
  Hash, 
  Zap, 
  TrendingUp, 
  Target, 
  Timer, 
  Award, 
  Coins, 
  Percent,
  Settings,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  Gauge,
  Rocket,
  Loader2,
  AlertTriangle,
  Clock,
  Bitcoin
} from "lucide-react";

interface SupplyMetrics {
  totalMined: string;
  circulating: string;
  maxSupply: string;
  percentageMined: string;
  currentBlockReward: string;
  totalBlocks: number;
  totalHashrate?: number;
  halvingProgress: {
    current: number;
    nextHalving: number;
    blocksRemaining: number;
  };
}

interface MiningInfo {
  blockHeight: number;
  [key: string]: any; // Allow other properties that might exist
}

export default function MiningDashboard() {
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [blockTimer, setBlockTimer] = useState(3600); // 1 hour in seconds
  const [lastClaimed, setLastClaimed] = useState<Date | null>(null);
  const currentHashRef = useRef<string>('');
  const [hashDisplay, setHashDisplay] = useState<string>(''); // For visual display only  
  const [miningActive, setMiningActive] = useState(true);
  const [blockProgress, setBlockProgress] = useState(0);
  const [activeTab, setActiveTab] = useState('mining'); // Tab state
  const [coins, setCoins] = useState<number[]>([]);
  const [isBlockAnimating, setIsBlockAnimating] = useState(false);
  
  // WebSocket connection
  const { isConnected, lastBlock, userStats: wsUserStats } = useMiningWebSocket(user?.id);
  
  // Enhanced Analytics State
  const [showAdvancedAnalytics, setShowAdvancedAnalytics] = useState(false);
  const [selectedMiningMode, setSelectedMiningMode] = useState<keyof typeof miningModes>('balanced');
  const [performanceMetrics, setPerformanceMetrics] = useState({
    avgHashrate: 0,
    efficiency: 100,
    uptimePercentage: 98.5,
    blocksFound: 0,
    totalRewards: 0
  });

  // Mining Modes Configuration
  const miningModes = {
    eco: {
      name: 'Eco Mode',
      icon: Timer,
      efficiency: 85,
      color: 'text-chart-2',
      description: 'Power-efficient mining with lower consumption',
      hashMultiplier: 0.85,
      powerCost: 0.005
    },
    balanced: {
      name: 'Balanced',
      icon: Gauge,
      efficiency: 100,
      color: 'text-chart-1',
      description: 'Optimal balance between performance and efficiency',
      hashMultiplier: 1.0,
      powerCost: 0.008
    },
    performance: {
      name: 'High Performance',
      icon: Rocket,
      efficiency: 115,
      color: 'text-chart-4',
      description: 'Maximum hashrate for competitive mining',
      hashMultiplier: 1.15,
      powerCost: 0.012
    }
  };
  
  // Fetch supply metrics
  const { data: supplyMetrics } = useQuery<SupplyMetrics>({
    queryKey: ['/api/supply-metrics'],
    staleTime: Infinity,
    gcTime: Infinity // Cache permanently
  });
  
  // Fetch mining status (includes personal block height, suspension status, etc.)
  const { data: miningStatus } = useQuery({
    queryKey: ['/api/mining/status'],
    enabled: !!user,
    refetchInterval: 10000 // Refetch every 10 seconds
  });
  
  // Fetch mining info
  const { data: miningInfo } = useQuery<MiningInfo>({
    queryKey: ['/api/mining/info'],
    refetchInterval: 30000 // Refetch every 30 seconds
  });
  
  // Fetch unclaimed blocks for participation list
  const { data: unclaimedBlocks } = useQuery({
    queryKey: ['/api/mining/unclaimed-blocks'],
    enabled: !!user,
    refetchInterval: 30000
  });

  // Claim all rewards mutation
  const claimAllMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/mining/claim-all");
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to claim rewards");
      }
      return res.json();
    },
    onSuccess: (data: { 
      claimedAmount: string; 
      newBalance: string; 
      message: string;
      blocksClaimedCount: number;
      wasMiningSuspended: boolean;
    }) => {
      toast({ 
        title: "🎉 Rewards Claimed!", 
        description: data.message,
        className: "bg-gradient-to-r from-yellow-500 to-orange-500 text-white border-0"
      });
      
      // Refresh user data and mining status
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/mining/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/balances"] });
      
      // Reset mining animation if it was suspended
      if (data.wasMiningSuspended) {
        setMiningActive(true);
      }
      
      // Update last claimed time
      setLastClaimed(new Date());
    },
    onError: (error: Error) => {
      toast({
        title: "Claim Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Calculate hours since last claim
  const getHoursSinceLastClaim = () => {
    if (!lastClaimed) return 0;
    const diff = Date.now() - lastClaimed.getTime();
    return Math.floor(diff / (1000 * 60 * 60));
  };

  const hoursSinceLastClaim = getHoursSinceLastClaim();
  const unclaimedBlocksCount = user?.unclaimedBlocksCount || 0;
  const miningSuspended = user?.miningSuspended || false;
  
  // Enhanced Mining Calculations with Modes
  // hashPower is stored in MH/s units (1 hashPower = 1 MH/s = 1000 KH/s)
  const baseHashrate = parseFloat(user?.hashPower || '0');
  const currentMode = miningModes[selectedMiningMode];
  const myHashrate = baseHashrate * currentMode.hashMultiplier;
  // Use actual total network hashrate from server (in MH/s), fall back to user's hashrate if no data
  const globalHashrate = supplyMetrics?.totalHashrate && supplyMetrics.totalHashrate > 0
    ? supplyMetrics.totalHashrate
    : Math.max(myHashrate, 0.001);

  // Memoized reward calculations for performance
  const rewardCalculations = useMemo(() => {
    const currentBlockReward = 3200; // B2B per block
    const myMiningShare = myHashrate > 0 ? Math.round((myHashrate / globalHashrate) * 100 * 1000000) / 1000000 : 0; // Percentage with 6 decimals precision
    const myEstimatedReward = Math.round((myHashrate / globalHashrate) * currentBlockReward * 100000000) / 100000000; // B2B per block with 8 decimals
    const dailyEstimatedRewards = Math.round(myEstimatedReward * 144 * 10000) / 10000; // 144 blocks per day with 4 decimals
    const unclaimedB2B = parseFloat(user?.unclaimedBalance || '0');
    const isNewUser = myHashrate === 0;
    
    return {
      currentBlockReward,
      myMiningShare,
      myEstimatedReward,
      dailyEstimatedRewards,
      unclaimedB2B,
      isNewUser
    };
  }, [myHashrate, globalHashrate, user?.unclaimedBalance]);
  
  // Destructure for backward compatibility
  const { currentBlockReward, myMiningShare, myEstimatedReward, dailyEstimatedRewards, unclaimedB2B, isNewUser } = rewardCalculations;

  // Memoized advanced analytics calculations
  const analyticsCalculations = useMemo(() => {
    const effectiveHashrate = myHashrate * (currentMode.efficiency / 100);
    const powerCostPerHour = myHashrate * currentMode.powerCost;
    const dailyPowerCost = powerCostPerHour * 24;
    const profitabilityRatio = dailyEstimatedRewards > 0 ? dailyPowerCost / dailyEstimatedRewards : 0;
    
    return {
      effectiveHashrate,
      powerCostPerHour,
      dailyPowerCost,
      profitabilityRatio
    };
  }, [myHashrate, currentMode.efficiency, currentMode.powerCost, dailyEstimatedRewards]);
  
  // Destructure for backward compatibility
  const { effectiveHashrate, powerCostPerHour, dailyPowerCost, profitabilityRatio } = analyticsCalculations;

  // Update performance metrics
  useEffect(() => {
    setPerformanceMetrics(prev => ({
      ...prev,
      avgHashrate: myHashrate,
      efficiency: currentMode.efficiency,
      blocksFound: coins.length,
      totalRewards: parseFloat(user?.b2bBalance || '0')
    }));
  }, [myHashrate, currentMode.efficiency, coins.length, user?.b2bBalance]);
  
  // Update when new block arrives from WebSocket
  useEffect(() => {
    if (lastBlock) {
      console.log('New block received via WebSocket:', lastBlock);
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/mining/status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/mining/unclaimed-blocks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      queryClient.invalidateQueries({ queryKey: ['/api/supply-metrics'] });
      
      // Trigger block animation
      setIsBlockAnimating(true);
      setTimeout(() => setIsBlockAnimating(false), 500);
    }
  }, [lastBlock]);
  
  // Control mining animation based on WebSocket suspension status
  useEffect(() => {
    if (wsUserStats) {
      const isMining = !wsUserStats.miningSuspended && wsUserStats.miningActive;
      setMiningActive(isMining);
    }
  }, [wsUserStats]);

  // Calculate time until next block (next hour)
  const calculateTimeUntilNextBlock = () => {
    const now = new Date();
    const nextHour = new Date(now);
    nextHour.setUTCHours(now.getUTCHours() + 1, 0, 0, 0);
    return Math.floor((nextHour.getTime() - now.getTime()) / 1000);
  };
  
  // Block timer countdown and coin generation
  useEffect(() => {
    const timer = setInterval(() => {
      const timeLeft = calculateTimeUntilNextBlock();
      setBlockTimer(timeLeft);
      
      // Generate a coin when we reach the new hour  
      if (timeLeft >= 3599 && myHashrate > 0) { // Just passed the hour
        setCoins(c => [...c, Date.now()]);
        setIsBlockAnimating(true);
        setTimeout(() => setIsBlockAnimating(false), 100); // Faster animation
      }
    }, 1000);
    
    // Initial set
    setBlockTimer(calculateTimeUntilNextBlock());

    return () => clearInterval(timer);
  }, [myHashrate]);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}h ${mins.toString().padStart(2, '0')}m ${secs.toString().padStart(2, '0')}s`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    setBlockProgress(((3600 - blockTimer) / 3600) * 100);
  }, [blockTimer]);
  
  // Format unclaimed blocks for BlockParticipationList
  const formattedBlocks = useMemo(() => {
    if (!unclaimedBlocks || !Array.isArray(unclaimedBlocks)) return [];
    return unclaimedBlocks.map((block: any) => ({
      blockHeight: block.blockHeight || block.block_height,
      totalReward: block.totalReward || block.total_reward || '50',
      userShare: block.userReward || block.user_reward || '0',
      timestamp: block.timestamp || block.created_at || new Date().toISOString(),
      claimed: block.claimed || false,
      globalHashrate: block.globalHashrate,
      participantsCount: block.participantsCount
    }));
  }, [unclaimedBlocks]);
  
  // Memoized hashrate display function
  // Input is in MH/s (1 hashPower = 1 MH/s = 1000 KH/s)
  const getHashrateDisplay = useMemo(() => (hashrate: number) => {
    if (hashrate >= 1000000) return `${(hashrate / 1000000).toFixed(3)} TH/s`;
    if (hashrate >= 1000) return `${(hashrate / 1000).toFixed(3)} GH/s`;
    if (hashrate >= 1) return `${hashrate.toFixed(2)} MH/s`;
    return `${(hashrate * 1000).toFixed(2)} KH/s`;
  }, []);

  // Generate random hash (throttled for performance)
  useEffect(() => {
    const generateHash = () => {
      const chars = '0123456789abcdef';
      let hash = '0000';
      for (let i = 0; i < 60; i++) {
        hash += chars[Math.floor(Math.random() * chars.length)];
      }
      currentHashRef.current = hash;
      setHashDisplay(hash); // Update display
    };
    // Already throttled to 300ms for better performance
    const interval = setInterval(generateHash, 300);
    return () => clearInterval(interval);
  }, []);

  const claimRewardsMutation = claimAllMutation; // Use the new claim-all mutation defined above

  const handleClaim = () => {
    // Trigger the claim all rewards mutation
    claimAllMutation.mutate();
  };
  
  const handleClaimCoins = () => {
    if (coins.length > 0) {
      const coinCount = coins.length;
      setCoins([]);
      toast({ 
        title: `Visual Mining Complete!`, 
        description: `Cleared ${coinCount} block animations. Check your actual rewards in Account page.` 
      });
    }
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <i className="fas fa-spinner fa-spin text-4xl text-primary mb-4"></i>
          <p className="text-sm text-muted-foreground">Loading Mining Factory...</p>
        </div>
      </div>
    );
  }

  // Redirect to auth if not logged in
  if (!user) {
    setLocation('/auth');
    return null;
  }

  return (
    <div className="min-h-screen pb-24 relative overflow-hidden">
      {/* Enhanced Background Effects */}
      <div className="fixed inset-0 bitcoin-grid opacity-20"></div>
      
      {/* Advanced Hash Rain Effect */}
      <div className="fixed inset-0 pointer-events-none">
        {[...Array(12)].map((_, i) => (
          <div
            key={i}
            className="absolute font-mono text-xs text-primary/30"
            style={{
              left: `${8.33 * i}%`,
              animation: `hash-stream ${15 + i * 2}s linear infinite`, // Slower for performance
              animationDelay: `${i * 0.3}s`
            }}
          >
            {hashDisplay.substring(i * 4, (i * 4) + 8)}
          </div>
        ))}
      </div>

      {/* Professional Header */}
      <div className="relative z-10">
        <div className="mobile-header">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-br from-primary to-chart-4 rounded-xl flex items-center justify-center">
                <Cpu className="w-6 h-6 text-black" />
              </div>
              <div>
                <h1 className="text-xl font-heading font-bold text-gradient">Mining Operations</h1>
                <p className="text-xs text-muted-foreground font-mono">Professional Dashboard</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-2">
                <div className="hashrate-indicator">
                  <Hash className="w-4 h-4 mr-1" />
                  <span className="font-mono font-bold">{getHashrateDisplay(myHashrate)}</span>
                </div>
                <Badge 
                  variant="outline" 
                  className={`flex items-center space-x-1 ${isConnected ? 'bg-chart-2/10 border-chart-2 text-chart-2' : 'bg-destructive/10 border-destructive text-destructive'}`}
                  data-testid="ws-connection-status"
                >
                  {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                  <span className="text-xs font-mono">{isConnected ? 'Live' : 'Offline'}</span>
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAdvancedAnalytics(!showAdvancedAnalytics)}
                className="text-chart-3 hover:text-chart-3/80"
                data-testid="button-toggle-analytics"
              >
                {showAdvancedAnalytics ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>
          </div>
          
          {/* Mining Mode Selector */}
          <div className="mt-4 p-3 bg-card/50 border border-border rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-heading font-semibold text-foreground">Active Mode</span>
              <div className="flex items-center text-xs text-muted-foreground font-mono">
                <Target className="w-3 h-3 mr-1" />
                {currentMode.efficiency}% Efficiency
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(miningModes).map(([key, mode]) => {
                const IconComponent = mode.icon;
                return (
                  <button
                    key={key}
                    onClick={() => setSelectedMiningMode(key as keyof typeof miningModes)}
                    className={`p-2 rounded-lg border transition-all ${
                      selectedMiningMode === key
                        ? 'border-primary bg-primary/10 shadow-lg'
                        : 'border-border bg-muted/50 hover:border-primary/50'
                    }`}
                    data-testid={`button-mode-${key}`}
                  >
                    <div className="text-center">
                      <IconComponent className={`w-4 h-4 mx-auto mb-1 ${mode.color}`} />
                      <div className="text-xs font-medium">{mode.name}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="mobile-content space-y-6">{/* Content continues here */}
        
        {/* Enhanced 3D Mining Visualization */}
        <div className="analytics-card relative">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-heading font-bold text-gradient">Mining Engine</h3>
            <div className={`flex items-center px-3 py-1 rounded-full text-xs font-mono ${
              (wsUserStats ? !wsUserStats.miningSuspended && wsUserStats.miningActive : miningActive) && !isNewUser ? 'bg-chart-2/20 text-chart-2' : 'bg-destructive/20 text-destructive'
            }`}>
              <div className={`w-2 h-2 rounded-full mr-2 ${
                (wsUserStats ? !wsUserStats.miningSuspended && wsUserStats.miningActive : miningActive) && !isNewUser ? 'bg-chart-2' : 'bg-destructive'
              } animate-pulse`}></div>
              {isNewUser ? 'INACTIVE' : (wsUserStats ? !wsUserStats.miningSuspended && wsUserStats.miningActive : miningActive) ? 'OPERATIONAL' : 'MAINTENANCE'}
            </div>
          </div>
          
          <div className="relative h-48 flex flex-col items-center justify-center">
            <div className="relative">
              {/* Enhanced 3D Block */}
              <div className={`mining-block-3d ${isBlockAnimating ? 'block-pulse' : ''}`}>
                <div className="block-face block-front"></div>
                <div className="block-face block-back"></div>
                <div className="block-face block-left"></div>
                <div className="block-face block-right"></div>
                <div className="block-face block-top"></div>
                <div className="block-face block-bottom"></div>
              </div>
              
              {/* Block Progress */}
              {!isNewUser && (
                <div className="absolute -bottom-12 left-1/2 transform -translate-x-1/2 text-center">
                  <div className="text-xs text-muted-foreground mb-2">Block #871235 Progress</div>
                  <div className="text-lg font-mono font-bold text-primary mb-2">{formatTime(blockTimer)}</div>
                  <div className="w-40 h-2 bg-background rounded-full overflow-hidden border border-border">
                    <div 
                      className="h-full bg-gradient-to-r from-primary to-chart-4 transition-all duration-1000 relative"
                      style={{ width: `${blockProgress}%` }}
                    >
                      <div className="absolute inset-0 bg-white/30 animate-pulse"></div>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Est. Reward: {myEstimatedReward.toFixed(8)} B2B
                  </div>
                </div>
              )}
            </div>
          </div>
          
        </div>
        
        {/* Enhanced Coins Collection Area */}
        <div className="analytics-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-heading font-bold text-gradient">Block Rewards</h3>
            <div className="flex items-center text-xs text-muted-foreground font-mono">
              <Coins className="w-3 h-3 mr-1" />
              {coins.length} Visual Blocks
            </div>
          </div>
          
          <div className="relative min-h-[120px]">
            {coins.length > 0 ? (
              <div>
                <div className="flex flex-wrap gap-2 mb-4 justify-center p-3 bg-gradient-to-br from-chart-4/10 to-chart-2/10 rounded-lg border border-border">
                  {coins.slice(-15).map((coin, index) => (
                    <div 
                      key={coin} 
                      className="coin-3d"
                      style={{ animationDelay: `${index * 0.1}s` }}
                    >
                      <Coins className="w-6 h-6 text-chart-4" />
                    </div>
                  ))}
                  {coins.length > 15 && (
                    <div className="flex items-center justify-center w-8 h-8 text-xs font-mono font-bold text-muted-foreground bg-muted rounded-full">
                      +{coins.length - 15}
                    </div>
                  )}
                </div>
                
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="data-card p-3">
                    <div className="text-xs text-muted-foreground mb-1">Visual Blocks</div>
                    <div className="text-lg font-mono font-bold text-chart-4">{coins.length}</div>
                  </div>
                  <div className="data-card p-3">
                    <div className="text-xs text-muted-foreground mb-1">Est. Value</div>
                    <div className="text-lg font-mono font-bold text-chart-2">
                      {(coins.length * myEstimatedReward).toFixed(6)} B2B
                    </div>
                  </div>
                </div>
                
                <Button
                  className="w-full btn-primary"
                  onClick={handleClaimCoins}
                  data-testid="button-claim-coins"
                >
                  <Award className="w-4 h-4 mr-2" />
                  CLEAR ANIMATIONS ({coins.length} blocks)
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-32 text-center">
                <div className="w-12 h-12 bg-muted/50 rounded-full flex items-center justify-center mb-3">
                  <Coins className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">
                  {isNewUser ? 'Activate mining to see visual feedback' : 'Visual block animations will appear here'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Visual feedback only - Real rewards tracked in Account page
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Enhanced Personal Mining Stats */}
        <div className="analytics-card">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-chart-1 to-chart-1/80 rounded-lg flex items-center justify-center">
                <Hash className="w-5 h-5 text-black" />
              </div>
              <div>
                <h2 className="text-lg font-heading font-bold text-gradient">Mining Performance</h2>
                <p className="text-xs text-muted-foreground font-mono">Personal Analytics</p>
              </div>
            </div>
            <div className="performance-indicator">
              <TrendingUp className="w-4 h-4 mr-1" />
              {performanceMetrics.efficiency}%
            </div>
          </div>

          {/* Enhanced Hashrate Display */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="data-card">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Effective Hashrate</span>
                <Hash className="w-4 h-4 text-chart-1" />
              </div>
              <div className="text-2xl font-mono font-bold text-gradient">
                {getHashrateDisplay(effectiveHashrate)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Base: {getHashrateDisplay(baseHashrate)} • Mode: {currentMode.name}
              </div>
            </div>

            <div className="data-card">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Network Share</span>
                <Percent className="w-4 h-4 text-chart-3" />
              </div>
              <div className="text-2xl font-mono font-bold text-chart-3">
                {myMiningShare.toFixed(6)}%
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                of {getHashrateDisplay(globalHashrate)} global
              </div>
            </div>
          </div>

          {/* Performance Metrics Grid */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="data-card p-3">
              <div className="text-xs text-muted-foreground mb-1">Efficiency</div>
              <div className="text-lg font-mono font-bold text-chart-2">
                {performanceMetrics.efficiency}%
              </div>
            </div>
            <div className="data-card p-3">
              <div className="text-xs text-muted-foreground mb-1">Uptime</div>
              <div className="text-lg font-mono font-bold text-chart-4">
                {performanceMetrics.uptimePercentage}%
              </div>
            </div>
            <div className="data-card p-3">
              <div className="text-xs text-muted-foreground mb-1">Blocks</div>
              <div className="text-lg font-mono font-bold text-chart-1">
                {performanceMetrics.blocksFound}
              </div>
            </div>
          </div>

          {/* Current Block Progress */}
          {!isNewUser && (
            <div className="hashrate-efficiency mb-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-heading font-semibold text-foreground">Current Block Mining</span>
                <span className="text-xs font-mono text-primary">{formatTime(blockTimer)}</span>
              </div>
              <div className="h-4 bg-background rounded-full overflow-hidden border border-border">
                <div 
                  className="h-full bg-gradient-to-r from-primary to-chart-4 transition-all duration-1000 relative"
                  style={{ width: `${blockProgress}%` }}
                >
                  <div className="absolute inset-0 bg-white/30 animate-pulse"></div>
                </div>
              </div>
              <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                <span>Block #871235</span>
                <span>Estimated: {myEstimatedReward.toFixed(8)} B2B</span>
              </div>
            </div>
          )}

          {/* Earnings Summary */}
          <div className="grid grid-cols-3 gap-2">
            <div className="data-card p-3">
              <div className="text-xs text-muted-foreground mb-1">Per Block</div>
              <div className="text-lg font-mono font-bold text-chart-3">{myEstimatedReward.toFixed(6)}</div>
              <div className="text-xs text-muted-foreground">B2B</div>
            </div>
            <div className="data-card p-3">
              <div className="text-xs text-muted-foreground mb-1">Daily Est.</div>
              <div className="text-lg font-mono font-bold text-chart-4">{dailyEstimatedRewards.toFixed(4)}</div>
              <div className="text-xs text-muted-foreground">B2B</div>
            </div>
            <div className="data-card p-3">
              <div className="text-xs text-muted-foreground mb-1">Power Cost</div>
              <div className="text-lg font-mono font-bold text-chart-5">${dailyPowerCost.toFixed(4)}</div>
              <div className="text-xs text-muted-foreground">Daily</div>
            </div>
          </div>
        </div>

        {/* Advanced Analytics (when toggled) */}
        {showAdvancedAnalytics && (
          <div className="analytics-card border-chart-3/30">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-heading font-bold text-chart-3 flex items-center">
                <BarChart3 className="w-5 h-5 mr-2" />
                Advanced Analytics
              </h3>
              <div className="roi-indicator">
                <Gauge className="w-4 h-4 mr-1" />
                DETAILED
              </div>
            </div>
            
            <div className="space-y-4">
              {/* Profitability Analysis */}
              <div className="hashrate-efficiency">
                <h4 className="text-md font-heading font-semibold text-foreground mb-3">Profitability Analysis</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="data-card p-4">
                    <div className="text-xs text-muted-foreground mb-2">Net Daily Profit</div>
                    <div className="text-xl font-mono font-bold text-chart-2">
                      ${(dailyEstimatedRewards - dailyPowerCost).toFixed(4)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Profit Margin: {(((dailyEstimatedRewards - dailyPowerCost) / dailyEstimatedRewards) * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div className="data-card p-4">
                    <div className="text-xs text-muted-foreground mb-2">ROI Timeline</div>
                    <div className="text-xl font-mono font-bold text-chart-4">
                      {dailyEstimatedRewards > dailyPowerCost ? Math.ceil(baseHashrate / (dailyEstimatedRewards - dailyPowerCost)) : '∞'} days
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Break-even estimate
                    </div>
                  </div>
                </div>
              </div>

              {/* Performance Optimization */}
              <div className="hashrate-efficiency">
                <h4 className="text-md font-heading font-semibold text-foreground mb-3">Mode Comparison</h4>
                <div className="space-y-2">
                  {Object.entries(miningModes).map(([key, mode]) => {
                    const modeHashrate = baseHashrate * mode.hashMultiplier;
                    const modePowerCost = modeHashrate * mode.powerCost * 24;
                    const modeRewards = (modeHashrate / globalHashrate) * currentBlockReward * 24;
                    const modeProfit = modeRewards - modePowerCost;
                    
                    return (
                      <div 
                        key={key} 
                        className={`p-3 rounded-lg border transition-all ${
                          selectedMiningMode === key 
                            ? 'border-primary bg-primary/10' 
                            : 'border-border bg-muted/30'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <mode.icon className={`w-4 h-4 ${mode.color}`} />
                            <span className="text-sm font-medium">{mode.name}</span>
                          </div>
                          <div className="flex items-center space-x-4 text-xs font-mono">
                            <span className="text-chart-1">{getHashrateDisplay(modeHashrate)}</span>
                            <span className="text-chart-2">${modeProfit.toFixed(4)}/day</span>
                            <span className={modeProfit > 0 ? 'text-chart-2' : 'text-destructive'}>
                              {modeProfit > 0 ? '+' : ''}{((modeProfit / modeRewards) * 100).toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Network Analytics */}
              <div className="hashrate-efficiency">
                <h4 className="text-md font-heading font-semibold text-foreground mb-3">Network Status</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="data-card p-3">
                    <div className="text-xs text-muted-foreground mb-1">Global Hashrate</div>
                    <div className="text-sm font-mono font-bold text-chart-1">
                      {getHashrateDisplay(globalHashrate)}
                    </div>
                  </div>
                  <div className="data-card p-3">
                    <div className="text-xs text-muted-foreground mb-1">Network Growth</div>
                    <div className="text-sm font-mono font-bold text-chart-4">
                      +{((networkGrowthRate - 1) * 100).toFixed(2)}%/hr
                    </div>
                  </div>
                  <div className="data-card p-3">
                    <div className="text-xs text-muted-foreground mb-1">Difficulty</div>
                    <div className="text-sm font-mono font-bold text-chart-3">
                      {Math.round(globalHashrate / 1000)}K
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Mining Status Card - New Section */}
        <Card className="bg-gradient-to-br from-gray-900 to-gray-800 border-orange-500/20">
          <CardContent className="p-6">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-gray-500 uppercase">TOTAL SUPPLY</p>
                <p className="text-lg font-bold text-orange-400">21.0M</p>
                <p className="text-xs text-gray-600">B2B</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">CIRCULATING SUPPLY</p>
                <p className="text-lg font-bold text-orange-400">
                  {supplyMetrics ? (parseFloat(supplyMetrics.circulating) / 1000000).toFixed(1) + 'M' : '0'}
                </p>
                <p className="text-xs text-gray-600">B2B</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">BLOCK HEIGHT</p>
                <p className="text-lg font-bold text-orange-400">#{supplyMetrics?.totalBlocks || miningInfo?.blockHeight || 17}</p>
                <p className="text-xs text-gray-600">CURRENT</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Mining Metrics Grid - New Section */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="bg-gray-900/50 border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <Zap className="h-8 w-8 text-yellow-500" />
                <div className="text-right">
                  <p className="text-xs text-gray-500">Network Share</p>
                  <p className="text-xl font-bold">{myMiningShare.toFixed(4)}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gray-900/50 border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <Activity className="h-8 w-8 text-green-500" />
                <div className="text-right">
                  <p className="text-xs text-gray-500">Your Hashrate</p>
                  <p className="text-xl font-bold">{getHashrateDisplay(myHashrate)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gray-900/50 border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <Clock className="h-8 w-8 text-blue-500" />
                <div className="text-right">
                  <p className="text-xs text-gray-500">Est. Daily</p>
                  <p className="text-xl font-bold">{dailyEstimatedRewards.toFixed(4)}</p>
                  <p className="text-xs text-gray-600">B2B</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Supply Metrics Card - Original */}
        {supplyMetrics && (
          <Card className="mining-block relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary/20 to-transparent rounded-full blur-2xl"></div>
            
            <h3 className="text-lg font-heading font-bold mb-4">Network Supply Metrics</h3>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="data-card">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground uppercase">Total Mined</span>
                  <i className="fas fa-coins text-primary"></i>
                </div>
                <div className="text-xl font-mono font-bold text-gradient">
                  {parseFloat(supplyMetrics.totalMined).toLocaleString()}
                </div>
                <div className="text-xs text-accent mt-1">
                  {supplyMetrics.percentageMined}% of max supply
                </div>
              </div>
              
              <div className="data-card">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground uppercase">Circulating</span>
                  <i className="fas fa-sync text-chart-3"></i>
                </div>
                <div className="text-xl font-mono font-bold text-chart-3">
                  {parseFloat(supplyMetrics.circulating).toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  In wallets
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center p-2 rounded-lg bg-background">
                <div className="text-lg font-mono font-bold text-chart-2">{supplyMetrics.currentBlockReward}</div>
                <div className="text-xs text-muted-foreground">Block Reward</div>
              </div>
              <div className="text-center p-2 rounded-lg bg-background">
                <div className="text-lg font-mono font-bold text-chart-4">{supplyMetrics.totalBlocks}</div>
                <div className="text-xs text-muted-foreground">Total Blocks</div>
              </div>
              <div className="text-center p-2 rounded-lg bg-background">
                <div className="text-lg font-mono font-bold text-warning">{supplyMetrics.halvingProgress.blocksRemaining}</div>
                <div className="text-xs text-muted-foreground">Until Halving</div>
              </div>
            </div>
            
            <div className="mt-3 p-2 bg-primary/5 rounded-lg border border-primary/20">
              <div className="text-xs text-muted-foreground text-center">
                <span className="font-semibold">Max Supply:</span>
                <span className="font-mono ml-2 text-primary">21,000,000 B2B</span>
              </div>
            </div>
          </Card>
        )}
        
        {/* Rewards Section */}
        <Card className="mining-block relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-accent/20 to-transparent rounded-full blur-2xl"></div>
          
          <h3 className="text-lg font-heading font-bold mb-4">Mining Rewards</h3>
          
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-xs text-muted-foreground uppercase mb-1">Unclaimed Rewards</div>
                <div className="text-3xl font-mono font-bold text-gradient-green">
                  {unclaimedB2B.toFixed(8)} B2B
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Daily Est.: {dailyEstimatedRewards.toFixed(4)} B2B
                </div>
              </div>
              <div className="text-right">
                {miningSuspended ? (
                  <>
                    <div className="text-xs text-orange-500 mb-1">⏸️ Mining Paused</div>
                    <div className="text-xs text-muted-foreground">Claim to resume</div>
                  </>
                ) : (
                  <>
                    <div className="text-xs text-muted-foreground mb-1">Unclaimed Blocks</div>
                    <div className="text-xs text-warning">{unclaimedBlocksCount}/24</div>
                  </>
                )}
              </div>
            </div>

            <Button 
              onClick={handleClaim}
              disabled={unclaimedB2B === 0 || claimRewardsMutation.isPending}
              className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-black font-bold py-3 text-lg"
              data-testid="button-receive-b2b"
            >
              {claimRewardsMutation.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>Receive {unclaimedB2B.toFixed(8)} B2B</>
              )}
            </Button>

            {!miningSuspended && unclaimedBlocksCount >= 20 && (
              <Alert className="mt-3 bg-red-900/20 border-red-500/50">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Mining will suspend after 24 unclaimed blocks. 
                  You have {24 - unclaimedBlocksCount} blocks remaining.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </Card>
        
        {/* Block Participation List */}
        <Card className="mining-block">
          <h3 className="text-lg font-heading font-bold mb-4">Block Participation History</h3>
          <BlockParticipationList 
            blocks={formattedBlocks}
            totalMined={user?.b2bBalance || '0'}
            participatedCount={formattedBlocks.length}
            isLoading={!unclaimedBlocks}
          />
        </Card>
        
        {/* My Miners Tab */}
        {activeTab === 'miners' && (
          <Card className="mining-block">
            <h3 className="text-lg font-heading font-bold mb-4">My Mining Equipment</h3>
            <div className="space-y-4">
              <div className="data-card">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-heading">Total Hashrate</span>
                  <i className="fas fa-microchip text-primary"></i>
                </div>
                <div className="text-2xl font-mono font-bold text-gradient">
                  {getHashrateDisplay(myHashrate)}
                </div>
                <div className="text-xs text-muted-foreground mt-2">
                  Network Share: {myMiningShare.toFixed(6)}%
                </div>
              </div>
              
              
            </div>
          </Card>
        )}
        
        {/* My Wallet Tab */}
        {activeTab === 'wallet' && (
          <div className="space-y-4">
            <Card className="mining-block">
              <div className="text-center mb-4">
                <i className="fas fa-user-circle text-4xl text-primary mb-2"></i>
                <h3 className="text-lg font-heading font-bold">{user?.username}</h3>
                <p className="text-xs text-muted-foreground">Wallet Overview</p>
              </div>
              
              <div className="grid grid-cols-2 gap-3 mb-4">
                <Button 
                  className="btn-secondary h-auto py-3"
                  onClick={() => setLocation('/deposit')}
                  data-testid="button-deposit"
                >
                  <div className="text-center">
                    <i className="fas fa-download text-xl mb-1"></i>
                    <div className="text-sm font-heading">Deposit</div>
                  </div>
                </Button>
                <Button 
                  className="btn-secondary h-auto py-3"
                  onClick={() => setLocation('/withdraw')}
                  data-testid="button-withdraw"
                >
                  <div className="text-center">
                    <i className="fas fa-upload text-xl mb-1"></i>
                    <div className="text-sm font-heading">Withdraw</div>
                  </div>
                </Button>
              </div>
              
              <div className="space-y-3">
                <div className="data-card">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground uppercase">B2B Balance</span>
                    <i className="fas fa-coins text-primary"></i>
                  </div>
                  <div className="text-2xl font-mono font-bold text-gradient">
                    {parseFloat(user?.b2bBalance || '0').toFixed(4)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Mined tokens</div>
                </div>
                
                <div className="data-card">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground uppercase">USDT Balance</span>
                    <i className="fas fa-dollar-sign text-accent"></i>
                  </div>
                  <div className="text-2xl font-mono font-bold text-accent">
                    ${parseFloat(user?.usdtBalance || '0').toFixed(2)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Ready for investment</div>
                </div>
                
                <div className="data-card">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground uppercase">Unclaimed Rewards</span>
                    <i className="fas fa-gift text-chart-3"></i>
                  </div>
                  <div className="text-2xl font-mono font-bold text-chart-3">
                    {unclaimedB2B.toFixed(4)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Pending B2B</div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-2 mt-4">
                <button 
                  onClick={() => setLocation('/transfer')}
                  className="data-card text-center py-2 transition-all hover:scale-105"
                  data-testid="button-transfer"
                >
                  <i className="fas fa-exchange-alt text-lg text-chart-4 mb-1"></i>
                  <div className="text-xs font-heading uppercase">Transfer</div>
                </button>
                <button 
                  onClick={() => setLocation('/referral')}
                  className="data-card text-center py-2 transition-all hover:scale-105"
                  data-testid="button-referral"
                >
                  <i className="fas fa-users text-lg text-chart-3 mb-1"></i>
                  <div className="text-xs font-heading uppercase">Referral</div>
                </button>
              </div>
            </Card>
          </div>
        )}

        {/* Mining History */}
        <Card className="mining-block">
          <h3 className="text-lg font-heading font-bold mb-4">Recent Blocks</h3>
          <div className="space-y-2">
            {[
              { block: 871234, reward: 0.0234, time: '2 mins ago', status: 'confirmed' },
              { block: 871233, reward: 0.0229, time: '12 mins ago', status: 'confirmed' },
              { block: 871232, reward: 0.0241, time: '22 mins ago', status: 'confirmed' },
              { block: 871231, reward: 0.0218, time: '32 mins ago', status: 'confirmed' },
              { block: 871230, reward: 0.0236, time: '42 mins ago', status: 'confirmed' },
            ].map((item) => (
              <div key={item.block} className="flex items-center justify-between p-3 rounded-lg bg-background/50">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center">
                    <i className="fas fa-cube text-primary text-xs"></i>
                  </div>
                  <div>
                    <div className="text-sm font-mono">Block #{item.block}</div>
                    <div className="text-xs text-muted-foreground">{item.time}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-mono font-bold text-accent">+{item.reward} B2B</div>
                  <div className="text-xs text-green-500">
                    <i className="fas fa-check-circle mr-1"></i>
                    {item.status}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Performance Stats */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="data-card">
            <div className="text-xs text-muted-foreground mb-1">24h Earnings</div>
            <div className="text-xl font-mono font-bold text-gradient-green">0.5432 B2B</div>
            <div className="text-xs text-accent">+12.5%</div>
          </Card>
          <Card className="data-card">
            <div className="text-xs text-muted-foreground mb-1">Total Mined</div>
            <div className="text-xl font-mono font-bold text-gradient">127.384 B2B</div>
            <div className="text-xs text-muted-foreground">All time</div>
          </Card>
        </div>
      </div>
    </div>
  );
}
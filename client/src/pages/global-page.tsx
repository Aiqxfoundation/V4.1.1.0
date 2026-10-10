import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  Activity, 
  Users, 
  Zap, 
  Globe, 
  Coins, 
  Database, 
  Loader2, 
  RefreshCw, 
  Clock, 
  TrendingUp, 
  ShieldCheck, 
  Layers, 
  Calendar,
  Sparkles,
  ArrowRight
} from "lucide-react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";

interface GlobalStats {
  totalHashrate: number;
  totalHashPower: number;
  hashRateDisplay: string;
  blockHeight: number;
  totalBlockHeight: number;
  activeMiners: number;
  activeMinerCount: number;
  userCount: number;
  totalDeposits: string;
  blockReward: number;
  currentBlockReward: number;
  totalCirculation: number;
  circulatingSupply: number;
  circulation: number;
  maxSupply: number;
  supplyProgress: number;
  nextHalving: number;
  blocksUntilHalving: number;
  halvingProgress: number;
  networkDifficulty: string;
  blockTime: string;
  blocksToday: number;
  lastBlockTime: string;
}

export default function GlobalPage() {
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);

  // Fetch real global statistics with fast 5s refresh for real-time live updates
  const { data: stats, isLoading, refetch, dataUpdatedAt } = useQuery<GlobalStats>({
    queryKey: ["/api/global-stats"],
    refetchInterval: 5000, // Real-time poll every 5 seconds
    staleTime: 3000
  });

  const handleRefresh = async () => {
    setIsManualRefreshing(true);
    await refetch();
    setTimeout(() => setIsManualRefreshing(false), 600);
  };

  if (isLoading && !stats) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
        <Loader2 className="w-8 h-8 text-[#f7931a] animate-spin mb-3" />
        <p className="text-xs text-zinc-400 font-mono">Connecting to B2B Global Ledger...</p>
      </div>
    );
  }

  const maxSupply = stats?.maxSupply || 21000000;
  const circulating = stats?.circulatingSupply || stats?.totalCirculation || 0;
  const supplyPct = stats?.supplyProgress || Math.min(100, (circulating / maxSupply) * 100);
  const halvingPct = stats?.halvingProgress || 0;
  const formattedHashrate = stats?.hashRateDisplay || `${(stats?.totalHashrate || 0).toFixed(2)} GH/s`;
  const blocksRemaining = stats?.blocksUntilHalving || 0;
  const nextHalvingBlock = stats?.nextHalving || 21000;
  const blockReward = stats?.blockReward || stats?.currentBlockReward || 3200;

  return (
    <div className="min-h-screen bg-black text-white pb-24">
      {/* Background Grid Pattern */}
      <div className="fixed inset-0 opacity-5 pointer-events-none">
        <div 
          className="absolute inset-0" 
          style={{ 
            backgroundImage: `repeating-linear-gradient(0deg, #f7931a 0, #f7931a 1px, transparent 1px, transparent 40px),
                             repeating-linear-gradient(90deg, #f7931a 0, #f7931a 1px, transparent 1px, transparent 40px)`,
            backgroundSize: '40px 40px'
          }}
        />
      </div>

      <div className="relative z-10 p-4 max-w-4xl mx-auto space-y-4">
        {/* Top Header */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#f7931a]/10 border border-[#f7931a]/30 flex items-center justify-center text-[#f7931a]">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white flex items-center gap-2">
                Global Network Statistics
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[9px] font-mono flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  LIVE 5S
                </Badge>
              </h1>
              <p className="text-[11px] text-zinc-400">Real-time ledger metrics and emission telemetry</p>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            className="border-zinc-800 hover:bg-zinc-900 text-zinc-300 h-8 text-xs flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#f7931a] ${isManualRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Live Network Status Banner */}
        <Card className="bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 border-zinc-800 p-4 rounded-xl shadow-lg">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-semibold text-zinc-200">Mainnet Consensus Active</span>
            </div>
            <div className="text-[11px] font-mono text-zinc-400">
              Synced: {new Date(dataUpdatedAt).toLocaleTimeString()} • Target Block: 10m
            </div>
          </div>
        </Card>

        {/* Primary 4-Card Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Card 1: Network Hashrate */}
          <Card className="bg-zinc-950 border-zinc-800/80 p-4 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <Zap className="w-5 h-5 text-[#f7931a]" />
              <Activity className="w-4 h-4 text-[#f7931a] animate-pulse" />
            </div>
            <div className="text-xs text-zinc-400">Total Hashrate</div>
            <div className="text-xl font-bold text-[#f7931a] font-mono mt-0.5 truncate">
              {formattedHashrate}
            </div>
            <div className="text-[10px] text-zinc-500 mt-1">PoW Compute Power</div>
          </Card>

          {/* Card 2: Active Miners */}
          <Card className="bg-zinc-950 border-zinc-800/80 p-4 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <Users className="w-5 h-5 text-emerald-400" />
              <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[9px] py-0 px-1">
                ONLINE
              </Badge>
            </div>
            <div className="text-xs text-zinc-400">Active Miners</div>
            <div className="text-xl font-bold text-white font-mono mt-0.5">
              {(stats?.activeMiners ?? stats?.activeMinerCount ?? 0).toLocaleString()}
            </div>
            <div className="text-[10px] text-zinc-500 mt-1">
              {(stats?.userCount || 0).toLocaleString()} total accounts
            </div>
          </Card>

          {/* Card 3: Block Height */}
          <Card className="bg-zinc-950 border-zinc-800/80 p-4 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <Layers className="w-5 h-5 text-blue-400" />
              <span className="text-[10px] font-mono text-zinc-400">
                {stats?.blocksToday || 1}/144 today
              </span>
            </div>
            <div className="text-xs text-zinc-400">Current Block Height</div>
            <div className="text-xl font-bold text-white font-mono mt-0.5">
              #{stats?.blockHeight || 1}
            </div>
            <div className="text-[10px] text-zinc-500 mt-1">O(1) Global Index</div>
          </Card>

          {/* Card 4: Block Reward */}
          <Card className="bg-zinc-950 border-zinc-800/80 p-4 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <Coins className="w-5 h-5 text-yellow-400" />
              <Badge className="bg-yellow-500/10 text-yellow-400 border-yellow-500/20 text-[9px] py-0 px-1 font-mono">
                B2B/BLK
              </Badge>
            </div>
            <div className="text-xs text-zinc-400">Block Reward</div>
            <div className="text-xl font-bold text-white font-mono mt-0.5">
              {blockReward.toLocaleString()}
            </div>
            <div className="text-[10px] text-zinc-500 mt-1">Subsidized Emission</div>
          </Card>
        </div>

        {/* Circulating Supply & Halving Progress Matrix */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Supply Progress Card */}
          <Card className="bg-zinc-950 border-zinc-800 p-4 rounded-xl">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <Coins className="w-4 h-4 text-[#f7931a]" />
                <span className="text-xs font-semibold text-zinc-200 uppercase tracking-wider">Circulating Supply</span>
              </div>
              <span className="text-xs font-mono font-bold text-[#f7931a]">
                {supplyPct.toFixed(4)}%
              </span>
            </div>

            <div className="space-y-2">
              <Progress value={Math.max(1, supplyPct)} className="h-2.5 bg-zinc-900" />
              <div className="flex justify-between text-xs font-mono text-zinc-400 pt-1">
                <span>{circulating.toLocaleString()} B2B</span>
                <span>{maxSupply.toLocaleString()} B2B MAX</span>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-zinc-800/80 grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <p className="text-zinc-500">Target for Listing:</p>
                <p className="font-semibold text-white">25.00% (5,250,000 B2B)</p>
              </div>
              <div>
                <p className="text-zinc-500">Remaining to Mine:</p>
                <p className="font-semibold text-zinc-300">{(maxSupply - circulating).toLocaleString()} B2B</p>
              </div>
            </div>
          </Card>

          {/* Halving Countdown Card */}
          <Card className="bg-zinc-950 border-zinc-800 p-4 rounded-xl">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-semibold text-zinc-200 uppercase tracking-wider">Halving Countdown</span>
              </div>
              <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-[10px] font-mono">
                CYCLE 1
              </Badge>
            </div>

            <div className="space-y-2">
              <Progress value={Math.max(1, halvingPct)} className="h-2.5 bg-zinc-900" />
              <div className="flex justify-between text-xs font-mono text-zinc-400 pt-1">
                <span>Current: #{stats?.blockHeight || 1}</span>
                <span>Milestone: #{nextHalvingBlock}</span>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-zinc-800/80 grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <p className="text-zinc-500">Blocks Remaining:</p>
                <p className="font-semibold text-[#f7931a] font-mono">{blocksRemaining.toLocaleString()} blocks</p>
              </div>
              <div>
                <p className="text-zinc-500">Next Reward Cut:</p>
                <p className="font-semibold text-white">50% Reward Reduction</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Technical Difficulty & Liquidity Card */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Card className="bg-zinc-950 border-zinc-800 p-3.5 rounded-xl">
            <div className="text-[11px] text-zinc-400 mb-1">Network Difficulty</div>
            <div className="text-lg font-bold text-white font-mono">{stats?.networkDifficulty || '47.50'}</div>
            <p className="text-[10px] text-zinc-500 mt-0.5">Auto-adjusts every 2016 blocks</p>
          </Card>

          <Card className="bg-zinc-950 border-zinc-800 p-3.5 rounded-xl">
            <div className="text-[11px] text-zinc-400 mb-1">Verified Platform Deposits</div>
            <div className="text-lg font-bold text-emerald-400 font-mono">
              ${parseFloat(stats?.totalDeposits || '0').toLocaleString()} USDT
            </div>
            <p className="text-[10px] text-zinc-500 mt-0.5">TRC20 & BSC multi-chain reserves</p>
          </Card>

          <Card className="bg-zinc-950 border-zinc-800 p-3.5 rounded-xl">
            <div className="text-[11px] text-zinc-400 mb-1">Block Target & Interval</div>
            <div className="text-lg font-bold text-white font-mono">{stats?.blockTime || '10m'}</div>
            <p className="text-[10px] text-zinc-500 mt-0.5">144 blocks emitted per 24 hours</p>
          </Card>
        </div>

        {/* Halving Timeline Roadmap */}
        <Card className="bg-zinc-950 border-zinc-800 p-5 rounded-2xl shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#f7931a]" />
                Halving Schedule & Scarcity Roadmap
              </h2>
              <p className="text-[11px] text-zinc-400 mt-0.5">Structured deflationary block emission milestones</p>
            </div>
            <Link href="/whitepaper">
              <span className="text-xs text-[#f7931a] hover:underline flex items-center gap-1 cursor-pointer font-medium">
                Full Whitepaper <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </Link>
          </div>

          <div className="space-y-3">
            {/* Genesis */}
            <div className="p-3 bg-zinc-900/60 border border-zinc-800/80 rounded-xl flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#f7931a] animate-pulse"></span>
                  <span className="font-semibold text-xs text-white">Genesis Emission</span>
                  <Badge className="bg-[#f7931a]/20 text-[#f7931a] text-[9px] py-0 px-1 font-mono">
                    CURRENT
                  </Badge>
                </div>
                <p className="text-[11px] text-zinc-400 mt-0.5">Q4 2025 - Q1 2026 • 100% Initial Rate</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-[#f7931a] font-mono">3,200 B2B</p>
                <p className="text-[10px] text-zinc-500">per block</p>
              </div>
            </div>

            {/* Halving 1 */}
            <div className="p-3 bg-zinc-900/30 border border-zinc-800/50 rounded-xl flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-zinc-600"></span>
                  <span className="font-semibold text-xs text-zinc-300">First Halving Event</span>
                </div>
                <p className="text-[11px] text-zinc-500 mt-0.5">Q2 2026 • 50% Reward Reduction</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-zinc-300 font-mono">1,600 B2B</p>
                <p className="text-[10px] text-zinc-500">per block</p>
              </div>
            </div>

            {/* Halving 2 */}
            <div className="p-3 bg-zinc-900/30 border border-zinc-800/50 rounded-xl flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-zinc-600"></span>
                  <span className="font-semibold text-xs text-zinc-300">Second Halving Event</span>
                </div>
                <p className="text-[11px] text-zinc-500 mt-0.5">Q4 2026 • 25% Rate Remaining</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-zinc-300 font-mono">800 B2B</p>
                <p className="text-[10px] text-zinc-500">per block</p>
              </div>
            </div>

            {/* Halving 3 */}
            <div className="p-3 bg-zinc-900/30 border border-zinc-800/50 rounded-xl flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-zinc-600"></span>
                  <span className="font-semibold text-xs text-zinc-300">Third Halving Event</span>
                </div>
                <p className="text-[11px] text-zinc-500 mt-0.5">Q2 2027 • 12.5% Rate Remaining</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-zinc-300 font-mono">400 B2B</p>
                <p className="text-[10px] text-zinc-500">per block</p>
              </div>
            </div>

            {/* Subsequent */}
            <div className="p-3 bg-zinc-900/20 border border-zinc-800/30 rounded-xl flex items-center justify-between opacity-75">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-zinc-700"></span>
                  <span className="font-semibold text-xs text-zinc-400">Subsequent Tail Halvings</span>
                </div>
                <p className="text-[11px] text-zinc-600 mt-0.5">2028 - 2032+ • Long-Term Asymptotic Cap</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-zinc-400 font-mono">&lt; 200 B2B</p>
                <p className="text-[10px] text-zinc-600">until 21M reached</p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
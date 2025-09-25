import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Activity, Users, Cpu, Zap, TrendingUp, Globe, Hash, Crown } from "lucide-react";
import { motion } from "framer-motion";
import { formatHashPower } from "@/lib/utils";

interface MinerData {
  id: string;
  username: string;
  hashPower: number;
  totalEarned: string | number;
  gbtcBalance: string | number;
  usdtBalance: string | number;
  lastActiveBlock: number | null;
  referredBy?: string;
  referralCount?: number;
}

interface MinersData {
  miners?: MinerData[];
  totalHashPower?: number;
  totalActiveMiners?: number;
  currentBlock?: number;
}

export default function AllMiners() {
  // Fetch all miners data from the platform
  const { data: minersData, isLoading } = useQuery<MinersData>({
    queryKey: ["/api/all-miners"],
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 15000 // Consider data fresh for 15 seconds
  });

  const activeMiners = minersData?.miners || [];
  const totalGlobalHashPower = minersData?.totalHashPower || 0;
  const totalActiveMiners = minersData?.totalActiveMiners || 0;


  const formatBalance = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return num.toFixed(2);
  };

  const getActivityStatus = (lastActiveBlock: number | null) => {
    if (!lastActiveBlock) return { status: "New", color: "text-blue-500", badge: "bg-blue-500/20 border-blue-500/30" };
    
    const currentBlock = minersData?.currentBlock || 0;
    const blocksSinceActive = currentBlock - lastActiveBlock;
    
    if (blocksSinceActive <= 10) return { status: "Active", color: "text-emerald-500", badge: "bg-emerald-500/20 border-emerald-500/30" };
    if (blocksSinceActive <= 50) return { status: "Recent", color: "text-yellow-500", badge: "bg-yellow-500/20 border-yellow-500/30" };
    return { status: "Idle", color: "text-gray-500", badge: "bg-gray-500/20 border-gray-500/30" };
  };

  return (
    <div className="mobile-page bg-gradient-to-b from-black via-gray-900 to-black">
      {/* Bitcoin Pattern Background */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-0 left-0 w-full h-full" 
          style={{ 
            backgroundImage: `repeating-linear-gradient(45deg, #f7931a 0, #f7931a 1px, transparent 1px, transparent 15px),
                             repeating-linear-gradient(-45deg, #f7931a 0, #f7931a 1px, transparent 1px, transparent 15px)`,
            backgroundSize: '20px 20px'
          }}>
        </div>
      </div>

      {/* Header */}
      <div className="mobile-header bg-gradient-to-r from-black via-gray-900 to-black backdrop-blur-lg border-b border-[#f7931a]/30 relative z-10">
        <div className="flex items-center space-x-2">
          <Globe className="w-6 h-6 text-[#f7931a] animate-pulse" />
          <div>
            <h1 className="text-xl font-display font-black text-transparent bg-clip-text bg-gradient-to-r from-[#f7931a] to-[#ff9416]">
              GLOBAL MINERS
            </h1>
            <p className="text-xs text-[#f7931a]/60 font-mono">Live Mining Activity</p>
          </div>
        </div>
        <div className="text-right">
          <div className="flex items-center justify-end space-x-1 mb-1">
            <Hash className="w-3 h-3 text-[#f7931a]" />
            <p className="text-xs text-[#f7931a]/60 font-mono">NETWORK POWER</p>
          </div>
          <p className="text-lg font-display font-bold text-[#f7931a]">
            {formatHashPower(totalGlobalHashPower)}
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="mobile-content relative z-10">
        {/* Global Stats */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="p-4 bg-gradient-to-br from-[#f7931a]/20 to-black border-[#f7931a]/30">
              <div className="flex items-center justify-between mb-2">
                <Users className="w-5 h-5 text-[#f7931a]" />
                <Badge className="text-[10px] bg-[#f7931a]/20 text-[#f7931a] border-[#f7931a]/30">
                  LIVE
                </Badge>
              </div>
              <p className="text-2xl font-display font-black text-[#f7931a]">
                {totalActiveMiners}
              </p>
              <p className="text-xs text-[#f7931a]/60">Active Miners</p>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <Card className="p-4 bg-gradient-to-br from-emerald-500/20 to-black border-emerald-500/30">
              <div className="flex items-center justify-between mb-2">
                <Zap className="w-5 h-5 text-emerald-500" />
                <Badge className="text-[10px] bg-emerald-500/20 text-emerald-500 border-emerald-500/30">
                  TOTAL
                </Badge>
              </div>
              <p className="text-2xl font-display font-black text-emerald-500">
                {formatHashPower(totalGlobalHashPower)}
              </p>
              <p className="text-xs text-emerald-500/60">Network Hash</p>
            </Card>
          </motion.div>
        </div>

        {/* Info Banner */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <Card className="p-3 mb-4 bg-gradient-to-r from-[#f7931a]/10 to-transparent border-[#f7931a]/20">
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-4 h-4 text-[#f7931a]" />
              <p className="text-xs text-[#f7931a]/80 font-mono">
                10% USDT commission + 10% hashrate boost for referrals
              </p>
            </div>
          </Card>
        </motion.div>

        {/* Miners List */}
        <div className="space-y-2">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-mono text-[#f7931a] uppercase tracking-wider">
              Active Miners
            </p>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
              <span className="text-xs text-emerald-500/60">Live</span>
            </div>
          </div>

          {isLoading ? (
            <Card className="p-8 bg-black/50 border-[#f7931a]/20">
              <div className="flex flex-col items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-[#f7931a] mb-2" />
                <p className="text-xs text-[#f7931a]/50">Loading miners...</p>
              </div>
            </Card>
          ) : activeMiners.length > 0 ? (
            <div className="space-y-2">
              {activeMiners.map((miner: MinerData, index: number) => {
                const activity = getActivityStatus(miner.lastActiveBlock);
                const isTopMiner = index < 3;
                
                return (
                  <motion.div
                    key={miner.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: Math.min(index * 0.05, 0.5) }}
                  >
                    <Card className={`p-3 transition-all ${
                      isTopMiner 
                        ? 'bg-gradient-to-r from-[#f7931a]/20 to-black border-[#f7931a]/40 shadow-lg shadow-[#f7931a]/10' 
                        : 'bg-black/50 border-white/10 hover:border-[#f7931a]/30'
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="relative">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                              isTopMiner 
                                ? 'bg-gradient-to-br from-[#f7931a] to-[#ff9416]' 
                                : 'bg-gradient-to-br from-gray-700 to-gray-800'
                            }`}>
                              {isTopMiner ? (
                                <Crown className="w-5 h-5 text-black" />
                              ) : (
                                <Cpu className="w-5 h-5 text-gray-400" />
                              )}
                            </div>
                            {activity.status === "Active" && (
                              <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></div>
                            )}
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <p className="text-sm font-display font-bold text-white">
                                {miner.username}
                              </p>
                              {isTopMiner && (
                                <Badge className="text-[9px] px-1.5 py-0 bg-[#f7931a]/20 text-[#f7931a] border-[#f7931a]/30">
                                  TOP {index + 1}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center space-x-3 mt-1">
                              <p className="text-[10px] text-muted-foreground">
                                ID: {miner.id.slice(0, 8)}...
                              </p>
                              {miner.referredBy && (
                                <p className="text-[10px] text-purple-500/60">
                                  Ref: {miner.referredBy.slice(0, 6)}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge className={`text-[9px] px-2 py-0.5 ${activity.badge} ${activity.color}`}>
                            {activity.status.toUpperCase()}
                          </Badge>
                          <p className="text-sm font-display font-bold text-[#f7931a] mt-1">
                            {formatHashPower(miner.hashPower)}
                          </p>
                          <p className="text-[10px] text-emerald-500/60">
                            {formatBalance(miner.totalEarned)} B2B earned
                          </p>
                        </div>
                      </div>
                      
                      {/* Miner Stats Bar */}
                      <div className="mt-3 pt-3 border-t border-white/5">
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div>
                            <p className="text-[9px] text-muted-foreground mb-0.5">Balance</p>
                            <p className="text-[11px] font-mono font-bold text-white">
                              {formatBalance(miner.gbtcBalance)} B2B
                            </p>
                          </div>
                          <div>
                            <p className="text-[9px] text-muted-foreground mb-0.5">USDT</p>
                            <p className="text-[11px] font-mono font-bold text-green-500">
                              ${formatBalance(miner.usdtBalance)}
                            </p>
                          </div>
                          <div>
                            <p className="text-[9px] text-muted-foreground mb-0.5">Referrals</p>
                            <p className="text-[11px] font-mono font-bold text-purple-500">
                              {miner.referralCount || 0}
                            </p>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <Card className="p-8 bg-black/50 border-[#f7931a]/20">
              <div className="text-center">
                <Globe className="w-10 h-10 text-[#f7931a]/30 mx-auto mb-3" />
                <p className="text-sm text-[#f7931a]/50">No active miners yet</p>
                <p className="text-xs text-[#f7931a]/30 mt-1">
                  Be the first to start mining!
                </p>
              </div>
            </Card>
          )}
        </div>

        {/* Bottom Stats */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.6 }}
        >
          <Card className="p-4 mt-4 bg-black/50 border-[#f7931a]/20">
            <div className="flex items-center space-x-2 mb-3">
              <Activity className="w-4 h-4 text-[#f7931a]" />
              <p className="text-xs font-mono text-[#f7931a] uppercase tracking-wider">
                Network Statistics
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-2 bg-[#f7931a]/5 rounded">
                <p className="text-[10px] text-[#f7931a]/60 mb-1">Avg Hashrate</p>
                <p className="text-sm font-display font-bold text-[#f7931a]">
                  {totalActiveMiners > 0 
                    ? formatHashPower(totalGlobalHashPower / totalActiveMiners)
                    : formatHashPower(0)}
                </p>
              </div>
              <div className="p-2 bg-emerald-500/5 rounded">
                <p className="text-[10px] text-emerald-500/60 mb-1">Block Height</p>
                <p className="text-sm font-display font-bold text-emerald-500">
                  #{minersData?.currentBlock || 0}
                </p>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
import { Card } from "@/components/ui/card";
import { Activity, Users, Zap, Globe, Coins, Database, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";

interface GlobalStats {
  userCount: number;
  totalDeposits: string;
  activeMinerCount: number;
  totalHashPower: number;
  hashRateDisplay: string;
  blockHeight: number;
  blockReward: number;
  circulatingSupply: number;
  maxSupply: number;
  supplyProgress: number;
  blocksToday: number;
  networkDifficulty: string;
  blockTime: string;
  nextHalving: number;
  halvingProgress: number;
}

export default function GlobalPage() {
  // Fetch real global statistics
  const { data: stats, isLoading } = useQuery<GlobalStats>({
    queryKey: ["/api/global-stats"],
    refetchInterval: 60000, // Refresh every minute for updates
    staleTime: 30000 // Consider data fresh for 30 seconds
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#f7931a] animate-spin" />
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-black pb-24">
      {/* Background Pattern */}
      <div className="fixed inset-0 opacity-5">
        <div className="absolute inset-0" 
          style={{ 
            backgroundImage: `repeating-linear-gradient(0deg, #f7931a 0, #f7931a 1px, transparent 1px, transparent 40px),
                             repeating-linear-gradient(90deg, #f7931a 0, #f7931a 1px, transparent 1px, transparent 40px)`,
            backgroundSize: '40px 40px'
          }}>
        </div>
      </div>


      <div className="relative z-10 p-4">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <Globe className="w-6 h-6 text-[#f7931a]" />
                Global Statistics
              </h1>
            </div>
          </div>
        </motion.div>

        {/* Main Stats Grid */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="grid grid-cols-2 gap-3 mb-6"
        >
          <Card className="bg-gray-950 border-gray-800 p-4">
            <div className="flex items-center justify-between mb-2">
              <Zap className="w-5 h-5 text-[#f7931a]" />
              <Activity className="w-4 h-4 text-[#f7931a] animate-pulse" />
            </div>
            <div className="text-sm text-gray-500">Total Hashrate</div>
            <div className="text-xl font-bold text-[#f7931a]">{stats?.hashRateDisplay || '0 GH/s'}</div>
          </Card>

          <Card className="bg-gray-950 border-gray-800 p-4">
            <div className="flex items-center justify-between mb-2">
              <Users className="w-5 h-5 text-[#f7931a]" />
              <span className="text-xs text-[#f7931a]">LIVE</span>
            </div>
            <div className="text-sm text-gray-500">Active Miners</div>
            <div className="text-xl font-bold text-white">{stats?.activeMinerCount || 0}</div>
          </Card>

          <Card className="bg-gray-950 border-gray-800 p-4">
            <div className="flex items-center justify-between mb-2">
              <Database className="w-5 h-5 text-[#f7931a]" />
              <Activity className="w-4 h-4 text-[#f7931a] animate-pulse" />
            </div>
            <div className="text-sm text-gray-500">Block Height</div>
            <div className="text-xl font-bold text-white">#{stats?.blockHeight || 1}</div>
          </Card>

        </motion.div>


      </div>

    </div>
  );
}
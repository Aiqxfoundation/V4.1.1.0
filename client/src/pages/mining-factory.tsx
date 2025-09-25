import { useState, useEffect, useRef, useMemo, useCallback, memo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Cpu, TrendingUp, Clock, Zap, Award, Hash, Activity, Blocks, Binary, Shield, Sparkles, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import { formatHashPower } from "@/lib/utils";
import { BlockParticipationList } from "@/components/BlockParticipationList";

function MiningFactory() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isMining, setIsMining] = useState(false);
  const currentHashRef = useRef("");
  const hashPoolRef = useRef<string[]>([]);
  const [hashDisplay, setHashDisplay] = useState(""); // For visual updates only
  const [nextBlockTime, setNextBlockTime] = useState("00:00");
  const [miningProgress, setMiningProgress] = useState(0);
  const [blockAnimations, setBlockAnimations] = useState<number[]>([]);
  const [showNewBlock, setShowNewBlock] = useState(false);
  const [nonce, setNonce] = useState(0);
  const [isBlockForm, setIsBlockForm] = useState(false);

  // Memoize expensive calculations
  const hashPower = useMemo(() => parseFloat(user?.hashPower || '0'), [user?.hashPower]);
  const b2bBalance = useMemo(() => parseFloat(user?.b2bBalance || '0'), [user?.b2bBalance]);
  
  // Check if account is frozen (real suspension)
  const isAccountSuspended = user?.isFrozen === true || user?.isBanned === true;
  
  // Check if mining is temporarily paused due to 24 unclaimed blocks
  const isMiningPaused = user?.miningSuspended === true && !isAccountSuspended;
  
  // Combined check for any suspension (for backward compatibility)
  const isSuspended = isAccountSuspended || isMiningPaused;
  
  // Derived mining active state - combines local mining state with server-side started flag
  // But respects suspension status - no mining if suspended
  const miningActive = !isSuspended && (isMining || (!!user?.hasStartedMining && hashPower > 0));
  
  // Start mining mutation 
  const startMiningMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/start-mining");
    },
    onSuccess: async () => {
      // Set local mining state to true for immediate UI feedback
      setIsMining(true);
      // Invalidate user cache to get updated hasStartedMining flag and hashPower
      await queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      
      // Show appropriate message based on whether user just got their free hashrate
      const isNewUser = hashPower === 0;
      toast({
        title: "Mining Activated!",
        description: isNewUser 
          ? "You've received 100 KH/s free hashrate to start mining!"
          : `Your ${formatHashPower(hashPower)} hash power is now earning B2B rewards`,
        className: "bg-green-800 text-white",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Mining Error",
        description: error.message || "Failed to start mining",
        variant: "destructive"
      });
    }
  });

  // Memoize event handlers
  const handleStartMining = useCallback(() => {
    // Block if account is suspended
    if (isAccountSuspended) {
      toast({
        title: "Account Suspended",
        description: "Your account has been suspended. Please contact support for assistance.",
        variant: "destructive"
      });
      return;
    }
    
    // Show different message for temporary mining pause due to unclaimed blocks
    if (isMiningPaused) {
      toast({
        title: "Mining Temporarily Paused",
        description: "You have reached the maximum of 24 unclaimed blocks. Please claim your rewards to continue mining.",
        className: "bg-orange-800 text-white"
      });
      return;
    }
    
    // Always allow starting mining for users who haven't started yet
    // They'll receive their free 100 KH/s when starting
    if (!user?.hasStartedMining) {
      startMiningMutation.mutate();
    }
  }, [isSuspended, user?.hasStartedMining, startMiningMutation, toast]);

  const handleStopMining = useCallback(() => {
    setIsMining(false);
    setMiningProgress(0);
    currentHashRef.current = "";
    hashPoolRef.current = [];
    setHashDisplay("");
    toast({
      title: "Mining Stopped",
      description: "Mining operations have been halted",
    });
  }, [toast]);

  // Sync local mining state with server state when user returns
  useEffect(() => {
    // Don't sync if suspended
    if (isSuspended) {
      setIsMining(false);
      return;
    }
    
    if (user?.hasStartedMining && hashPower > 0) {
      setIsMining(true);
    }
  }, [user?.hasStartedMining, hashPower, isSuspended]);
  
  // Immediately stop mining when suspended
  useEffect(() => {
    if (isSuspended) {
      setIsMining(false);
      setMiningProgress(0);
      currentHashRef.current = "";
      hashPoolRef.current = [];
      setHashDisplay("");
      setNonce(0);
      setIsBlockForm(false);
      setShowNewBlock(false);
      setBlockAnimations([]);
    }
  }, [isSuspended]);

  // Fetch global mining stats - optimized caching
  const { data: globalStats } = useQuery<{
    totalHashrate: number;
    blockHeight: number;
    totalBlocksMined: number;
    circulation: number;
    currentBlockReward: number;
    activeMiners: number;
  }>({
    queryKey: ["/api/global-stats"],
    staleTime: 30000, // 30 seconds
    gcTime: 60000, // 1 minute
    refetchOnWindowFocus: false
  });

  // Fetch unclaimed blocks - optimized
  const { data: unclaimedBlocks, isLoading: blocksLoading } = useQuery<Array<{
    id: string;
    blockNumber: number;
    reward: string;
    txHash: string;
    expiresAt: string;
    claimed: boolean;
  }>>({
    queryKey: ["/api/unclaimed-blocks"],
    staleTime: 15000, // 15 seconds
    gcTime: 30000, // 30 seconds
    enabled: !!user,
    refetchOnWindowFocus: false
  });

  // Memoize expensive calculations to prevent unnecessary re-renders
  const totalHashrate = useMemo(() => globalStats?.totalHashrate || 0, [globalStats?.totalHashrate]);
  const blockHeight = useMemo(() => globalStats?.blockHeight || 0, [globalStats?.blockHeight]);
  const circulation = useMemo(() => globalStats?.circulation || 0, [globalStats?.circulation]);
  const totalSupply = useMemo(() => 21000000, []); // 21 million total supply like Bitcoin
  
  const networkShare = useMemo(() => {
    return totalHashrate > 0 ? (hashPower / totalHashrate) * 100 : 0;
  }, [hashPower, totalHashrate]);
  
  const estimatedDaily = useMemo(() => {
    if (hashPower <= 0 || totalHashrate <= 0) return 0;
    const dailyReward = (hashPower / totalHashrate) * (globalStats?.currentBlockReward || 3200) * 24;
    return dailyReward;
  }, [hashPower, totalHashrate, globalStats?.currentBlockReward]);
  

  // Transform to block form - optimized with reduced frequency
  useEffect(() => {
    if (!miningActive) return;
    
    const interval = setInterval(() => {
      setIsBlockForm(true);
      const timeoutId = setTimeout(() => {
        setIsBlockForm(false);
      }, 400);
      
      return () => clearTimeout(timeoutId);
    }, 8000); // Increased interval for performance
    
    return () => clearInterval(interval);
  }, [miningActive]);

  // Mining progress animation
  useEffect(() => {
    if (!isMining || isSuspended) {
      setMiningProgress(0);
      return;
    }

    const interval = setInterval(() => {
      setMiningProgress(prev => {
        if (prev >= 100) {
          // Show block found animation
          setShowNewBlock(true);
          setTimeout(() => setShowNewBlock(false), 500); // Faster block animation
          
          // Add new block animation
          setBlockAnimations(prev => [...prev, Date.now()]);
          setTimeout(() => {
            setBlockAnimations(prev => prev.slice(1));
          }, 1000); // Faster block removal
          
          return 0;
        }
        return prev + (hashPower / 1000); // Progress based on hash power
      });
    }, 250); // Throttled for better performance

    return () => clearInterval(interval);
  }, [isMining, hashPower, isSuspended]);

  // Nonce counter for mining simulation
  useEffect(() => {
    if (!isMining || isSuspended) return;
    
    const interval = setInterval(() => {
      setNonce(prev => prev + Math.floor(Math.random() * 100000));
    }, 300); // Throttled for better performance
    
    return () => clearInterval(interval);
  }, [isMining, isSuspended]);

  // Generate realistic hash strings
  useEffect(() => {
    if (!isMining || isSuspended) return;

    const generateHash = () => {
      const chars = '0123456789abcdef';
      let hash = '0x';
      for (let i = 0; i < 64; i++) {
        hash += chars[Math.floor(Math.random() * chars.length)];
      }
      return hash;
    };

    const interval = setInterval(() => {
      const newHash = generateHash();
      currentHashRef.current = newHash;
      hashPoolRef.current = [newHash, ...hashPoolRef.current.slice(0, 4)];
      setHashDisplay(newHash); // Update visual display only
    }, 500); // Throttled for better performance

    return () => clearInterval(interval);
  }, [isMining, isSuspended]);

  // Countdown timer for next block (hourly UTC blocks)
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const currentMinutes = now.getUTCMinutes();
      const currentSeconds = now.getUTCSeconds();
      
      // Calculate total seconds remaining in the current hour
      // At XX:00:00, we have 3600 seconds (60 minutes) remaining
      // At XX:59:59, we have 1 second remaining
      const totalSecondsInHour = 60 * 60; // 3600 seconds
      const secondsElapsed = (currentMinutes * 60) + currentSeconds;
      const totalSecondsRemaining = totalSecondsInHour - secondsElapsed;
      
      // Convert to minutes and seconds for display
      // This ensures at XX:00:00 we show "60:00" (60 minutes, 0 seconds)
      const displayMinutes = Math.floor(totalSecondsRemaining / 60);
      const displaySeconds = totalSecondsRemaining % 60;
      
      setNextBlockTime(`${displayMinutes.toString().padStart(2, '0')}:${displaySeconds.toString().padStart(2, '0')}`);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Claim single block mutation
  const claimBlockMutation = useMutation({
    mutationFn: async (blockId: string) => {
      const res = await apiRequest("POST", `/api/claim-block/${blockId}`);
      return res.json();
    },
    onSuccess: (data) => {
      toast({ 
        title: "Block Claimed!", 
        description: `Successfully claimed ${data.reward} B2B` 
      });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/unclaimed-blocks"] });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Claim Failed", 
        description: error.message, 
        variant: "destructive" 
      });
    }
  });

  // Claim all blocks mutation
  const claimAllMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/claim-all-blocks");
      return res.json();
    },
    onSuccess: (data) => {
      toast({ 
        title: "All Blocks Claimed!", 
        description: `Successfully claimed ${data.totalReward} B2B from ${data.count} blocks` 
      });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/unclaimed-blocks"] });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Claim Failed", 
        description: error.message, 
        variant: "destructive" 
      });
    }
  });

  // Calculate mining stats - using memoized values from above

  // Format block timestamp to MM-DD HH:MM format
  const formatBlockTimestamp = useCallback((dateStr: string) => {
    const date = new Date(dateStr);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    
    return `${month}-${day} ${hours}:${minutes}`;
  }, []);

  // Check for reduced motion preference
  const prefersReducedMotion = useMemo(() => 
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  , []);

  // Memoize expensive calculations
  const totalUnclaimedReward = useMemo(() => 
    unclaimedBlocks?.reduce((sum: number, block: any) => 
      sum + parseFloat(block.reward), 0
    ) || 0
  , [unclaimedBlocks]);

  // Memoize unclaimed blocks list for better performance
  const memoizedUnclaimedBlocks = useMemo(() => unclaimedBlocks || [], [unclaimedBlocks]);

  return (
    <div className="mobile-page bg-gradient-to-b from-black via-gray-900 to-black">
      {/* Header */}
      <div className="mobile-header bg-black/90 backdrop-blur-lg border-b border-orange-500/20">
        <div>
          <h1 className="text-lg font-display font-black text-orange-500">
            MINING FACTORY
          </h1>
          <p className="text-[10px] text-gray-500 font-mono">
            B2B BLOCKCHAIN NETWORK
          </p>
        </div>
      </div>

      <div className="mobile-content">
        {/* Account Suspension Banner */}
        {isAccountSuspended && (
          <Card className="mobile-card bg-red-900/20 border-red-500 mb-3">
            <div className="p-4">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="w-6 h-6 text-red-500 mt-1 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="text-base font-bold text-red-500 mb-2">
                    Account Suspended
                  </h3>
                  <p className="text-xs text-red-400/90 leading-relaxed">
                    Your account has been suspended. Please contact support for assistance.
                  </p>
                </div>
              </div>
            </div>
          </Card>
        )}
        {/* Mining Animation Section */}
        <Card className={`mobile-card ${isSuspended ? 'bg-gray-900/50 border-gray-600/30' : 'bg-black/90 border-orange-500/30'} overflow-hidden relative p-3 ${isSuspended ? 'opacity-50' : ''}`}>
          <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent pointer-events-none"></div>
          
          <div className="relative z-10">
            <div className="flex items-center justify-end mb-4">
              <span className="text-[10px] font-mono text-orange-400">
                {formatHashPower(hashPower)}
              </span>
            </div>

            {/* Energy Core Mining Animation */}
            <div className="flex justify-center my-6 relative">
              <div className="relative w-48 h-48 flex items-center justify-center">
                
                {/* Central Energy Core */}
                <div className="absolute inset-0 flex items-center justify-center">
                  {/* Outer hexagon frame */}
                  <motion.div
                    className="absolute w-36 h-36"
                    animate={isMining ? {
                      rotate: [0, 360],
                    } : {}}  
                    transition={{
                      duration: prefersReducedMotion ? 0 : 15, // Slower rotation for better performance
                      repeat: prefersReducedMotion ? 0 : Infinity,
                      ease: "linear",
                    }}
                  >
                    <svg className="w-full h-full" viewBox="0 0 144 144">
                      <polygon
                        points="72,12 122,42 122,102 72,132 22,102 22,42"
                        fill="none"
                        stroke={isSuspended ? "#374151" : (isMining ? "#f97316" : "#374151")}
                        strokeWidth="2"
                        opacity={isSuspended ? 0.2 : (isMining ? 1 : 0.3)}
                      />
                      <polygon
                        points="72,24 110,48 110,96 72,120 34,96 34,48"
                        fill="none"
                        stroke={isSuspended ? "#374151" : (isMining ? "#fbbf24" : "#374151")}
                        strokeWidth="1"
                        opacity={isSuspended ? 0.1 : (isMining ? 0.8 : 0.2)}
                      />
                    </svg>
                  </motion.div>

                  {/* Energy core center - transforms to block */}
                  <motion.div
                    className="absolute w-20 h-20"
                    animate={isBlockForm ? {
                      scale: [1, 0.8, 1],
                      borderRadius: ["50%", "20%", "10%", "20%", "50%"],
                    } : isMining ? {
                      scale: [1, 1.2, 1],
                    } : {}}
                    transition={isBlockForm ? {
                      duration: 1,
                      ease: "easeInOut",
                    } : {
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  >
                    <motion.div 
                      className={`w-full h-full relative ${isSuspended ? 'bg-gray-800' : (isMining ? 'bg-gradient-to-br from-orange-500 via-yellow-500 to-orange-600' : 'bg-gray-800')}`}
                      animate={{
                        borderRadius: isBlockForm ? "10%" : "50%",
                      }}
                      transition={{
                        duration: 0.5,
                      }}
                    >
                      {/* Inner core */}
                      {!isBlockForm && (
                        <motion.div
                          className="absolute inset-2 rounded-full bg-gradient-to-br from-white via-yellow-200 to-orange-300"
                          animate={isMining ? {
                            opacity: [0.6, 1, 0.6],
                          } : {}}
                          transition={{
                            duration: 1,
                            repeat: Infinity,
                          }}
                        />
                      )}
                      
                      {/* Digital block pattern when transformed */}
                      {isBlockForm && (
                        <div className="absolute inset-0 overflow-hidden rounded-sm">
                          <div className="absolute inset-0 bg-gradient-to-br from-orange-600 to-yellow-600">
                            <div className="absolute inset-0 opacity-30">
                              {[...Array(4)].map((_, i) => (
                                <div key={i} className={`absolute w-full h-0.5 bg-orange-800`} style={{ top: `${25 * (i + 1)}%` }} />
                              ))}
                              {[...Array(4)].map((_, i) => (
                                <div key={i} className={`absolute h-full w-0.5 bg-orange-800`} style={{ left: `${25 * (i + 1)}%` }} />
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* Bitcoin symbol */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-2xl font-bold text-orange-900">₿</span>
                      </div>
                    </motion.div>

                    {/* Pulsing glow */}
                    {!isSuspended && miningActive && (
                      <motion.div
                        className="absolute inset-0 rounded-full"
                        animate={{
                          boxShadow: [
                            '0 0 20px rgba(251, 146, 60, 0.5)',
                            '0 0 40px rgba(251, 146, 60, 0.8)',
                            '0 0 20px rgba(251, 146, 60, 0.5)',
                          ],
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                        }}
                      />
                    )}
                  </motion.div>

                  {/* Energy rings */}
                  {!isSuspended && miningActive && !isBlockForm && (
                    <>
                      {[0, 1, 2].map((ring) => (
                        <motion.div
                          key={`ring-${ring}`}
                          className="absolute rounded-full border-2 border-orange-400"
                          initial={{
                            width: 80,
                            height: 80,
                            opacity: 1,
                          }}
                          animate={{
                            width: [80, 160, 200],
                            height: [80, 160, 200],
                            opacity: [1, 0.5, 0],
                          }}
                          transition={{
                            duration: prefersReducedMotion ? 0 : 3,
                            repeat: prefersReducedMotion ? 0 : Infinity,
                            delay: prefersReducedMotion ? 0 : ring * 1.5, // Increased delay for performance
                          }}
                        />
                      ))}
                    </>
                  )}


                  {/* Lightning bolts */}
                  {!isSuspended && miningActive && !isBlockForm && (
                    <>
                      {[0, 1, 2, 3].map((bolt) => (
                        <motion.div
                          key={`bolt-${bolt}`}
                          className="absolute"
                          style={{
                            left: '50%',
                            top: '50%',
                            transform: `rotate(${bolt * 90}deg)`,
                          }}
                          animate={{
                            opacity: [0, 1, 0],
                          }}
                          transition={{
                            duration: prefersReducedMotion ? 0 : 0.5,
                            repeat: prefersReducedMotion ? 0 : Infinity,
                            delay: prefersReducedMotion ? 0 : bolt * 0.8, // Increased delay
                            repeatDelay: prefersReducedMotion ? 0 : 3, // Increased repeat delay
                          }}
                        >
                          <svg width="80" height="20" viewBox="0 0 80 20" className="-ml-10 -mt-2">
                            <path
                              d="M 20 10 L 30 5 L 35 10 L 45 5 L 50 10 L 60 5 L 65 10 L 75 5"
                              stroke="#fbbf24"
                              strokeWidth="2"
                              fill="none"
                            />
                          </svg>
                        </motion.div>
                      ))}
                    </>
                  )}


                </div>
              </div>
            </div>


            {/* Hash Display */}
            {miningActive && !isSuspended && (
              <div className="bg-black/60 rounded-lg p-2 mt-3">
                <div className="flex items-center space-x-1.5 mb-1.5">
                  <Hash className="w-3 h-3 text-orange-500 animate-pulse" />
                  <span className="text-[10px] font-mono text-orange-500">CALCULATING HASHES</span>
                  <Activity className="w-2.5 h-2.5 text-orange-400 animate-pulse" />
                </div>
                <div className="font-mono text-[9px] text-orange-400 break-all">
                  {hashDisplay}
                </div>
                <div className="mt-1.5 space-y-0.5">
                  {hashPoolRef.current.slice(0, 4).map((hash, index) => (
                    <motion.div
                      key={`${hash}-${index}`}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1 - (index * 0.2), x: 0 }}
                      className="font-mono text-[8px] text-orange-400/40 truncate"
                    >
                      {hash}
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Start Mining Button - Only show for first-time users */}
        {!user?.hasStartedMining && (
          <Card className="mobile-card bg-black/90 border-orange-500/30 mt-3">
            <div className="text-center">
              <Button
                onClick={handleStartMining}
                className={`bg-transparent border-2 ${
                  isSuspended 
                    ? 'border-gray-500 text-gray-500 cursor-not-allowed opacity-50' 
                    : 'border-[#f7931a] text-[#f7931a] hover:bg-[#f7931a] hover:text-black'
                } font-medium text-sm px-6 py-2 transition-all duration-200`}
                disabled={isSuspended}
                data-testid="button-start-mining"
                title={isAccountSuspended ? "Account suspended - Please contact support" : (isMiningPaused ? "Claim your rewards to resume mining" : "")}
              >
                {isAccountSuspended ? "Account Suspended" : (isMiningPaused ? "Claim Rewards to Resume" : "Start Mining")}
              </Button>
              {isSuspended && (
                <p className="text-[10px] text-red-400 mt-2">
                  Please contact support to resolve this issue
                </p>
              )}
            </div>
          </Card>
        )}


        {/* Network Stats Grid */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <Card className="bg-black/80 border-orange-500/20">
            <div className="p-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] text-gray-400 uppercase">Total Supply</span>
                <Award className="w-3 h-3 text-orange-500/50" />
              </div>
              <p className="text-sm font-bold text-orange-500">{(totalSupply / 1000000).toFixed(1)}M</p>
              <p className="text-[9px] text-gray-500">B2B</p>
            </div>
          </Card>

          <Card className="bg-black/80 border-orange-500/20">
            <div className="p-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] text-gray-400 uppercase">Circulating Supply</span>
                <TrendingUp className="w-3 h-3 text-orange-500/50" />
              </div>
              <p className="text-sm font-bold text-orange-500">{circulation.toLocaleString('en-US', { maximumFractionDigits: 2 })}</p>
              <p className="text-[9px] text-gray-500">B2B</p>
            </div>
          </Card>

          <Card className="bg-black/80 border-orange-500/20">
            <div className="p-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] text-gray-400 uppercase">Block Height</span>
                <Cpu className="w-3 h-3 text-orange-500/50" />
              </div>
              <p className="text-sm font-bold text-orange-500">#{blockHeight}</p>
              <p className="text-[9px] text-gray-500">CURRENT</p>
            </div>
          </Card>

          <Card className="bg-black/80 border-orange-500/20">
            <div className="p-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] text-gray-400 uppercase">Next Block</span>
                <Clock className="w-3 h-3 text-orange-500/50 animate-pulse" />
              </div>
              <p className="text-sm font-bold text-orange-500">{nextBlockTime}</p>
              <p className="text-[9px] text-gray-500">COUNTDOWN</p>
            </div>
          </Card>
        </div>

        {/* Personal Mining Stats */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <Card className="bg-black/80 border-orange-500/20">
            <div className="p-1.5 text-center">
              <Zap className="w-3 h-3 text-orange-500 mx-auto mb-0.5" />
              <p className="text-[8px] text-gray-400">Network Share</p>
              <p className="text-xs font-bold text-orange-500">{networkShare.toFixed(2)}%</p>
            </div>
          </Card>

          <Card className="bg-black/80 border-orange-500/20">
            <div className="p-1.5 text-center">
              <Cpu className="w-3 h-3 text-orange-500 mx-auto mb-0.5" />
              <p className="text-[8px] text-gray-400">Your Hashrate</p>
              <p className="text-xs font-bold text-orange-500">{formatHashPower(hashPower)}</p>
            </div>
          </Card>

          <Card className="bg-black/80 border-orange-500/20">
            <div className="p-1.5 text-center">
              <TrendingUp className="w-3 h-3 text-orange-500 mx-auto mb-0.5" />
              <p className="text-[8px] text-gray-400">Est. Daily</p>
              <p className="text-xs font-bold text-orange-500">{estimatedDaily.toFixed(4)}</p>
            </div>
          </Card>
        </div>

        {/* Block Participation List */}
        <div>
          <BlockParticipationList 
            blocks={memoizedUnclaimedBlocks.map((block: any) => ({
              blockNumber: block.blockNumber,
              blockHeight: block.blockNumber,
              userShare: block.reward,
              reward: block.reward,
              totalReward: "5000",
              timestamp: block.expiresAt,
              blockTime: block.expiresAt,
              blockHash: block.txHash,
              claimed: false
            }))}
            totalMined={totalUnclaimedReward.toFixed(8)}
            participatedCount={memoizedUnclaimedBlocks.length}
            isLoading={blocksLoading}
            showClaimButton={true}
            onClaimSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['/api/mining/unclaimed-blocks'] });
              queryClient.invalidateQueries({ queryKey: ['/api/user'] });
            }}
          />
        </div>

      </div>
    </div>
  );
}

// Export component without memo to fix typing with route components
export default MiningFactory;
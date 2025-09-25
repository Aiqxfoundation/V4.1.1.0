import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Loader2, Cpu, Zap } from "lucide-react";
import { motion } from "framer-motion";
import { formatHashPower } from "@/lib/utils";

export default function PurchasePowerPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [amount, setAmount] = useState("");
  
  // Maximum limit: 100 ZH/s = 100 * 10^18 KH/s = 10^20 KH/s
  // At 1 USDT = 100 KH/s rate: Max USDT = 10^18 USDT
  const MAX_USDT_PURCHASE = 1000000000000000000; // 100 ZH/s worth of USDT
  
  // Fetch fresh balance data from server (for real-time updates)
  const { data: walletBalances } = useQuery<{
    btcBalance: string;
    usdtBalance: string;
    b2bBalance: string;
  }>({
    queryKey: ['/api/wallet/balances'],
    refetchInterval: 5000, // Refresh every 5 seconds
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    enabled: !!user,
  });
  
  // Use fresh balance data if available, fallback to user object
  const usdtBalance = walletBalances ? parseFloat(walletBalances.usdtBalance) : parseFloat(user?.usdtBalance || '0');
  const currentHashPower = parseFloat(user?.hashPower || '0');
  const selectedAmount = parseFloat(amount) || 0;

  const purchasePowerMutation = useMutation({
    mutationFn: async (amount: number) => {
      const res = await apiRequest("POST", "/api/purchase-power", { amount });
      return res.json();
    },
    onSuccess: () => {
      toast({ 
        title: "Hash Power Purchased", 
        description: `Added ${formatHashPower(selectedAmount * 100)} to your B2B mining power` 
      });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/global-stats"] });
      setLocation("/mining");
    },
    onError: (error: Error) => {
      toast({ 
        title: "Purchase Failed", 
        description: error.message, 
        variant: "destructive" 
      });
    }
  });

  const handlePurchase = () => {
    if (selectedAmount > MAX_USDT_PURCHASE) {
      return;
    }
    if (selectedAmount > usdtBalance) {
      toast({ 
        title: "Insufficient Balance", 
        description: `You need ${selectedAmount} USDT but only have ${usdtBalance.toFixed(2)} USDT`, 
        variant: "destructive" 
      });
      return;
    }
    if (selectedAmount < 1) {
      toast({ 
        title: "Invalid Amount", 
        description: "Minimum purchase is 1 USDT", 
        variant: "destructive" 
      });
      return;
    }
    purchasePowerMutation.mutate(selectedAmount);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black p-4">
      <div className="max-w-2xl mx-auto">
        
        {/* Hashrate Header - Matches Navigation Design */}
        <div className="text-center mb-8">
          <motion.div 
            className="relative w-20 h-20 mx-auto mb-6 flex items-center justify-center rounded-full"
            animate={{
              scale: [1, 1.05, 1]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            style={{
              background: `radial-gradient(ellipse at center, 
                rgba(247, 147, 26, 0.05) 0%, 
                transparent 70%)`
            }}
          >
            <motion.i 
              className="fas fa-microchip text-4xl text-[#f7931a]"
              animate={{
                filter: [
                  "drop-shadow(0 0 8px rgba(247, 147, 26, 0.4))",
                  "drop-shadow(0 0 12px rgba(247, 147, 26, 0.6))",
                  "drop-shadow(0 0 8px rgba(247, 147, 26, 0.4))"
                ]
              }}
              transition={{
                duration: 2.5,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
          </motion.div>
          <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#f7931a] to-[#ff9500] mb-3">
            Purchase Hash Power
          </h1>
          <p className="text-gray-400 text-lg">
            Buy mining power to earn <span className="text-[#f7931a] font-semibold">B2B</span> rewards
          </p>
        </div>

        {/* Bitcoin Balance Info Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
        >
          <Card className="mb-6 bg-gradient-to-r from-gray-900/80 to-gray-800/80 border-gray-700/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-3 text-gray-200">
                <motion.div
                  animate={{ rotate: [0, 360] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                >
                  <Cpu className="w-6 h-6 text-[#f7931a]" />
                </motion.div>
                Account Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-400 font-medium">Available Balance:</span>
                <span className="font-mono font-bold text-white text-lg">${usdtBalance.toFixed(2)} USDT</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400 font-medium">Current Hash Power:</span>
                <span className="font-mono font-bold text-[#f7931a] text-lg">{formatHashPower(currentHashPower * 100)}</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Bitcoin Purchase Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.6 }}
        >
          <Card className="mb-6 bg-gradient-to-r from-gray-900/80 to-gray-800/80 border-gray-700/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-xl text-gray-200 flex items-center gap-2">
                <Zap className="w-6 h-6 text-[#f7931a]" />
                Purchase Mining Power
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-8">
              
              {/* Amount Input */}
              <div className="space-y-4">
                <label className="text-lg font-semibold text-gray-200">
                  Purchase Amount (USDT)
                </label>
                <Input
                  type="number"
                  value={amount}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value) || 0;
                    if (value <= MAX_USDT_PURCHASE) {
                      setAmount(e.target.value);
                    }
                  }}
                  placeholder="Enter amount"
                  className="h-14 text-lg font-mono bg-gray-900/60 border-2 border-gray-700 text-white focus:border-[#f7931a] focus:ring-2 focus:ring-[#f7931a]/30 rounded-xl backdrop-blur-sm"
                  min={1}
                  max={Math.min(Math.floor(usdtBalance), MAX_USDT_PURCHASE)}
                  data-testid="input-amount"
                />
              </div>

              {/* Bitcoin Hash Power Preview */}
              {selectedAmount > 0 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4, ease: "backOut" }}
                >
                  <Card className="bg-gradient-to-r from-gray-900/90 to-black/90 border-2 border-[#f7931a]/40 relative overflow-hidden">
                    <motion.div 
                      className="absolute inset-0 bg-gradient-to-r from-[#f7931a]/5 via-[#f7931a]/10 to-[#f7931a]/5"
                      animate={{ 
                        background: [
                          "linear-gradient(90deg, rgba(247,147,26,0.05), rgba(247,147,26,0.1), rgba(247,147,26,0.05))",
                          "linear-gradient(90deg, rgba(247,147,26,0.1), rgba(247,147,26,0.15), rgba(247,147,26,0.1))",
                          "linear-gradient(90deg, rgba(247,147,26,0.05), rgba(247,147,26,0.1), rgba(247,147,26,0.05))"
                        ]
                      }}
                      transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                    />
                    <CardContent className="pt-6 relative z-10">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <motion.div
                            animate={{ scale: [1, 1.1, 1] }}
                            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                          >
                            <Zap className="w-6 h-6 text-[#f7931a]" />
                          </motion.div>
                          <span className="font-semibold text-gray-300 text-lg">Mining Power to Receive:</span>
                        </div>
                        <motion.span 
                          className="text-3xl font-mono font-bold text-[#f7931a]"
                          animate={{ 
                            textShadow: [
                              "0 0 10px rgba(247, 147, 26, 0.2)",
                              "0 0 15px rgba(247, 147, 26, 0.4)",
                              "0 0 10px rgba(247, 147, 26, 0.2)"
                            ]
                          }}
                          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                        >
                          {formatHashPower(selectedAmount * 100)}
                        </motion.span>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* Bitcoin Purchase Button */}
              <motion.div
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
              >
                <Button
                  onClick={handlePurchase}
                  disabled={purchasePowerMutation.isPending || selectedAmount > usdtBalance || selectedAmount < 1 || selectedAmount > MAX_USDT_PURCHASE}
                  className="w-full h-16 bg-[#f7931a] hover:bg-[#ff9500] text-black font-bold text-lg rounded-xl relative overflow-hidden transition-all duration-200 shadow-lg hover:shadow-[#f7931a]/30"
                  data-testid="button-purchase"
                >
                  <motion.div 
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                    animate={{ x: ['-100%', '100%'] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear", repeatDelay: 3 }}
                  />
                  <div className="relative z-10 flex items-center justify-center gap-3">
                    {purchasePowerMutation.isPending ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span className="font-bold">Processing...</span>
                      </>
                    ) : selectedAmount > 0 ? (
                      <>
                        <motion.div
                          animate={{ rotate: [0, 360] }}
                          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                        >
                          <Zap className="w-5 h-5" />
                        </motion.div>
                        <span className="font-bold">Purchase {formatHashPower(selectedAmount * 100)}</span>
                      </>
                    ) : (
                      <span className="font-bold">Select Amount to Purchase</span>
                    )}
                  </div>
                </Button>
              </motion.div>

              {/* Error Display */}
              {selectedAmount > usdtBalance && selectedAmount <= MAX_USDT_PURCHASE && (
                <motion.div 
                  className="text-red-400 text-sm text-center p-4 bg-red-950/20 border border-red-900/50 rounded-xl"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                >
                  Insufficient balance. You need ${(selectedAmount - usdtBalance).toFixed(2)} more USDT.
                </motion.div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Bitcoin Mining Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.6 }}
        >
          <Card className="bg-gradient-to-r from-gray-900/80 to-gray-800/80 border-gray-700/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-xl text-gray-200 flex items-center gap-2">
                <Cpu className="w-6 h-6 text-[#f7931a]" />
                Mining Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <motion.div 
                className="mb-6 p-4 bg-gradient-to-r from-gray-900/60 to-black/60 border border-[#f7931a]/30 rounded-xl"
                animate={{
                  boxShadow: [
                    "0 0 0 rgba(247, 147, 26, 0)",
                    "0 0 10px rgba(247, 147, 26, 0.2)",
                    "0 0 0 rgba(247, 147, 26, 0)"
                  ]
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              >
                <p className="text-sm font-mono text-center text-[#f7931a] font-semibold">
                  Mining Rewards = (Your Hash Power ÷ Network Hash Power) × Block Reward
                </p>
              </motion.div>
              
              <div className="space-y-4 text-sm text-gray-400">
                <p>• <span className="font-semibold text-white">Distributed Hash Power:</span> Purchase computational power directly with USDT to begin mining immediately</p>
                <p>• <span className="font-semibold text-white">Proportional Rewards:</span> Your hash power determines your share of block rewards with real-time adjustments</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

      </div>
    </div>
  );
}
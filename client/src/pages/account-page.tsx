import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Shield, Copy, LogOut, Users, Activity, TrendingUp, Gift, Hash, DollarSign, CheckCircle2, Loader2, Smartphone, QrCode, Share2, ArrowRight, Globe, FileText } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Link } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatHashPower } from "@/lib/utils";

interface ReferralCode {
  id: string;
  code: string;
  ownerId: string;
  usedBy: string | null;
  isUsed: boolean;
  createdAt: string;
  usedAt: string | null;
}

interface ReferralSlot {
  code: string;
  username: string;
  userId: string;
  hashPower: string;
  isActive: boolean;
  joinedAt: string;
  pendingUsdtRewards: string;
  pendingHashRewards: string;
  totalRewards: number;
}

interface ReferralStats {
  totalCodes: number;
  usedCodes: number;
  totalUsdtEarned: string;
  totalHashEarned: string;
  pendingUsdtRewards: string;
  pendingHashRewards: string;
}

export default function AccountPage() {
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [activeTab, setActiveTab] = useState("overview");

  // 2FA state
  const [show2FADialog, setShow2FADialog] = useState(false);
  const [twoFactorSetupData, setTwoFactorSetupData] = useState<{ secret: string; uri: string } | null>(null);
  const [twoFactorVerifyToken, setTwoFactorVerifyToken] = useState("");
  const [disable2FAInput, setDisable2FAInput] = useState("");

  // Query 2FA status
  const { data: twoFactorStatus, refetch: refetch2FA } = useQuery<{ enabled: boolean; hasSecret: boolean }>({
    queryKey: ["/api/2fa/status"],
    enabled: !!user,
  });

  // Generate 2FA secret mutation
  const generate2FAMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/2fa/generate");
      return res.json();
    },
    onSuccess: (data) => {
      setTwoFactorSetupData(data);
      setTwoFactorVerifyToken("");
    },
    onError: (err: any) => {
      toast({ title: "Failed to generate 2FA", description: err.message, variant: "destructive" });
    }
  });

  // Enable 2FA mutation
  const enable2FAMutation = useMutation({
    mutationFn: async (data: { secret: string; token: string }) => {
      const res = await apiRequest("POST", "/api/2fa/enable", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "2FA Enabled", description: "Two-Factor Authentication is now active on your account." });
      refetch2FA();
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      setShow2FADialog(false);
      setTwoFactorSetupData(null);
      setTwoFactorVerifyToken("");
    },
    onError: (err: any) => {
      toast({ title: "Activation Failed", description: err.message, variant: "destructive" });
    }
  });

  // Disable 2FA mutation
  const disable2FAMutation = useMutation({
    mutationFn: async (data: { token?: string; pin?: string }) => {
      const res = await apiRequest("POST", "/api/2fa/disable", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "2FA Disabled", description: "Two-Factor Authentication has been disabled." });
      refetch2FA();
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      setShow2FADialog(false);
      setDisable2FAInput("");
    },
    onError: (err: any) => {
      toast({ title: "Failed to Disable", description: err.message, variant: "destructive" });
    }
  });

  // Fetch referral codes
  const { data: referralCodes, isLoading: loadingCodes } = useQuery<ReferralCode[]>({
    queryKey: ["/api/referral/codes"],
    enabled: !!user,
  });

  // Fetch referral slots
  const { data: referralSlots, isLoading: loadingSlots } = useQuery<ReferralSlot[]>({
    queryKey: ["/api/referral/slots"],
    enabled: !!user,
  });

  // Fetch referral stats
  const { data: referralStats, isLoading: loadingStats } = useQuery<ReferralStats>({
    queryKey: ["/api/referral/stats"],
    enabled: !!user,
  });

  // Claim rewards mutation
  const claimRewardsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/referral/claim");
      return res.json();
    },
    onSuccess: (data) => {
      toast({ 
        title: "Rewards Claimed!", 
        description: `Claimed ${data.usdtClaimed} USDT and ${formatHashPower(parseFloat(data.hashClaimed) * 1000)} hashrate` 
      });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/referral/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/referral/slots"] });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Claim Failed", 
        description: error.message, 
        variant: "destructive" 
      });
    }
  });

  // Change PIN mutation
  const changePinMutation = useMutation({
    mutationFn: async (data: { currentPin: string; newPin: string }) => {
      const res = await apiRequest("POST", "/api/change-pin", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ 
        title: "PIN Updated", 
        description: "Your security PIN has been changed" 
      });
      setShowPinDialog(false);
      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
    },
    onError: (error: Error) => {
      toast({ 
        title: "Update Failed", 
        description: error.message, 
        variant: "destructive" 
      });
    }
  });

  const handlePinChange = () => {
    if (!currentPin || !newPin || !confirmPin) {
      toast({ 
        title: "Invalid Input", 
        description: "Please fill all fields", 
        variant: "destructive" 
      });
      return;
    }

    if (newPin !== confirmPin) {
      toast({ 
        title: "PIN Mismatch", 
        description: "New PIN and confirmation don't match", 
        variant: "destructive" 
      });
      return;
    }

    if (newPin.length !== 6 || !/^\d+$/.test(newPin)) {
      toast({ 
        title: "Invalid PIN", 
        description: "PIN must be exactly 6 digits", 
        variant: "destructive" 
      });
      return;
    }

    changePinMutation.mutate({ currentPin, newPin });
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ 
      title: "Copied!", 
      description: `Code ${code} copied to clipboard` 
    });
  };

  const hasPendingRewards = parseFloat(referralStats?.pendingUsdtRewards || '0') > 0 || 
                           parseFloat(referralStats?.pendingHashRewards || '0') > 0;

  return (
    <div className="mobile-page">
      {/* Header */}
      <div className="mobile-header">
        <h1 className="text-lg font-display font-bold text-primary">ACCOUNT</h1>
      </div>

      {/* Content */}
      <div className="mobile-content">
        {/* User Info */}
        {/* User Info & Profile Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 border border-primary/20 mb-2.5">
            <span className="text-2xl font-display font-bold text-primary">
              {user?.username?.[0]?.toUpperCase()}
            </span>
          </div>
          <div className="flex items-center justify-center gap-1.5">
            <p className="text-xl font-display font-bold text-white">@{user?.username}</p>
            {user?.isAdmin && (
              <Badge className="bg-[#f7931a]/20 text-[#f7931a] border-[#f7931a]/30 text-[10px] font-mono">
                ADMIN
              </Badge>
            )}
          </div>
          <p className="text-[11px] text-zinc-500 font-mono mt-0.5">
            UID: #{user?.id?.slice(0, 8) || '00000000'}
            {user?.createdAt && ` • Member since ${new Date(user.createdAt).toLocaleDateString()}`}
          </p>

          <div className="flex items-center justify-center gap-1.5 mt-2.5 flex-wrap">
            <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 text-[10px] bg-emerald-500/10">
              ● {user?.miningActive ? 'Miner Active' : 'Idle'}
            </Badge>
            <Badge variant="outline" className={`text-[10px] ${user?.twoFactorEnabled ? 'border-green-500/30 text-green-400 bg-green-500/10' : 'border-zinc-800 text-zinc-400'}`}>
              {user?.twoFactorEnabled ? '2FA Active' : '2FA Off'}
            </Badge>
            <Badge variant="outline" className={`text-[10px] ${user?.securityPin ? 'border-blue-500/30 text-blue-400 bg-blue-500/10' : 'border-zinc-800 text-zinc-400'}`}>
              {user?.securityPin ? 'PIN Active' : 'No PIN'}
            </Badge>
          </div>
        </div>

        {/* Tabs for different sections */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-4">
            <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
            <TabsTrigger value="codes" className="text-xs">Codes</TabsTrigger>
            <TabsTrigger value="slots" className="text-xs">Slots</TabsTrigger>
            <TabsTrigger value="settings" className="text-xs">Settings</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            {/* Quick Referral Invite Card */}
            <Card className="mobile-card bg-gradient-to-br from-primary/10 via-zinc-950 to-transparent border-primary/30">
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">Your Referral Link</span>
                  </div>
                  <Link href="/referral">
                    <span className="text-[11px] text-primary hover:underline flex items-center gap-1 cursor-pointer font-medium">
                      Full Program <ArrowRight className="w-3 h-3" />
                    </span>
                  </Link>
                </div>

                <div className="flex items-center justify-between bg-black/60 border border-zinc-800 rounded-lg p-2.5">
                  <div>
                    <p className="text-[10px] text-zinc-500 font-mono">YOUR CODE</p>
                    <p className="text-base font-bold font-mono text-primary">
                      {user?.referralCode || user?.username?.toUpperCase().slice(0, 8) || "------"}
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs px-2 border-zinc-700"
                      onClick={() => {
                        const code = user?.referralCode || user?.username?.toUpperCase().slice(0, 8) || "";
                        navigator.clipboard.writeText(code);
                        toast({ title: "Code Copied!", description: `Referral code ${code} copied` });
                      }}
                    >
                      <Copy className="w-3 h-3 mr-1" /> Copy Code
                    </Button>
                    <Button
                      size="sm"
                      className="h-7 text-xs px-2.5 bg-primary text-black font-semibold hover:bg-primary/90"
                      onClick={() => {
                        const code = user?.referralCode || user?.username?.toUpperCase().slice(0, 8) || "";
                        const link = `${window.location.origin}/auth?ref=${encodeURIComponent(code)}`;
                        navigator.clipboard.writeText(link);
                        toast({ title: "Link Copied!", description: "Referral invite link copied" });
                      }}
                    >
                      <Share2 className="w-3 h-3 mr-1" /> Copy Link
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] text-zinc-400 pt-0.5">
                  <div className="bg-background/60 rounded p-2 border border-zinc-800/80">
                    <span className="text-zinc-500">Tier 1 Bonus: </span>
                    <strong className="text-white">10% USDT</strong>
                  </div>
                  <div className="bg-background/60 rounded p-2 border border-zinc-800/80">
                    <span className="text-zinc-500">Tier 2 Bonus: </span>
                    <strong className="text-white">5% USDT</strong>
                  </div>
                </div>
              </div>
            </Card>

            {/* Referral Statistics Card */}
            <Card className="mobile-card bg-gradient-to-br from-primary/5 to-transparent">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  Referral Statistics
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingStats ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-background rounded-lg p-3">
                        <p className="text-xs text-muted-foreground">Total Codes</p>
                        <p className="text-lg font-bold">{referralStats?.totalCodes || 0}</p>
                      </div>
                      <div className="bg-background rounded-lg p-3">
                        <p className="text-xs text-muted-foreground">Used Codes</p>
                        <p className="text-lg font-bold text-primary">{referralStats?.usedCodes || 0}</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-background rounded-lg p-3">
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <DollarSign className="w-3 h-3" /> Total USDT Earned
                        </p>
                        <p className="text-lg font-bold text-green-500">${referralStats?.totalUsdtEarned || '0'}</p>
                      </div>
                      <div className="bg-background rounded-lg p-3">
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Hash className="w-3 h-3" /> Total Hash Earned
                        </p>
                        <p className="text-lg font-bold text-blue-500">
                          {formatHashPower(parseFloat(referralStats?.totalHashEarned || '0') * 1000)}
                        </p>
                      </div>
                    </div>

                    {/* Pending Rewards */}
                    {hasPendingRewards && (
                      <div className="bg-primary/10 rounded-lg p-3 border border-primary/20">
                        <p className="text-xs font-semibold mb-2 flex items-center gap-1">
                          <Gift className="w-3 h-3" /> Pending Rewards
                        </p>
                        <div className="space-y-1 text-xs">
                          <p>USDT: <span className="font-bold text-primary">${referralStats?.pendingUsdtRewards}</span></p>
                          <p>Hashrate: <span className="font-bold text-primary">
                            {formatHashPower(parseFloat(referralStats?.pendingHashRewards || '0') * 1000)}
                          </span></p>
                        </div>
                        <Button 
                          size="sm" 
                          className="w-full mt-3"
                          onClick={() => claimRewardsMutation.mutate()}
                          disabled={claimRewardsMutation.isPending}
                          data-testid="button-claim-rewards"
                        >
                          {claimRewardsMutation.isPending ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Claiming...
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-4 h-4 mr-2" />
                              Claim All Rewards
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Codes Tab */}
          <TabsContent value="codes" className="space-y-4">
            <Card className="mobile-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">My Referral Codes</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingCodes ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : referralCodes && referralCodes.length > 0 ? (
                  <div className="space-y-2">
                    {referralCodes.map((code) => (
                      <div 
                        key={code.id} 
                        className={`flex items-center justify-between p-3 rounded-lg border ${
                          code.isUsed ? 'bg-muted/50 opacity-60' : 'bg-background hover:bg-primary/5'
                        }`}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className={`font-mono font-bold ${code.isUsed ? 'text-muted-foreground' : 'text-primary'}`}>
                              {code.code}
                            </span>
                            {code.isUsed ? (
                              <Badge variant="secondary" className="text-xs">Used</Badge>
                            ) : (
                              <Badge variant="default" className="text-xs bg-green-500/20 text-green-500">Available</Badge>
                            )}
                          </div>
                          {code.isUsed && code.usedAt && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Used on {new Date(code.usedAt).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                        {!code.isUsed && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyCode(code.code)}
                            data-testid={`button-copy-${code.code}`}
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Hash className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>No referral codes yet</p>
                    <p className="text-xs mt-2">Purchase 2000 KH/s to get your first 5 codes!</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Slots Tab */}
          <TabsContent value="slots" className="space-y-4">
            <Card className="mobile-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Referral Slots</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingSlots ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : referralSlots && referralSlots.length > 0 ? (
                  <div className="space-y-3">
                    {referralSlots.map((slot) => (
                      <div key={slot.code} className="p-3 bg-background rounded-lg border">
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-semibold">@{slot.username}</p>
                          <Badge 
                            variant={slot.isActive ? 'default' : 'secondary'}
                            className={slot.isActive ? 'bg-primary/20 text-primary' : ''}
                          >
                            {slot.isActive ? (
                              <>
                                <Activity className="w-3 h-3 mr-1" />
                                Active
                              </>
                            ) : (
                              'Inactive'
                            )}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground space-y-1">
                          <p>Code: <span className="font-mono">{slot.code}</span></p>
                          <p>Joined: {new Date(slot.joinedAt).toLocaleDateString()}</p>
                          {slot.isActive && (
                            <>
                              <p>Hash Power: {formatHashPower(parseFloat(slot.hashPower) * 1000)}</p>
                              {parseFloat(slot.pendingUsdtRewards) > 0 && (
                                <p className="text-green-500">
                                  Pending: ${slot.pendingUsdtRewards} USDT + {formatHashPower(parseFloat(slot.pendingHashRewards) * 1000)}
                                </p>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>No referrals yet</p>
                    <p className="text-xs mt-2">Share your codes to start earning!</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-3">
            {/* Security PIN */}
            <Card 
              className="mobile-card cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => setShowPinDialog(true)}
              data-testid="button-change-pin"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Shield className="w-5 h-5 text-primary" />
                  <div>
                    <p className="font-semibold">Security PIN</p>
                    <p className="text-xs text-muted-foreground">Change your 6-digit PIN</p>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">›</span>
              </div>
            </Card>

            {/* Two-Factor Authentication (2FA) */}
            <Card 
              className="mobile-card cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => {
                setShow2FADialog(true);
                if (!twoFactorStatus?.enabled && !twoFactorSetupData) {
                  generate2FAMutation.mutate();
                }
              }}
              data-testid="button-manage-2fa"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Smartphone className="w-5 h-5 text-accent" />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">2FA Authentication</p>
                      {twoFactorStatus?.enabled ? (
                        <Badge className="bg-green-600/20 text-green-400 border-green-600/30 text-[10px] py-0 px-1.5">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-zinc-500 text-[10px] py-0 px-1.5">
                          Disabled
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {twoFactorStatus?.enabled 
                        ? "Google Authenticator / TOTP active" 
                        : "Protect login & withdrawals with 2FA"}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">›</span>
              </div>
            </Card>

            {/* Logout */}
            <Card 
              className="mobile-card cursor-pointer hover:border-destructive/50 transition-colors"
              onClick={() => logoutMutation.mutate()}
              data-testid="button-logout"
            >
              <div className="flex items-center gap-3">
                <LogOut className="w-5 h-5 text-destructive" />
                <p className="font-semibold text-destructive">Sign Out</p>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Change PIN Dialog */}
      <Dialog open={showPinDialog} onOpenChange={setShowPinDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change Security PIN</DialogTitle>
            <DialogDescription>
              Update your 6-digit security PIN
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="current-pin">Current PIN</Label>
              <Input
                id="current-pin"
                type="password"
                value={currentPin}
                onChange={(e) => setCurrentPin(e.target.value)}
                placeholder="Enter current PIN"
                maxLength={6}
                data-testid="input-current-pin"
              />
            </div>
            <div>
              <Label htmlFor="new-pin">New PIN</Label>
              <Input
                id="new-pin"
                type="password"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
                placeholder="Enter new 6-digit PIN"
                maxLength={6}
                data-testid="input-new-pin"
              />
            </div>
            <div>
              <Label htmlFor="confirm-pin">Confirm New PIN</Label>
              <Input
                id="confirm-pin"
                type="password"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value)}
                placeholder="Confirm new PIN"
                maxLength={6}
                data-testid="input-confirm-pin"
              />
            </div>
            <Button
              onClick={handlePinChange}
              disabled={changePinMutation.isPending}
              className="w-full"
              data-testid="button-confirm-pin-change"
            >
              {changePinMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                'Change PIN'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 2FA Management Dialog */}
      <Dialog open={show2FADialog} onOpenChange={setShow2FADialog}>
        <DialogContent className="sm:max-w-md bg-zinc-950 border border-zinc-800 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Smartphone className="w-5 h-5 text-accent" />
              Two-Factor Authentication (2FA)
            </DialogTitle>
            <DialogDescription className="text-zinc-400 text-xs">
              {twoFactorStatus?.enabled 
                ? "2FA is active and protecting your account."
                : "Scan the QR code with Google Authenticator or any TOTP app."}
            </DialogDescription>
          </DialogHeader>

          {twoFactorStatus?.enabled ? (
            /* Disable 2FA Form */
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-xs text-green-300">
                ✓ 2FA is currently active for logins and withdrawals.
              </div>
              <div>
                <Label htmlFor="disable-2fa-token" className="text-xs text-zinc-300">
                  Enter 2FA Code or 6-digit Security PIN to Disable
                </Label>
                <Input
                  id="disable-2fa-token"
                  type="text"
                  value={disable2FAInput}
                  onChange={(e) => setDisable2FAInput(e.target.value.replace(/\D/g, ''))}
                  placeholder="6-digit code or PIN"
                  maxLength={6}
                  className="bg-black border-zinc-700 text-white font-mono text-center tracking-widest text-lg mt-1"
                />
              </div>
              <Button
                onClick={() => {
                  if (disable2FAInput.length !== 6) {
                    toast({ title: "Invalid Input", description: "Enter 6-digit code or PIN", variant: "destructive" });
                    return;
                  }
                  disable2FAMutation.mutate({ token: disable2FAInput, pin: disable2FAInput });
                }}
                disabled={disable2FAMutation.isPending || disable2FAInput.length !== 6}
                variant="destructive"
                className="w-full"
              >
                {disable2FAMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Disabling 2FA...
                  </>
                ) : (
                  "Disable 2FA"
                )}
              </Button>
            </div>
          ) : (
            /* Enable 2FA Setup Flow */
            <div className="space-y-4">
              {generate2FAMutation.isPending || !twoFactorSetupData ? (
                <div className="flex flex-col items-center justify-center py-8 space-y-2">
                  <Loader2 className="w-8 h-8 animate-spin text-accent" />
                  <p className="text-xs text-zinc-400">Generating secret key...</p>
                </div>
              ) : (
                <>
                  {/* QR Code Container */}
                  <div className="flex justify-center p-4 bg-white rounded-xl mx-auto w-fit">
                    <QRCodeSVG 
                      value={twoFactorSetupData.uri} 
                      size={160} 
                      level="M"
                      includeMargin={false}
                    />
                  </div>

                  {/* Secret Key Display */}
                  <div>
                    <Label className="text-xs text-zinc-400">Can't scan? Enter manually:</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Input
                        readOnly
                        value={twoFactorSetupData.secret}
                        className="bg-black border-zinc-800 text-accent font-mono text-xs tracking-wider"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="border-zinc-700 hover:bg-zinc-800"
                        onClick={() => {
                          navigator.clipboard.writeText(twoFactorSetupData.secret);
                          toast({ title: "Copied!", description: "Secret key copied to clipboard" });
                        }}
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Verify Code Input */}
                  <div>
                    <Label htmlFor="verify-2fa-token" className="text-xs text-zinc-300">
                      Enter 6-digit code from your app:
                    </Label>
                    <Input
                      id="verify-2fa-token"
                      type="text"
                      inputMode="numeric"
                      value={twoFactorVerifyToken}
                      onChange={(e) => setTwoFactorVerifyToken(e.target.value.replace(/\D/g, ''))}
                      placeholder="000000"
                      maxLength={6}
                      className="bg-black border-zinc-700 text-white font-mono text-center tracking-widest text-lg mt-1"
                    />
                  </div>

                  <Button
                    onClick={() => {
                      if (twoFactorVerifyToken.length !== 6) {
                        toast({ title: "Invalid Code", description: "Enter 6-digit verification code", variant: "destructive" });
                        return;
                      }
                      enable2FAMutation.mutate({
                        secret: twoFactorSetupData.secret,
                        token: twoFactorVerifyToken
                      });
                    }}
                    disabled={enable2FAMutation.isPending || twoFactorVerifyToken.length !== 6}
                    className="w-full bg-accent hover:bg-accent/90 text-black font-bold"
                  >
                    {enable2FAMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Verifying & Activating...
                      </>
                    ) : (
                      "Activate 2FA"
                    )}
                  </Button>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
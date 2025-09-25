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
import { Shield, Copy, LogOut, Users, Activity, TrendingUp, Gift, Hash, DollarSign, CheckCircle2, Loader2 } from "lucide-react";
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
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-3">
            <span className="text-2xl font-display font-bold text-primary">
              {user?.username?.[0]?.toUpperCase()}
            </span>
          </div>
          <p className="text-xl font-display font-bold">@{user?.username}</p>
          {user?.isAdmin && (
            <p className="text-xs text-yellow-500 mt-1">ADMIN</p>
          )}
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
    </div>
  );
}
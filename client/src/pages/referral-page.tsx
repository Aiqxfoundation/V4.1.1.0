import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { QRCodeSVG } from "qrcode.react";
import { 
  Users, 
  DollarSign, 
  Copy, 
  Check, 
  Share2, 
  Sparkles, 
  TrendingUp, 
  Gift, 
  QrCode, 
  Activity, 
  Zap, 
  ArrowRight,
  ShieldCheck,
  CheckCircle2
} from "lucide-react";
import { Link } from "wouter";

export default function ReferralPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [showQr, setShowQr] = useState(false);

  const referralCode = user?.referralCode || user?.username?.toUpperCase().slice(0, 8) || "";
  
  const referralLink = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/auth?ref=${encodeURIComponent(referralCode)}`;
  }, [referralCode]);

  const { data: referralData, isLoading } = useQuery<any>({
    queryKey: ['/api/referrals'],
    enabled: !!user,
    refetchInterval: 15000
  });

  const referralStats = {
    totalReferrals: referralData?.totalReferrals ?? 0,
    activeReferrals: referralData?.activeReferrals ?? 0,
    totalEarnings: parseFloat(referralData?.totalEarnings ?? user?.totalReferralEarnings ?? '0'),
    tier1Earnings: parseFloat(referralData?.tier1Earnings ?? '0'),
    tier2Earnings: parseFloat(referralData?.tier2Earnings ?? '0'),
    pendingCommissions: parseFloat(referralData?.pendingCommissions ?? user?.unclaimedReferralUsdt ?? '0'),
    hashBonus: user?.referralHashBonus || '0.00'
  };

  const referralsList: Array<{ id: string; username: string; status: string; hashPower: string; joinedAt: string }> =
    referralData?.referrals || [];

  const handleCopyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
    toast({ 
      title: "Link Copied!", 
      description: "Referral invite link copied to clipboard" 
    });
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(referralCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
    toast({ 
      title: "Code Copied!", 
      description: `Referral code ${referralCode} copied` 
    });
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: 'Join B2B Mining Network',
        text: `Start mining B2B tokens with 100 KH/s free bonus! Use my invitation code: ${referralCode}`,
        url: referralLink
      }).catch(() => {
        handleCopyLink();
      });
    } else {
      handleCopyLink();
    }
  };

  return (
    <div className="mobile-page bg-black text-white min-h-screen pb-24">
      {/* Header */}
      <div className="mobile-header bg-zinc-950/90 border-b border-zinc-800 backdrop-blur-md p-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#f7931a]/10 border border-[#f7931a]/30 flex items-center justify-center text-[#f7931a]">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white flex items-center gap-2">
              Referral Program
              <Badge className="bg-[#f7931a]/20 text-[#f7931a] text-[10px] font-mono border-[#f7931a]/30">
                10% + 5%
              </Badge>
            </h1>
            <p className="text-[11px] text-zinc-400">Invite partners & earn instant USDT</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-zinc-500 font-mono">TOTAL EARNED</p>
          <p className="text-sm font-bold text-emerald-400">
            ${referralStats.totalEarnings.toFixed(2)}
          </p>
        </div>
      </div>

      <div className="mobile-content p-4 space-y-4">
        {/* Referral Code & Share Card */}
        <Card className="bg-gradient-to-br from-zinc-900 to-zinc-950 border-zinc-800 text-white p-5 rounded-2xl shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#f7931a]" />
              Your Invitation Code
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowQr(!showQr)}
              className="h-7 text-xs text-zinc-400 hover:text-white flex items-center gap-1 p-1"
            >
              <QrCode className="w-4 h-4 text-[#f7931a]" />
              {showQr ? "Hide QR" : "Show QR"}
            </Button>
          </div>

          {/* Referral Code Display */}
          <div className="flex items-center justify-between bg-black/60 border border-zinc-700/80 rounded-xl p-3 mb-3">
            <div>
              <p className="text-[10px] text-zinc-500">REFERRAL CODE</p>
              <p className="text-lg font-mono font-extrabold text-[#f7931a] tracking-wider">
                {referralCode || "------"}
              </p>
            </div>
            <Button
              onClick={handleCopyCode}
              size="sm"
              className="bg-[#f7931a] hover:bg-[#e5851a] text-black font-semibold text-xs px-3 h-8 flex items-center gap-1"
            >
              {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedCode ? "Copied" : "Copy Code"}
            </Button>
          </div>

          {/* QR Code Container */}
          {showQr && (
            <div className="bg-white p-4 rounded-xl flex flex-col items-center justify-center mb-3 animate-in fade-in zoom-in-95">
              <QRCodeSVG value={referralLink} size={160} level="M" />
              <p className="text-[11px] text-zinc-600 mt-2 font-mono">Scan to Join via @{user?.username}</p>
            </div>
          )}

          {/* Referral Link Box */}
          <div className="space-y-1.5 mb-3">
            <p className="text-[11px] text-zinc-400">Shareable Invite Link:</p>
            <div className="bg-black/40 border border-zinc-800 rounded-lg p-2.5 text-xs font-mono text-zinc-300 break-all select-all">
              {referralLink || "Generating link..."}
            </div>
          </div>

          {/* Actions Grid */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={handleCopyLink}
              variant="outline"
              className="w-full border-zinc-700 hover:bg-zinc-800 text-zinc-200 text-xs py-2 flex items-center justify-center gap-1.5"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-[#f7931a]" />}
              {copiedLink ? "Link Copied!" : "Copy Link"}
            </Button>
            <Button
              onClick={handleShare}
              className="w-full bg-[#f7931a] hover:bg-[#e5851a] text-black font-semibold text-xs py-2 flex items-center justify-center gap-1.5"
            >
              <Share2 className="w-3.5 h-3.5" />
              Share Link
            </Button>
          </div>
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-2.5">
          <Card className="bg-zinc-950 border-zinc-800 p-3 text-center rounded-xl">
            <p className="text-[10px] text-zinc-500 font-mono">TOTAL REFS</p>
            <p className="text-lg font-bold text-white mt-0.5">{referralStats.totalReferrals}</p>
            <p className="text-[9px] text-zinc-400 mt-0.5">registered</p>
          </Card>
          <Card className="bg-zinc-950 border-zinc-800 p-3 text-center rounded-xl">
            <p className="text-[10px] text-zinc-500 font-mono">ACTIVE MINERS</p>
            <p className="text-lg font-bold text-[#f7931a] mt-0.5">{referralStats.activeReferrals}</p>
            <p className="text-[9px] text-emerald-400 mt-0.5">earning bonus</p>
          </Card>
          <Card className="bg-zinc-950 border-zinc-800 p-3 text-center rounded-xl">
            <p className="text-[10px] text-zinc-500 font-mono">HASH BONUS</p>
            <p className="text-lg font-bold text-blue-400 mt-0.5">+{referralStats.hashBonus}</p>
            <p className="text-[9px] text-zinc-400 mt-0.5">KH/s added</p>
          </Card>
        </div>

        {/* Commission Tiers */}
        <Card className="bg-zinc-950 border-zinc-800 p-4 rounded-xl">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-[#f7931a]" />
              Commission Tier Structure
            </h3>
            <span className="text-[10px] text-emerald-400 font-mono">Instant Payouts</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-3 text-center">
              <Badge className="bg-[#f7931a]/20 text-[#f7931a] border-[#f7931a]/30 text-[10px] font-mono mb-1.5">
                TIER 1 (DIRECT)
              </Badge>
              <p className="text-2xl font-black text-white">10%</p>
              <p className="text-[11px] text-zinc-400 mt-1">On all direct hash power purchases</p>
            </div>

            <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-3 text-center">
              <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-[10px] font-mono mb-1.5">
                TIER 2 (TEAM)
              </Badge>
              <p className="text-2xl font-black text-white">5%</p>
              <p className="text-[11px] text-zinc-400 mt-1">On secondary team power purchases</p>
            </div>
          </div>
        </Card>

        {/* Recent Referral Activity List */}
        <Card className="bg-zinc-950 border-zinc-800 p-4 rounded-xl">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-[#f7931a]" />
              Referral Team ({referralsList.length})
            </h3>
            <Link href="/account">
              <span className="text-[11px] text-[#f7931a] hover:underline cursor-pointer flex items-center gap-1">
                Account Slots <ArrowRight className="w-3 h-3" />
              </span>
            </Link>
          </div>

          {referralsList.length === 0 ? (
            <div className="text-center py-6 text-zinc-500 text-xs">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-30 text-zinc-500" />
              <p>No referrals registered yet.</p>
              <p className="text-[11px] text-zinc-600 mt-1">Share your link to recruit miners and earn rewards!</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {referralsList.map((ref, idx) => (
                <div 
                  key={ref.id || idx}
                  className="flex items-center justify-between p-2.5 bg-zinc-900/60 border border-zinc-800/80 rounded-lg text-xs"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-[#f7931a]/10 border border-[#f7931a]/20 flex items-center justify-center font-bold text-[#f7931a] text-xs">
                      {ref.username?.[0]?.toUpperCase() || "U"}
                    </div>
                    <div>
                      <p className="font-semibold text-white font-mono">@{ref.username}</p>
                      <p className="text-[10px] text-zinc-500">
                        Joined {ref.joinedAt ? new Date(ref.joinedAt).toLocaleDateString() : 'Recently'}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <Badge 
                      className={`text-[9px] py-0 px-1.5 ${
                        ref.status === 'mining' 
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
                          : 'bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      {ref.status === 'mining' ? '● Mining' : 'Inactive'}
                    </Badge>
                    <p className="text-[10px] text-zinc-400 font-mono mt-0.5">
                      {parseFloat(ref.hashPower || '0') > 0 ? `${ref.hashPower} KH/s` : '0 KH/s'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Benefits Explainer */}
        <Card className="bg-zinc-950/80 border-zinc-800/80 p-4 rounded-xl text-xs space-y-2">
          <h4 className="font-semibold text-zinc-300 flex items-center gap-1.5 text-xs">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            Referral Program Rules & Anti-Abuse
          </h4>
          <ul className="space-y-1.5 text-[11px] text-zinc-400 list-disc list-inside leading-relaxed">
            <li>New invited miners automatically receive free 100 KH/s starter hashrate upon starting.</li>
            <li>Direct referrers receive 10% USDT commission on hash power purchases.</li>
            <li>You receive an ongoing +5% hashrate bonus on your mining speed from active referrals.</li>
            <li>Self-referral farming via multiple devices on the same IP is strictly monitored and flagged.</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
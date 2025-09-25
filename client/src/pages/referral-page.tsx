import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function ReferralPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  
  const referralLink = `https://gbtc.app/ref/${user?.username}`;
  
  // Mock referral data - replace with real API
  const referralStats = {
    tier1Count: 23,
    tier2Count: 147,
    tier1Earnings: 234.50,
    tier2Earnings: 73.25,
    totalEarnings: 307.75,
    pendingCommissions: 45.00,
    lifetimeEarnings: 892.30
  };

  const recentReferrals = [
    { username: 'user123', tier: 1, earned: 10, date: '2h ago' },
    { username: 'miner456', tier: 1, earned: 25, date: '5h ago' },
    { username: 'crypto789', tier: 2, earned: 5, date: '1d ago' },
    { username: 'trader321', tier: 1, earned: 50, date: '2d ago' },
    { username: 'investor654', tier: 2, earned: 2.5, date: '3d ago' }
  ];

  const handleCopyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 500);
    toast({ 
      title: "Link Copied!", 
      description: "Referral link copied to clipboard" 
    });
  };

  return (
    <div className="mobile-page">
      {/* Header */}
      <div className="mobile-header">
        <div>
          <h1 className="text-lg font-display font-bold text-primary">REFERRAL PROGRAM</h1>
          <p className="text-xs text-muted-foreground font-mono">
            Earn 10% + 5% Commission
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground font-mono">TOTAL EARNED</p>
          <p className="text-sm font-display font-bold text-accent">
            ${referralStats.totalEarnings.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="mobile-content">
        {/* Referral Link */}
        <Card className="mobile-card bg-gradient-to-br from-primary/10 to-chart-4/10">
          <p className="text-sm font-mono text-muted-foreground mb-3">YOUR REFERRAL LINK</p>
          
          <div className="bg-background rounded-lg p-3 mb-3">
            <p className="text-xs font-mono break-all">
              {referralLink}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={handleCopyLink}
              variant="outline"
              className="w-full"
              data-testid="button-copy-referral"
            >
              <i className={`fas fa-${copied ? 'check' : 'copy'} mr-2`}></i>
              {copied ? 'Copied!' : 'Copy'}
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                if (navigator.share) {
                  navigator.share({
                    title: 'Join B2B Mining',
                    text: 'Start mining B2B with me!',
                    url: referralLink
                  });
                }
              }}
              data-testid="button-share-referral"
            >
              <i className="fas fa-share-alt mr-2"></i>
              Share
            </Button>
          </div>
        </Card>

        {/* Commission Structure */}
        <Card className="mobile-card">
          <p className="text-sm font-mono text-muted-foreground mb-3">COMMISSION STRUCTURE</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center p-3 bg-primary/10 rounded-lg">
              <i className="fas fa-user text-2xl text-primary mb-2"></i>
              <p className="text-xs text-muted-foreground mb-1">TIER 1</p>
              <p className="text-xl font-display font-bold text-primary">10%</p>
              <p className="text-xs text-muted-foreground">Direct</p>
            </div>
            <div className="text-center p-3 bg-chart-4/10 rounded-lg">
              <i className="fas fa-users text-2xl text-chart-4 mb-2"></i>
              <p className="text-xs text-muted-foreground mb-1">TIER 2</p>
              <p className="text-xl font-display font-bold text-chart-4">5%</p>
              <p className="text-xs text-muted-foreground">Indirect</p>
            </div>
          </div>
        </Card>

        {/* Referral Stats */}
        <Card className="mobile-card">
          <p className="text-sm font-mono text-muted-foreground mb-3">YOUR STATS</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1">TIER 1 REFS</p>
              <p className="text-lg font-display font-bold text-primary">
                {referralStats.tier1Count}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">TIER 2 REFS</p>
              <p className="text-lg font-display font-bold text-chart-4">
                {referralStats.tier2Count}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">TIER 1 EARNED</p>
              <p className="text-lg font-display font-bold text-accent">
                ${referralStats.tier1Earnings.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">TIER 2 EARNED</p>
              <p className="text-lg font-display font-bold text-chart-3">
                ${referralStats.tier2Earnings.toFixed(2)}
              </p>
            </div>
          </div>
        </Card>

        {/* Pending Commissions */}
        {referralStats.pendingCommissions > 0 && (
          <Card className="mobile-card bg-accent/10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">PENDING COMMISSIONS</p>
                <p className="text-2xl font-display font-bold text-accent">
                  ${referralStats.pendingCommissions.toFixed(2)}
                </p>
              </div>
              <i className="fas fa-clock text-3xl text-accent/50"></i>
            </div>
          </Card>
        )}

        {/* Recent Referrals */}
        <Card className="mobile-card">
          <p className="text-sm font-mono text-muted-foreground mb-3">RECENT ACTIVITY</p>
          <div className="space-y-2">
            {recentReferrals.map((ref, index) => (
              <div key={index} className="flex items-center justify-between p-2 bg-background rounded">
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${
                    ref.tier === 1 ? 'bg-primary' : 'bg-chart-4'
                  }`}></div>
                  <div>
                    <p className="text-xs font-mono">{ref.username}</p>
                    <p className="text-xs text-muted-foreground">Tier {ref.tier}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-accent">+${ref.earned}</p>
                  <p className="text-xs text-muted-foreground">{ref.date}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* How it Works */}
        <Card className="mobile-card">
          <p className="text-sm font-mono text-muted-foreground mb-3">HOW IT WORKS</p>
          <div className="space-y-2 text-xs text-muted-foreground">
            <div className="flex items-start">
              <span className="mr-2">1.</span>
              <p>Share your unique referral link with friends</p>
            </div>
            <div className="flex items-start">
              <span className="mr-2">2.</span>
              <p>They sign up and purchase hash power</p>
            </div>
            <div className="flex items-start">
              <span className="mr-2">3.</span>
              <p>You earn 10% of their power purchases instantly</p>
            </div>
            <div className="flex items-start">
              <span className="mr-2">4.</span>
              <p>Earn 5% from their referrals (Tier 2)</p>
            </div>
            <div className="flex items-start">
              <span className="mr-2">5.</span>
              <p>Commissions paid in USDT to your balance</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  Key, 
  Shield, 
  Eye, 
  EyeOff, 
  Copy, 
  Check, 
  Download, 
  RefreshCw, 
  Lock, 
  Sparkles, 
  AlertTriangle,
  CheckCircle2,
  Loader2
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface AdminSecretKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Generate client-side cryptographic B2B key format
function generateLocalB2BKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const segments: string[] = [];
  const randomArray = new Uint8Array(20);
  window.crypto.getRandomValues(randomArray);
  
  for (let i = 0; i < 4; i++) {
    let seg = '';
    for (let j = 0; j < 5; j++) {
      seg += chars[randomArray[i * 5 + j] % chars.length];
    }
    segments.push(seg);
  }
  return `B2B-${segments.join('-')}`;
}

export default function AdminSecretKeyModal({ isOpen, onClose }: AdminSecretKeyModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [newKey, setNewKey] = useState("");
  const [currentKey, setCurrentKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [rotatedKey, setRotatedKey] = useState<string | null>(null);

  const handleGenerate = () => {
    const generated = generateLocalB2BKey();
    setNewKey(generated);
    setErrorMsg("");
  };

  const handleRotateKey = async () => {
    setErrorMsg("");
    const keyToSend = newKey.trim();
    if (keyToSend && keyToSend.length < 8) {
      setErrorMsg("Private Key must be at least 8 characters long.");
      return;
    }

    setIsRotating(true);
    try {
      const res = await apiRequest("POST", "/api/admin/change-private-key", {
        newAccessKey: keyToSend || "GENERATE",
        currentAccessKey: currentKey.trim() || undefined
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to rotate admin private key");
      }

      setRotatedKey(data.newAccessKey);
      toast({
        title: "🔑 Admin Key Updated!",
        description: `New master key successfully bound to @${user?.username}`,
        className: "bg-emerald-950 border-emerald-500/50 text-white"
      });
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to rotate admin key");
      toast({
        title: "Rotation Error",
        description: err.message || "Could not change private key",
        variant: "destructive"
      });
    } finally {
      setIsRotating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: "Key Copied",
      description: "Admin private key copied to clipboard"
    });
  };

  const downloadKeyFile = (key: string) => {
    const timestamp = new Date().toISOString();
    const content = `=====================================================
          B2B PLATFORM — MASTER ADMIN PRIVATE KEY
=====================================================

Account: ${user?.username}
Role: Master Administrator
Issued At: ${timestamp}
Network: B2B Mining Platform

PRIVATE ACCESS KEY:
${key}

IMPORTANT SECURITY NOTICE:
1. Store this private key in an encrypted vault.
2. This key is strictly required for all future Admin Logins.
3. If lost, rotation can only be performed by an active super_admin session.
=====================================================`;

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `b2b_admin_private_key_${user?.username || 'admin'}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Credentials Downloaded",
      description: "Secure text file saved to your device."
    });
  };

  const handleClose = () => {
    setNewKey("");
    setCurrentKey("");
    setRotatedKey(null);
    setErrorMsg("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="bg-zinc-950 border-zinc-800 text-white max-w-lg p-6 shadow-2xl rounded-2xl">
        <DialogHeader className="space-y-2 pb-2 border-b border-zinc-800/80">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#f7931a]/10 border border-[#f7931a]/30 flex items-center justify-center text-[#f7931a]">
                <Key className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                  Admin Private Key Management
                  <Badge className="bg-[#f7931a]/20 text-[#f7931a] border-[#f7931a]/30 text-[10px] font-mono">
                    SECRET
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-zinc-400">
                  Rotate and update your administrative credentials anytime
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        {rotatedKey ? (
          /* SUCCESS ROTATED STATE */
          <div className="space-y-5 pt-3">
            <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-xl p-4 text-emerald-200">
              <div className="flex items-center gap-2 font-semibold text-emerald-400 text-sm mb-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Private Key Successfully Rotated
              </div>
              <p className="text-xs text-emerald-300/80">
                Your admin private access key for <strong className="text-white">@{user?.username}</strong> has been updated in the database.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold text-zinc-300">New Admin Private Key</Label>
              <div className="relative flex items-center">
                <Input
                  readOnly
                  type={showKey ? "text" : "password"}
                  value={rotatedKey}
                  className="font-mono text-sm bg-zinc-900 border-zinc-700 text-emerald-400 pr-20"
                />
                <div className="absolute right-2 flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-zinc-400 hover:text-white"
                    onClick={() => setShowKey(!showKey)}
                  >
                    {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-zinc-400 hover:text-white"
                    onClick={() => copyToClipboard(rotatedKey)}
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </Button>
                </div>
              </div>
              <p className="text-[11px] text-zinc-400">
                Format: <span className="font-mono text-zinc-300">B2B-XXXXX-XXXXX-XXXXX-XXXXX</span>
              </p>
            </div>

            <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-3 text-xs space-y-1.5">
              <div className="flex items-center gap-1.5 text-[#f7931a] font-semibold text-xs">
                <AlertTriangle className="w-3.5 h-3.5" />
                Backup Required
              </div>
              <p className="text-zinc-400 text-[11px] leading-relaxed">
                Save this key now. Your session remains authenticated, but you will need this key for your next login.
              </p>
            </div>

            <div className="flex gap-2.5 pt-1">
              <Button
                variant="outline"
                className="flex-1 border-zinc-700 hover:bg-zinc-800 text-zinc-200 text-xs py-2 flex items-center justify-center gap-1.5"
                onClick={() => downloadKeyFile(rotatedKey)}
              >
                <Download className="w-3.5 h-3.5 text-[#f7931a]" />
                Download Credentials
              </Button>
              <Button
                className="flex-1 bg-[#f7931a] hover:bg-[#e5851a] text-black font-semibold text-xs py-2"
                onClick={handleClose}
              >
                Done & Saved
              </Button>
            </div>
          </div>
        ) : (
          /* FORM STATE */
          <div className="space-y-4 pt-3">
            {/* Account Info Pill */}
            <div className="flex items-center justify-between p-3 bg-zinc-900/80 border border-zinc-800 rounded-xl text-xs">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#f7931a]" />
                <span className="text-zinc-300">Admin Account:</span>
                <span className="font-semibold text-white font-mono">@{user?.username}</span>
              </div>
              <span className="text-emerald-400 text-[11px] font-mono flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse"></span>
                ACTIVE ADMIN
              </span>
            </div>

            {/* Input for New Key */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="admin-new-key" className="text-xs font-semibold text-zinc-300">
                  New Private Key
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[11px] text-[#f7931a] hover:bg-[#f7931a]/10 hover:text-[#f7931a] flex items-center gap-1 font-mono"
                  onClick={handleGenerate}
                >
                  <Sparkles className="w-3 h-3" />
                  Auto-Generate
                </Button>
              </div>

              <div className="relative flex items-center">
                <Input
                  id="admin-new-key"
                  type={showKey ? "text" : "password"}
                  placeholder="e.g. B2B-XXXXX-XXXXX-XXXXX-XXXXX or custom"
                  value={newKey}
                  onChange={(e) => {
                    setNewKey(e.target.value);
                    setErrorMsg("");
                  }}
                  className="font-mono text-sm bg-zinc-900 border-zinc-700 text-white pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-1.5 h-7 w-7 p-0 text-zinc-400 hover:text-white"
                  onClick={() => setShowKey(!showKey)}
                >
                  {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </Button>
              </div>
              <p className="text-[11px] text-zinc-500">
                Leave empty to automatically generate a random cryptographic B2B key.
              </p>
            </div>

            {/* Optional Current Key verification */}
            <div className="space-y-1.5">
              <Label htmlFor="admin-current-key" className="text-xs font-medium text-zinc-400">
                Current Key (Optional Verification)
              </Label>
              <Input
                id="admin-current-key"
                type="password"
                placeholder="Enter current key if verifying"
                value={currentKey}
                onChange={(e) => setCurrentKey(e.target.value)}
                className="font-mono text-xs bg-zinc-900/60 border-zinc-800 text-zinc-300"
              />
            </div>

            {errorMsg && (
              <div className="p-2.5 rounded-lg bg-red-950/40 border border-red-500/40 text-red-400 text-xs flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-3 text-[11px] text-zinc-400 space-y-1">
              <div className="font-semibold text-zinc-300 flex items-center gap-1.5">
                <Lock className="w-3 h-3 text-[#f7931a]" />
                Security Standard
              </div>
              <p className="leading-relaxed">
                The key is hashed via scrypt with unique salt before database storage. Audit logs will record this rotation under your admin ID.
              </p>
            </div>

            <div className="flex gap-2.5 pt-2">
              <Button
                variant="outline"
                className="flex-1 border-zinc-800 hover:bg-zinc-900 text-zinc-400 text-xs py-2.5"
                onClick={handleClose}
                disabled={isRotating}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-[#f7931a] hover:bg-[#e5851a] text-black font-semibold text-xs py-2.5 flex items-center justify-center gap-1.5"
                onClick={handleRotateKey}
                disabled={isRotating}
              >
                {isRotating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Updating Key...
                  </>
                ) : (
                  <>
                    <Key className="w-3.5 h-3.5" />
                    Rotate Private Key
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

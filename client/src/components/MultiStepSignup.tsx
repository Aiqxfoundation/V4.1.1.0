import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, 
  ArrowRight, 
  User, 
  Shield, 
  Users, 
  Key, 
  CheckCircle,
  Copy,
  Download,
  Eye,
  EyeOff,
  Loader2,
  AlertTriangle
} from "lucide-react";
import { useAuth, formatAccessKey } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { getDeviceFingerprint } from "@/lib/fingerprint";
import DisclaimerModal from "./DisclaimerModal";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface MultiStepSignupProps {
  onBack: () => void;
}

type SignupStep = 'disclaimer' | 'username' | 'referral' | 'keys' | 'complete';

const SIGNUP_STEPS = [
  { id: 'disclaimer' as const, title: 'Terms & Privacy', icon: Shield },
  { id: 'username' as const, title: 'Username', icon: User },
  { id: 'referral' as const, title: 'Referral Username', icon: Users },
  { id: 'keys' as const, title: 'Access Key', icon: Key }
];

export default function MultiStepSignup({ onBack }: MultiStepSignupProps) {
  const { registerMutation } = useAuth();
  const { toast } = useToast();
  
  const [currentStep, setCurrentStep] = useState<SignupStep>('disclaimer');
  const [signupData, setSignupData] = useState({
    username: '',
    referralUsername: '',
    deviceData: null as any
  });
  
  // Access key state
  const [generatedAccessKey, setGeneratedAccessKey] = useState<string | null>(null);
  const [showAccessKey, setShowAccessKey] = useState(false);

  const currentStepIndex = SIGNUP_STEPS.findIndex(step => step.id === currentStep);
  const progress = ((currentStepIndex + 1) / SIGNUP_STEPS.length) * 100;

  // Handle disclaimer acceptance
  const handleDisclaimerAccept = () => {
    setCurrentStep('username');
  };

  const handleDisclaimerDecline = () => {
    onBack();
  };

  // Handle username submission
  const handleUsernameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signupData.username.trim()) {
      toast({
        title: "Username required",
        description: "Please enter a username to continue",
        variant: "destructive",
      });
      return;
    }
    // Collect device fingerprint data
    try {
      const deviceData = await getDeviceFingerprint();
      setSignupData(prev => ({ 
        ...prev, 
        deviceData 
      }));
      setCurrentStep('referral');
    } catch (error) {
      toast({
        title: "Device verification failed",
        description: "Unable to collect device information. Please try again.",
        variant: "destructive",
      });
    }
  };


  // Handle referral username submission
  const handleReferralSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!signupData.referralUsername.trim()) {
      toast({
        title: "Referral username required",
        description: "Please enter a valid referral username to continue",
        variant: "destructive",
      });
      return;
    }
    
    try {
      // Check if test mode is enabled (only works for your specific device)
      const urlParams = new URLSearchParams(window.location.search);
      const testMode = urlParams.get('test');
      
      const result = await registerMutation.mutateAsync({
        username: signupData.username.trim(),
        referralUsername: signupData.referralUsername.trim(),
        deviceData: signupData.deviceData,
        ...(testMode === 'enabled' ? { testBypass: 'TEST2024' } : {})
      } as any);
      
      // Registration successful - show the access key
      setGeneratedAccessKey(result.accessKey);
      setCurrentStep('keys');
      
    } catch (error: any) {
      // Error handling is done by the mutation's onError handler in use-auth.tsx
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({
        title: "Copied to clipboard",
        description: `${label} copied to clipboard`,
      });
    });
  };

  const downloadAccessKey = () => {
    if (!generatedAccessKey) return;
    
    const content = `=======================================
           B2B ACCESS CREDENTIALS
=======================================

Username: ${signupData.username}
Access Key: ${generatedAccessKey}

=======================================
         IMPORTANT INSTRUCTIONS
=======================================

- Without your correct USERNAME and ACCESS KEY, you cannot access your account
- Both are unique and required for login  
- Store both safely - we cannot recover them if lost
- Keep this file secure and do not share with anyone

=======================================`;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `b2b-access-key-${signupData.username}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Access key downloaded",
      description: "Your access key has been saved to a text file. Store it securely!",
    });
  };

  const handleCompleteRegistration = () => {
    setCurrentStep('complete');
    
    // Automatically redirect to login after 3 seconds
    setTimeout(() => {
      onBack(); // Go back to login form
    }, 3000);
    
    toast({
      title: "Account Created Successfully!",
      description: "You can now login with your username and access key to start mining.",
      className: "border-[#f7931a] bg-gray-900 text-white",
    });
  };

  // Render disclaimer modal
  if (currentStep === 'disclaimer') {
    return (
      <DisclaimerModal
        open={true}
        onAccept={handleDisclaimerAccept}
      />
    );
  }


  // Render main signup flow
  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Progress Header */}
        <div className="mb-6 text-center">
          <div className="w-24 h-24 mx-auto mb-4 relative">
            <div className="absolute inset-0 bg-[#f7931a]/20 rounded-full animate-pulse"></div>
            <div className="relative w-full h-full bg-gradient-to-br from-[#f7931a] to-[#ff9416] rounded-full flex items-center justify-center shadow-2xl shadow-[#f7931a]/40">
              <span className="text-4xl font-bold text-black">₿</span>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Create B2B Account</h1>
          
          {/* Progress Steps */}
          <div className="space-y-3">
            <Progress 
              value={progress} 
              className="w-full h-2 bg-gray-800" 
              data-testid="signup-progress"
            />
            
            <div className="flex justify-center items-center gap-2 flex-wrap">
              {SIGNUP_STEPS.map((step, index) => {
                const Icon = step.icon;
                const isActive = step.id === currentStep;
                const isCompleted = index < currentStepIndex;
                
                return (
                  <Badge
                    key={step.id}
                    className={`text-xs ${
                      isCompleted
                        ? "bg-green-600 text-white"
                        : isActive
                        ? "bg-[#f7931a] text-black"
                        : "bg-gray-700 text-gray-400"
                    }`}
                  >
                    <Icon className="w-3 h-3 mr-1" />
                    {step.title}
                  </Badge>
                );
              })}
            </div>
          </div>
        </div>

        {/* Username Step */}
        {currentStep === 'username' && (
          <Card className="border-[#f7931a]/20 bg-gray-950">
            <CardHeader>
              <CardTitle className="text-center text-white flex items-center justify-center gap-2">
                <User className="w-5 h-5" />
                Choose Username
              </CardTitle>
              <p className="text-xs text-center text-gray-400">
                Select a unique username for your account
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUsernameSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="signup-username">Username</Label>
                  <Input
                    id="signup-username"
                    type="text"
                    placeholder="Choose a unique username"
                    value={signupData.username}
                    onChange={(e) => {
                      const value = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20);
                      setSignupData(prev => ({ ...prev, username: value }));
                    }}
                    required
                    autoComplete="off"
                    className="bg-black border-gray-800"
                    data-testid="input-signup-username"
                  />
                  <p className="text-xs text-gray-500 mt-1">Only letters, numbers, and underscores allowed</p>
                </div>
                
                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    onClick={() => setCurrentStep('disclaimer')}
                    className="flex-1 bg-gray-700 hover:bg-gray-600 text-white"
                    data-testid="button-back-to-disclaimer"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                  </Button>
                  <Button 
                    type="submit" 
                    className="flex-1 bg-[#f7931a] hover:bg-[#ff9416] text-black font-bold"
                    disabled={!signupData.username.trim()}
                    data-testid="button-continue"
                  >
                    Continue
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Referral Step */}
        {currentStep === 'referral' && (
          <Card className="border-[#f7931a]/20 bg-gray-950">
            <CardHeader>
              <CardTitle className="text-center text-white flex items-center justify-center gap-2">
                <Users className="w-5 h-5" />
                Referral Username
              </CardTitle>
              <p className="text-xs text-center text-gray-400">
                Enter the username of the person who invited you (required)
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleReferralSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="signup-referral">Referral Username (Required)</Label>
                  <Input
                    id="signup-referral"
                    type="text"
                    placeholder="Enter the username of who invited you"
                    value={signupData.referralUsername}
                    onChange={(e) => {
                      const value = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20);
                      setSignupData(prev => ({ ...prev, referralUsername: value }));
                    }}
                    required
                    className="bg-black border-gray-800 font-mono"
                    data-testid="input-signup-referral"
                  />
                  <p className="text-xs text-gray-500 mt-1">Enter the username of the person who invited you</p>
                </div>

                
                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    onClick={() => setCurrentStep('username')}
                    className="flex-1 bg-gray-700 hover:bg-gray-600 text-white"
                    data-testid="button-back"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                  </Button>
                  <Button 
                    type="submit" 
                    className="flex-1 bg-[#f7931a] hover:bg-[#ff9416] text-black font-bold"
                    disabled={registerMutation.isPending || !signupData.referralUsername.trim()}
                    data-testid="button-create-account"
                  >
                    {registerMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Key className="w-4 h-4 mr-2" />
                    )}
                    Create Account
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Access Key Display */}
        {currentStep === 'keys' && generatedAccessKey && (
          <Card className="border-[#f7931a]/20 bg-gray-950">
            <CardHeader>
              <CardTitle className="text-center text-white flex items-center justify-center gap-2">
                <Key className="w-5 h-5" />
                Your Access Key
              </CardTitle>
              <p className="text-xs text-center text-red-400">
                ⚠️ Save this now - we cannot recover it later!
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Access Key Display */}
              <div className="bg-black border-2 border-[#f7931a] rounded-lg p-4">
                <div className="space-y-2">
                  <Label className="text-sm text-gray-400">Username:</Label>
                  <div className="font-mono text-white text-sm bg-gray-800 p-2 rounded">
                    {signupData.username}
                  </div>
                  
                  <Label className="text-sm text-gray-400">Access Key:</Label>
                  <div className="relative">
                    <div className={`font-mono text-[#f7931a] text-sm font-bold p-2 bg-gray-800 rounded break-all ${
                      showAccessKey ? '' : 'text-security-disc'
                    }`}
                    style={showAccessKey ? {} : { WebkitTextSecurity: 'disc', textSecurity: 'disc' } as any}
                    >
                      {formatAccessKey(generatedAccessKey)}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute top-2 right-2 h-6 w-6 p-0 text-gray-400 hover:text-white"
                      onClick={() => setShowAccessKey(!showAccessKey)}
                      data-testid="button-toggle-key-visibility"
                    >
                      {showAccessKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2">
                <Button
                  onClick={() => copyToClipboard(generatedAccessKey, "Access key")}
                  className="w-full bg-gray-900 hover:bg-gray-800 border border-[#f7931a]/50 text-[#f7931a] font-semibold transition-all duration-200"
                  data-testid="button-copy-access-key"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copy Access Key
                </Button>

                <Button
                  onClick={downloadAccessKey}
                  className="w-full bg-gray-900 hover:bg-gray-800 border border-gray-700 text-gray-300 hover:text-white transition-all duration-200"
                  data-testid="button-download-access-key"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download as Text File
                </Button>
                
                <Button
                  onClick={handleCompleteRegistration}
                  className="w-full bg-gradient-to-r from-[#f7931a] to-[#ff9416] hover:from-[#ff9416] hover:to-[#f7931a] text-black font-bold shadow-lg shadow-[#f7931a]/30 transition-all duration-300"
                  data-testid="button-finish-registration"
                >
                  <ArrowRight className="w-4 h-4 mr-2" />
                  Continue
                </Button>
              </div>

              {/* Security reminder */}
              <Alert className="border-red-500/50 bg-red-500/10">
                <AlertTriangle className="h-4 w-4 text-red-400" />
                <AlertDescription className="text-red-400 text-xs">
                  <strong>CRITICAL:</strong> Your access key is your ONLY way to access your account. 
                  There is NO password recovery. Store it safely in multiple locations.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        )}

        {/* Success State */}
        {currentStep === 'complete' && (
          <Card className="border-green-500/20 bg-gray-950">
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <div className="w-20 h-20 mx-auto bg-green-600 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-10 h-10 text-white" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-green-400">Account Created Successfully!</h3>
                  <p className="text-gray-400 text-sm">
                    Redirecting to login page...
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
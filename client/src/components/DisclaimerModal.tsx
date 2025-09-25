import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface DisclaimerModalProps {
  open: boolean;
  onAccept: () => void;
}

export default function DisclaimerModal({ open, onAccept }: DisclaimerModalProps) {
  const [isAgreed, setIsAgreed] = useState(false);

  return (
    <AnimatePresence>
      {open && (
        <Dialog open={open} onOpenChange={() => {}} modal>
          <DialogContent 
            className="max-w-[500px] p-0 bg-black border border-[#f7931a]/30 [&>button]:hidden overflow-hidden" 
            data-testid="modal-disclaimer"
            onPointerDownOutside={(e) => e.preventDefault()}
            onEscapeKeyDown={(e) => e.preventDefault()}
            onInteractOutside={(e) => e.preventDefault()}
          >
            {/* Hidden for accessibility */}
            <DialogHeader className="sr-only">
              <DialogTitle>B2B Mining Platform Disclaimer</DialogTitle>
              <DialogDescription>
                Please read and accept the terms and conditions to continue
              </DialogDescription>
            </DialogHeader>

            <motion.div
              initial={{ y: -100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="relative"
            >
              {/* Header with Bitcoin Orange Accent */}
              <div className="bg-gradient-to-r from-[#f7931a] to-[#f7931a]/80 p-4">
                <h1 className="text-black font-bold text-lg text-center">B2B MINING PLATFORM</h1>
                <p className="text-black/80 text-xs text-center mt-1">Risk Disclosure & Terms of Service</p>
              </div>

              {/* Professional Whitepaper-Style Content */}
              <ScrollArea className="max-h-[400px]" data-testid="disclaimer-content">
                <div className="p-6 space-y-4 bg-gradient-to-b from-gray-950 to-black">
                  
                  {/* Executive Summary */}
                  <section>
                    <h2 className="text-[#f7931a] text-sm font-semibold mb-2 uppercase tracking-wider">Executive Summary</h2>
                    <p className="text-gray-300 text-xs leading-relaxed">
                      B2B Mining Platform represents an experimental virtual token ecosystem utilizing blockchain-inspired mechanics. 
                      This platform operates exclusively as a simulation environment with no real-world mining operations, 
                      energy consumption, or hardware requirements.
                    </p>
                  </section>

                  {/* Risk Disclosure */}
                  <section>
                    <h2 className="text-[#f7931a] text-sm font-semibold mb-2 uppercase tracking-wider">Risk Disclosure</h2>
                    <div className="bg-red-950/20 border border-red-500/30 rounded p-3">
                      <ul className="text-xs text-gray-300 space-y-1.5">
                        <li className="flex items-start">
                          <span className="text-red-400 mr-2">•</span>
                          <span>Complete loss of deposited funds is possible</span>
                        </li>
                        <li className="flex items-start">
                          <span className="text-red-400 mr-2">•</span>
                          <span>B2B tokens carry no guaranteed value or returns</span>
                        </li>
                        <li className="flex items-start">
                          <span className="text-red-400 mr-2">•</span>
                          <span>Experimental platform subject to technical failures</span>
                        </li>
                        <li className="flex items-start">
                          <span className="text-red-400 mr-2">•</span>
                          <span>No regulatory oversight or investor protections</span>
                        </li>
                      </ul>
                    </div>
                  </section>

                  {/* Platform Independence */}
                  <section>
                    <h2 className="text-[#f7931a] text-sm font-semibold mb-2 uppercase tracking-wider">Platform Independence</h2>
                    <div className="text-xs text-gray-300 space-y-1.5">
                      <p className="font-medium text-white">B2B Mining Platform operates as an independent entity:</p>
                      <ul className="ml-4 space-y-1">
                        <li>• Not affiliated with Bitcoin or Bitcoin Foundation</li>
                        <li>• Independent from all existing cryptocurrency organizations</li>
                        <li>• Developed by autonomous blockchain innovators</li>
                        <li>• B2B tokens are distinct from Bitcoin or any other cryptocurrency</li>
                      </ul>
                    </div>
                  </section>

                  {/* Privacy & Security Framework */}
                  <section>
                    <h2 className="text-[#f7931a] text-sm font-semibold mb-2 uppercase tracking-wider">Privacy & Security Framework</h2>
                    <div className="bg-gray-900/50 rounded p-3">
                      <p className="text-xs text-white font-medium mb-2">Enhanced Privacy Protection:</p>
                      <ul className="text-xs text-gray-300 space-y-1">
                        <li>✓ No KYC requirements or biometric data collection</li>
                        <li>✓ Referral-based access system for account creation</li>
                        <li>✓ Minimal data retention policy</li>
                        <li>✓ Device fingerprinting for security without privacy invasion</li>
                      </ul>
                      <p className="text-xs text-amber-400 mt-3">
                        ⚠ Note: While we prioritize privacy, no system is immune to security breaches or data vulnerabilities.
                      </p>
                    </div>
                  </section>

                  {/* Token Economics */}
                  <section>
                    <h2 className="text-[#f7931a] text-sm font-semibold mb-2 uppercase tracking-wider">Token Economics</h2>
                    <div className="text-xs text-gray-300 space-y-2">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-gray-900/30 rounded p-2">
                          <p className="text-[#f7931a] font-medium">Total Supply</p>
                          <p>21,000,000 B2B</p>
                        </div>
                        <div className="bg-gray-900/30 rounded p-2">
                          <p className="text-[#f7931a] font-medium">Block Time</p>
                          <p>1 Hour (UTC)</p>
                        </div>
                        <div className="bg-gray-900/30 rounded p-2">
                          <p className="text-[#f7931a] font-medium">Initial Reward</p>
                          <p>3,200 B2B</p>
                        </div>
                        <div className="bg-gray-900/30 rounded p-2">
                          <p className="text-[#f7931a] font-medium">Halving Period</p>
                          <p>3 Months</p>
                        </div>
                      </div>
                      <p className="text-amber-400 text-xs">
                        Mining ceases at 65.5% supply distribution (13,755,000 B2B)
                      </p>
                    </div>
                  </section>

                  {/* Legal Disclaimer */}
                  <section>
                    <h2 className="text-[#f7931a] text-sm font-semibold mb-2 uppercase tracking-wider">Legal Disclaimer</h2>
                    <div className="text-xs text-gray-400 leading-relaxed space-y-2">
                      <p>
                        This platform operates in an experimental capacity without regulatory approval. 
                        Participation constitutes acceptance of all associated risks including but not limited to:
                      </p>
                      <ul className="ml-4 space-y-0.5">
                        <li>• Complete financial loss</li>
                        <li>• Platform discontinuation</li>
                        <li>• Technical failures</li>
                        <li>• Market volatility</li>
                        <li>• Regulatory intervention</li>
                      </ul>
                      <p className="font-medium text-white mt-2">
                        NO WARRANTIES, EXPRESS OR IMPLIED, ARE PROVIDED.
                      </p>
                    </div>
                  </section>

                  {/* Participation Requirements */}
                  <section>
                    <h2 className="text-[#f7931a] text-sm font-semibold mb-2 uppercase tracking-wider">Participation Requirements</h2>
                    <div className="bg-[#f7931a]/10 border border-[#f7931a]/30 rounded p-3">
                      <ul className="text-xs text-gray-300 space-y-1.5">
                        <li className="flex items-center">
                          <span className="text-[#f7931a] mr-2">▸</span>
                          Must be 18 years or older
                        </li>
                        <li className="flex items-center">
                          <span className="text-[#f7931a] mr-2">▸</span>
                          Valid referral code required for registration
                        </li>
                        <li className="flex items-center">
                          <span className="text-[#f7931a] mr-2">▸</span>
                          Acknowledge experimental nature of platform
                        </li>
                        <li className="flex items-center">
                          <span className="text-[#f7931a] mr-2">▸</span>
                          Accept complete risk of loss
                        </li>
                      </ul>
                    </div>
                  </section>

                </div>
              </ScrollArea>

              {/* Agreement Section */}
              <div className="border-t border-gray-800 bg-gray-950 p-4">
                <div className="flex items-start gap-3 mb-4">
                  <Checkbox
                    id="agree"
                    checked={isAgreed}
                    onCheckedChange={(checked) => setIsAgreed(checked as boolean)}
                    className="mt-0.5 border-[#f7931a] data-[state=checked]:bg-[#f7931a] data-[state=checked]:border-[#f7931a]"
                    data-testid="checkbox-agree"
                  />
                  <label 
                    htmlFor="agree" 
                    className="text-xs text-gray-300 cursor-pointer leading-relaxed"
                  >
                    I acknowledge that I have read, understood, and accept all terms, conditions, and risks 
                    associated with the B2B Mining Platform. I confirm that I am participating voluntarily 
                    with full knowledge of potential complete loss of funds.
                  </label>
                </div>
                
                <Button
                  onClick={onAccept}
                  disabled={!isAgreed}
                  className="w-full bg-[#f7931a] hover:bg-[#f7931a]/90 text-black font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                  data-testid="button-accept-disclaimer"
                >
                  PROCEED TO PLATFORM
                </Button>
              </div>
            </motion.div>
          </DialogContent>
        </Dialog>
      )}
    </AnimatePresence>
  );
}
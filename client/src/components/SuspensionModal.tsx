import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SuspensionModalProps {
  isOpen: boolean;
  onClose: () => void;  // Add onClose callback
  isFrozen?: boolean;
  isSuspended?: boolean;
}

export function SuspensionModal({ isOpen, onClose, isFrozen, isSuspended }: SuspensionModalProps) {
  if (!isOpen) return null;

  const handleContactSupport = () => {
    // You can implement actual support contact functionality here
    // For now, we'll show an alert with contact information
    alert("Please contact support at: support@b2bmining.com");
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>  {/* Allow closing */}
      <DialogContent 
        className="bg-zinc-900 border-zinc-800 max-w-md"
        // Remove the prevention of closing
        // onPointerDownOutside={(e) => e.preventDefault()}
        // onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-white text-center flex items-center justify-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            Service Unavailable
          </DialogTitle>
          <DialogDescription className="text-gray-300 text-center mt-4">
            Your account access is currently restricted. Mining services are temporarily suspended. Please contact support for assistance.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center mt-6">
          <Button 
            className="w-full bg-red-600 hover:bg-red-700 text-white"
            onClick={handleContactSupport}
            data-testid="button-contact-support"
          >
            Contact Support
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
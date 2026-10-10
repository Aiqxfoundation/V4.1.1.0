import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertTriangle, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface SuspensionModalProps {
  isOpen: boolean;
  onClose: () => void;
  isFrozen?: boolean;
  isSuspended?: boolean;
}

export function SuspensionModal({ isOpen, onClose, isFrozen, isSuspended }: SuspensionModalProps) {
  const { toast } = useToast();
  if (!isOpen) return null;

  const handleContactSupport = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText("support@b2bmining.com");
    }
    toast({
      title: "Support Contact",
      description: "Support email copied: support@b2bmining.com"
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="suspension-modal-content bg-zinc-900 border-zinc-800 max-w-md text-white"
      >
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-white text-center flex items-center justify-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            Service Notice
          </DialogTitle>
          <DialogDescription className="text-gray-300 text-center mt-3 text-xs leading-relaxed">
            {isFrozen 
              ? "Your account has been temporarily frozen. Please contact customer operations to verify your credentials."
              : "Your account access is currently restricted. Mining operations require verification. Please contact support for assistance."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center mt-4 space-y-2">
          <Button 
            className="w-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center gap-2 text-xs"
            onClick={handleContactSupport}
            data-testid="button-contact-support"
          >
            <Mail className="w-4 h-4" />
            Copy Support Email (support@b2bmining.com)
          </Button>
          <Button 
            variant="outline"
            className="w-full border-zinc-700 text-zinc-300 hover:bg-zinc-800 text-xs"
            onClick={onClose}
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
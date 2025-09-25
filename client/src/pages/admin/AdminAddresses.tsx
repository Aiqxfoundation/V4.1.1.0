import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { 
  Plus, 
  Loader2, 
  Copy, 
  Trash2, 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  ToggleLeft, 
  ToggleRight,
  CheckCircle,
  XCircle,
  AlertCircle,
  FileText,
  Upload
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface DepositAddress {
  id: string;
  address: string;
  isActive: boolean;
  assignedToUserId?: string | null;
  assignedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function AdminAddresses() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // State for single address add
  const [newAddress, setNewAddress] = useState("");
  
  // State for bulk add
  const [bulkAddresses, setBulkAddresses] = useState("");
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  
  // State for pagination and filtering
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  
  // State for bulk actions
  const [selectedAddresses, setSelectedAddresses] = useState<Set<string>>(new Set());
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [addressToDelete, setAddressToDelete] = useState<DepositAddress | null>(null);
  const [bulkAction, setBulkAction] = useState<"activate" | "deactivate" | "delete" | null>(null);
  const [selectedAddress, setSelectedAddress] = useState<DepositAddress | null>(null);

  // Fetch all deposit addresses
  const { data: addresses, isLoading } = useQuery<DepositAddress[]>({
    queryKey: ["/api/admin/deposit-addresses"],
    enabled: !!user?.isAdmin,
    staleTime: 30000,
  });

  // Filter and paginate addresses
  const filteredAddresses = useMemo(() => {
    if (!addresses) return [];
    
    let filtered = addresses;
    
    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(addr => 
        addr.address.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Apply status filter
    if (statusFilter === "active") {
      filtered = filtered.filter(addr => addr.isActive);
    } else if (statusFilter === "inactive") {
      filtered = filtered.filter(addr => !addr.isActive);
    }
    
    return filtered;
  }, [addresses, searchTerm, statusFilter]);

  // Calculate pagination
  const totalPages = Math.ceil(filteredAddresses.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentAddresses = filteredAddresses.slice(startIndex, endIndex);

  // Calculate stats
  const stats = useMemo(() => {
    if (!addresses) return { total: 0, active: 0, inactive: 0 };
    
    return {
      total: addresses.length,
      active: addresses.filter(a => a.isActive).length,
      inactive: addresses.filter(a => !a.isActive).length,
    };
  }, [addresses]);

  // Add single address mutation
  const addAddressMutation = useMutation({
    mutationFn: async (address: string) => {
      const res = await apiRequest("POST", "/api/admin/deposit-addresses", { 
        address 
      });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Address added successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/deposit-addresses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/deposit-addresses/all"] });
      setNewAddress("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add address",
        variant: "destructive",
      });
    },
  });

  // Bulk add addresses mutation
  const bulkAddMutation = useMutation({
    mutationFn: async (addresses: string[]) => {
      const res = await apiRequest("POST", "/api/admin/deposit-addresses", { 
        addresses 
      });
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: data.message || `Successfully added ${data.count || 'multiple'} addresses`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/deposit-addresses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/deposit-addresses/all"] });
      setBulkAddresses("");
      setShowBulkAdd(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add addresses",
        variant: "destructive",
      });
    },
  });

  // Delete address mutation
  const deleteAddressMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/admin/deposit-addresses/${id}`);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Address deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/deposit-addresses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/deposit-addresses/all"] });
      setAddressToDelete(null);
      setShowDeleteDialog(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete address",
        variant: "destructive",
      });
    },
  });

  // Toggle address status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await apiRequest("PATCH", `/api/admin/deposit-addresses/${id}`, { 
        isActive 
      });
      return res.json();
    },
    onSuccess: (data, variables) => {
      toast({
        title: "Success",
        description: `Address ${variables.isActive ? 'activated' : 'deactivated'} successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/deposit-addresses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/deposit-addresses/all"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update address status",
        variant: "destructive",
      });
    },
  });

  // Bulk action mutation
  const bulkActionMutation = useMutation({
    mutationFn: async ({ action, addressIds }: { action: "activate" | "deactivate"; addressIds: string[] }) => {
      const res = await apiRequest("POST", "/api/admin/deposit-addresses/bulk-action", { 
        action,
        addressIds 
      });
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: data.message || "Bulk action completed successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/deposit-addresses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/deposit-addresses/all"] });
      setSelectedAddresses(new Set());
      setBulkAction(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to perform bulk action",
        variant: "destructive",
      });
    },
  });

  // Handlers
  const handleAddAddress = () => {
    const trimmedAddress = newAddress.trim();
    if (!trimmedAddress) {
      toast({
        title: "Error",
        description: "Please enter a valid address",
        variant: "destructive",
      });
      return;
    }
    addAddressMutation.mutate(trimmedAddress);
  };

  const handleBulkAdd = () => {
    const addressLines = bulkAddresses
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    
    if (addressLines.length === 0) {
      toast({
        title: "Error",
        description: "Please enter at least one address",
        variant: "destructive",
      });
      return;
    }
    
    // Validate addresses format
    const validAddressRegex = /^(0x[a-fA-F0-9]{40}|T[A-Za-z1-9]{33}|bc1[a-z0-9]{39,59})$/;
    const invalidAddresses = addressLines.filter(addr => !validAddressRegex.test(addr));
    
    if (invalidAddresses.length > 0) {
      toast({
        title: "Invalid Addresses Found",
        description: `${invalidAddresses.length} addresses have invalid format. Please check and try again.`,
        variant: "destructive",
      });
      return;
    }
    
    bulkAddMutation.mutate(addressLines);
  };

  const handleCopyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    toast({
      title: "Copied",
      description: "Address copied to clipboard",
    });
  };

  const handleDeleteAddress = (address: DepositAddress) => {
    setAddressToDelete(address);
    setShowDeleteDialog(true);
  };

  const confirmDelete = () => {
    if (addressToDelete) {
      deleteAddressMutation.mutate(addressToDelete.id);
    }
  };

  const handleToggleStatus = (id: string, currentStatus: boolean) => {
    toggleStatusMutation.mutate({ id, isActive: !currentStatus });
  };

  const handleSelectAll = () => {
    if (selectedAddresses.size === currentAddresses.length) {
      setSelectedAddresses(new Set());
    } else {
      setSelectedAddresses(new Set(currentAddresses.map(a => a.id)));
    }
  };

  const handleSelectAddress = (id: string) => {
    const newSelected = new Set(selectedAddresses);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedAddresses(newSelected);
  };

  const handleBulkAction = () => {
    if (!bulkAction || selectedAddresses.size === 0) return;
    
    if (bulkAction === "delete") {
      // For delete, we need to handle differently - delete one by one
      const addressIds = Array.from(selectedAddresses);
      Promise.all(addressIds.map(id => 
        apiRequest("DELETE", `/api/admin/deposit-addresses/${id}`)
      )).then(() => {
        toast({
          title: "Success",
          description: `Deleted ${addressIds.length} addresses`,
        });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/deposit-addresses"] });
        queryClient.invalidateQueries({ queryKey: ["/api/deposit-addresses/all"] });
        setSelectedAddresses(new Set());
        setBulkAction(null);
      }).catch((error) => {
        toast({
          title: "Error",
          description: "Failed to delete some addresses",
          variant: "destructive",
        });
      });
    } else {
      bulkActionMutation.mutate({ 
        action: bulkAction, 
        addressIds: Array.from(selectedAddresses) 
      });
    }
  };

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  if (!user?.isAdmin) {
    return <></>;
  }

  return (
    <div className="space-y-3 sm:space-y-6 px-2 sm:px-4 py-2">
      {/* Stats Cards - Desktop Only */}
      <div className="hidden sm:grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Addresses</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <FileText className="h-8 w-8 text-muted-foreground/50" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Addresses</p>
                <p className="text-2xl font-bold text-green-600">{stats.active}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600/50" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Inactive Addresses</p>
                <p className="text-2xl font-bold text-red-600">{stats.inactive}</p>
              </div>
              <XCircle className="h-8 w-8 text-red-600/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add Address Section */}
      <Card>
        <CardHeader>
          <CardTitle>Add Deposit Addresses</CardTitle>
          <CardDescription>
            Add single or multiple deposit addresses to the pool
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Toggle between single and bulk add */}
          <div className="flex gap-2">
            <Button
              variant={!showBulkAdd ? "default" : "outline"}
              onClick={() => setShowBulkAdd(false)}
              size="sm"
            >
              Single Address
            </Button>
            <Button
              variant={showBulkAdd ? "default" : "outline"}
              onClick={() => setShowBulkAdd(true)}
              size="sm"
            >
              <Upload className="h-4 w-4 mr-2" />
              Bulk Add
            </Button>
          </div>

          {!showBulkAdd ? (
            // Single address input
            <div className="flex gap-2">
              <Input
                placeholder="Enter deposit address (0x... or T... or bc1...)"
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddAddress()}
                data-testid="input-new-address"
                className="flex-1"
              />
              <Button 
                onClick={handleAddAddress}
                disabled={addAddressMutation.isPending || !newAddress.trim()}
                data-testid="button-add-address"
              >
                {addAddressMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Address
                  </>
                )}
              </Button>
            </div>
          ) : (
            // Bulk add textarea
            <div className="space-y-4">
              <Textarea
                placeholder="Paste multiple addresses here, one per line...&#10;0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb&#10;TRX1234567890abcdef&#10;bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"
                value={bulkAddresses}
                onChange={(e) => setBulkAddresses(e.target.value)}
                rows={10}
                className="font-mono text-sm"
                data-testid="textarea-bulk-addresses"
              />
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {bulkAddresses.split('\n').filter(line => line.trim()).length} addresses entered
                </p>
                <Button 
                  onClick={handleBulkAdd}
                  disabled={bulkAddMutation.isPending || !bulkAddresses.trim()}
                  data-testid="button-bulk-add"
                >
                  {bulkAddMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Add All Addresses
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Address List Section */}
      <Card>
        <CardHeader>
          <CardTitle>Manage Addresses</CardTitle>
          <CardDescription>
            View and manage all deposit addresses in the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters and Search */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search addresses..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="input-search"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
              <SelectTrigger className="w-[180px]" data-testid="select-status-filter">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Addresses</SelectItem>
                <SelectItem value="active">Active Only</SelectItem>
                <SelectItem value="inactive">Inactive Only</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={String(itemsPerPage)} onValueChange={(value) => setItemsPerPage(Number(value))}>
              <SelectTrigger className="w-[120px]" data-testid="select-items-per-page">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="25">25 / page</SelectItem>
                <SelectItem value="50">50 / page</SelectItem>
                <SelectItem value="100">100 / page</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Bulk Actions */}
          {selectedAddresses.size > 0 && (
            <div className="flex items-center gap-4 mb-4 p-4 bg-muted rounded-lg">
              <span className="text-sm font-medium">
                {selectedAddresses.size} selected
              </span>
              <Select value={bulkAction || ""} onValueChange={(value: any) => setBulkAction(value)}>
                <SelectTrigger className="w-[180px]" data-testid="select-bulk-action">
                  <SelectValue placeholder="Bulk action..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="activate">Activate Selected</SelectItem>
                  <SelectItem value="deactivate">Deactivate Selected</SelectItem>
                  <SelectItem value="delete">Delete Selected</SelectItem>
                </SelectContent>
              </Select>
              <Button
                onClick={handleBulkAction}
                disabled={!bulkAction || bulkActionMutation.isPending}
                size="sm"
                data-testid="button-apply-bulk-action"
              >
                {bulkActionMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Apply"
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedAddresses(new Set());
                  setBulkAction(null);
                }}
                size="sm"
              >
                Clear Selection
              </Button>
            </div>
          )}

          {/* Address Table */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredAddresses.length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {searchTerm || statusFilter !== "all" 
                  ? "No addresses found matching your filters" 
                  : "No deposit addresses added yet"}
              </p>
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="sm:hidden space-y-2">
                {currentAddresses.map((address) => (
                  <Card 
                    key={address.id}
                    className="bg-zinc-900 border-zinc-800 p-3 cursor-pointer active:bg-zinc-800"
                    onClick={() => setSelectedAddress(address)}
                  >
                    <div className="space-y-2">
                      <div className="flex justify-between items-start">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-mono truncate pr-2">
                            {address.address.slice(0, 12)}...{address.address.slice(-8)}
                          </p>
                          <p className="text-[10px] text-gray-400 mt-1">
                            {new Date(address.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <Badge className={address.isActive ? "bg-green-500/20 text-green-500 text-[10px]" : "bg-red-500/20 text-red-500 text-[10px]"}>
                          {address.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
              
              {/* Desktop Table View */}
              <div className="hidden sm:block overflow-x-auto">
                <div className="rounded-md border">
                  <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">
                        <Checkbox
                          checked={selectedAddresses.size === currentAddresses.length && currentAddresses.length > 0}
                          onCheckedChange={handleSelectAll}
                          data-testid="checkbox-select-all"
                        />
                      </TableHead>
                      <TableHead>Address</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Assigned</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentAddresses.map((address) => (
                      <TableRow key={address.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedAddresses.has(address.id)}
                            onCheckedChange={() => handleSelectAddress(address.id)}
                            data-testid={`checkbox-address-${address.id}`}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <code className="text-xs bg-muted px-2 py-1 rounded">
                              {address.address.slice(0, 6)}...{address.address.slice(-4)}
                            </code>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCopyAddress(address.address)}
                              data-testid={`button-copy-${address.id}`}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={address.isActive ? "default" : "secondary"}>
                            {address.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {address.assignedToUserId ? (
                            <Badge variant="outline">Assigned</Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {new Date(address.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleStatus(address.id, address.isActive)}
                              disabled={toggleStatusMutation.isPending}
                              data-testid={`button-toggle-${address.id}`}
                            >
                              {address.isActive ? (
                                <ToggleRight className="h-4 w-4 text-green-600" />
                              ) : (
                                <ToggleLeft className="h-4 w-4 text-gray-400" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteAddress(address)}
                              disabled={deleteAddressMutation.isPending}
                              data-testid={`button-delete-${address.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Showing {startIndex + 1} to {Math.min(endIndex, filteredAddresses.length)} of {filteredAddresses.length} addresses
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm">
                      Page {currentPage} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Address</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this address? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setAddressToDelete(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Address Detail Dialog */}
      <Dialog open={!!selectedAddress} onOpenChange={() => setSelectedAddress(null)}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-md">
          <DialogHeader>
            <DialogTitle>Address Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <p className="text-[10px] text-gray-400">Address</p>
              <div className="flex items-center gap-2">
                <p className="text-xs font-mono break-all">{selectedAddress?.address}</p>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="h-6 w-6 p-0"
                  onClick={() => {
                    navigator.clipboard.writeText(selectedAddress?.address || '');
                    toast({ title: "Copied!" });
                  }}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
            <div>
              <p className="text-[10px] text-gray-400">Status</p>
              <Badge className={selectedAddress?.isActive ? "bg-green-500/20 text-green-500" : "bg-red-500/20 text-red-500"}>
                {selectedAddress?.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            <div>
              <p className="text-[10px] text-gray-400">Created</p>
              <p className="text-sm">{new Date(selectedAddress?.createdAt || '').toLocaleString()}</p>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button
              variant={selectedAddress?.isActive ? "destructive" : "default"}
              className="flex-1"
              onClick={() => {
                if (selectedAddress) {
                  toggleStatusMutation.mutate({ id: selectedAddress.id, isActive: !selectedAddress.isActive });
                  setSelectedAddress(null);
                }
              }}
            >
              {selectedAddress?.isActive ? 'Deactivate' : 'Activate'}
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={() => {
                if (selectedAddress) {
                  setAddressToDelete(selectedAddress);
                  setSelectedAddress(null);
                  setShowDeleteDialog(true);
                }
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
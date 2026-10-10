import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { 
  ClipboardList, 
  Search, 
  ShieldCheck, 
  Clock, 
  Filter, 
  RefreshCw, 
  AlertCircle,
  UserCheck,
  Ban,
  Pause,
  DollarSign,
  Pickaxe
} from "lucide-react";

interface AuditLog {
  id: string;
  adminId: string;
  adminUsername: string;
  action: string;
  targetType: string;
  targetId: string | null;
  details: string | null;
  ipAddress: string | null;
  createdAt: string;
}

export default function AdminAuditLogs() {
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("all");

  const { data: logs = [], isLoading, refetch, isFetching } = useQuery<AuditLog[]>({
    queryKey: ["/api/admin/audit-logs"],
  });

  const filteredLogs = logs.filter((log) => {
    const matchesSearch = 
      log.adminUsername.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.targetId && log.targetId.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (log.details && log.details.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesAction = actionFilter === "all" || log.action === actionFilter;

    return matchesSearch && matchesAction;
  });

  const getActionBadge = (action: string) => {
    switch (action) {
      case "ADJUST_BALANCE":
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 flex items-center gap-1"><DollarSign className="w-3 h-3" /> Adjust Balance</Badge>;
      case "BAN_USER":
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30 flex items-center gap-1"><Ban className="w-3 h-3" /> Ban User</Badge>;
      case "UNBAN_USER":
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30 flex items-center gap-1"><UserCheck className="w-3 h-3" /> Unban User</Badge>;
      case "FREEZE_USER":
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 flex items-center gap-1"><Pause className="w-3 h-3" /> Freeze User</Badge>;
      case "UNFREEZE_USER":
        return <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30 flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> Unfreeze</Badge>;
      case "APPROVE_DEPOSIT":
        return <Badge className="bg-green-600/20 text-green-400 border-green-600/30">Approve Deposit</Badge>;
      case "REJECT_DEPOSIT":
        return <Badge className="bg-red-600/20 text-red-400 border-red-600/30">Reject Deposit</Badge>;
      case "APPROVE_WITHDRAWAL":
        return <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">Approve Withdrawal</Badge>;
      case "REJECT_WITHDRAWAL":
        return <Badge className="bg-rose-500/20 text-rose-400 border-rose-500/30">Reject Withdrawal</Badge>;
      case "MINE_BLOCK":
        return <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 flex items-center gap-1"><Pickaxe className="w-3 h-3" /> Mine Block</Badge>;
      default:
        return <Badge variant="outline" className="text-zinc-400">{action}</Badge>;
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <ClipboardList className="h-6 w-6 text-orange-500" />
              Admin Audit Logs
            </h1>
            <p className="text-sm text-zinc-400">
              Immutable ledger of all administrative security and operational actions.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800 w-fit"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Filters */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4 flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <Input
                placeholder="Search by admin, target ID, or action details..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-black border-zinc-800 text-white placeholder:text-zinc-600 focus:border-orange-500"
              />
            </div>
            <div className="w-full md:w-56">
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="bg-black border-zinc-800 text-white">
                  <SelectValue placeholder="Filter by action" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="ADJUST_BALANCE">Adjust Balance</SelectItem>
                  <SelectItem value="BAN_USER">Ban User</SelectItem>
                  <SelectItem value="UNBAN_USER">Unban User</SelectItem>
                  <SelectItem value="FREEZE_USER">Freeze User</SelectItem>
                  <SelectItem value="UNFREEZE_USER">Unfreeze User</SelectItem>
                  <SelectItem value="APPROVE_DEPOSIT">Approve Deposit</SelectItem>
                  <SelectItem value="REJECT_DEPOSIT">Reject Deposit</SelectItem>
                  <SelectItem value="APPROVE_WITHDRAWAL">Approve Withdrawal</SelectItem>
                  <SelectItem value="REJECT_WITHDRAWAL">Reject Withdrawal</SelectItem>
                  <SelectItem value="MINE_BLOCK">Mine Block</SelectItem>
                  <SelectItem value="ENABLE_2FA">Enable 2FA</SelectItem>
                  <SelectItem value="DISABLE_2FA">Disable 2FA</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Logs Table */}
        <Card className="bg-zinc-900 border-zinc-800 overflow-hidden">
          <CardHeader className="border-b border-zinc-800/80 p-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base text-white">Audit Entries ({filteredLogs.length})</CardTitle>
              <span className="text-xs text-zinc-500">Live synchronized</span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-12 text-center text-zinc-500">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-orange-500" />
                Loading audit trail...
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="p-12 text-center text-zinc-500">
                <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                No audit logs found matching your filters.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-black/50">
                    <TableRow className="border-zinc-800 hover:bg-transparent">
                      <TableHead className="text-zinc-400 font-mono text-xs">Timestamp</TableHead>
                      <TableHead className="text-zinc-400 font-mono text-xs">Admin</TableHead>
                      <TableHead className="text-zinc-400 font-mono text-xs">Action</TableHead>
                      <TableHead className="text-zinc-400 font-mono text-xs">Target</TableHead>
                      <TableHead className="text-zinc-400 font-mono text-xs">Details</TableHead>
                      <TableHead className="text-zinc-400 font-mono text-xs">IP Address</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.map((log) => (
                      <TableRow key={log.id} className="border-zinc-800 hover:bg-zinc-800/40">
                        <TableCell className="text-xs text-zinc-400 font-mono whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-sm font-semibold text-white">
                          {log.adminUsername}
                        </TableCell>
                        <TableCell>
                          {getActionBadge(log.action)}
                        </TableCell>
                        <TableCell className="text-xs font-mono text-zinc-300">
                          <span className="uppercase text-[10px] bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-400 mr-1.5">
                            {log.targetType}
                          </span>
                          {log.targetId ? log.targetId.slice(0, 16) + '...' : 'System'}
                        </TableCell>
                        <TableCell className="text-xs text-zinc-300 max-w-xs truncate" title={log.details || ''}>
                          {log.details || '—'}
                        </TableCell>
                        <TableCell className="text-xs font-mono text-zinc-500">
                          {log.ipAddress || 'internal'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}

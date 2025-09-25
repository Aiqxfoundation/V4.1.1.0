import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowDownCircle, 
  ArrowUpCircle, 
  SendHorizontal, 
  TrendingDown,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle
} from "lucide-react";
import { format } from "date-fns";

export default function TransactionsPage() {
  const { data: transactions, isLoading } = useQuery({
    queryKey: ["/api/transactions"]
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-orange-100 dark:from-gray-900 dark:to-gray-800 p-4">
        <div className="max-w-7xl mx-auto space-y-4">
          <Card className="animate-pulse">
            <CardHeader>
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
            </CardHeader>
            <CardContent>
              <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        );
      case "approved":
      case "completed":
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
            <CheckCircle className="w-3 h-3 mr-1" />
            {status === "approved" ? "Approved" : "Completed"}
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">
            <XCircle className="w-3 h-3 mr-1" />
            Rejected
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-300">
            <AlertCircle className="w-3 h-3 mr-1" />
            {status}
          </Badge>
        );
    }
  };

  const getNetworkBadge = (network: string) => {
    const networkColors: Record<string, string> = {
      'ERC20': 'bg-blue-50 text-blue-700 border-blue-300',
      'BSC': 'bg-yellow-50 text-yellow-700 border-yellow-300',
      'TRC20': 'bg-green-50 text-green-700 border-green-300',
      'B2B': 'bg-orange-50 text-orange-700 border-orange-300'
    };
    
    return (
      <Badge variant="outline" className={networkColors[network] || 'bg-gray-50 text-gray-700 border-gray-300'}>
        {network}
      </Badge>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-orange-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        <Card className="border-orange-200 dark:border-orange-800 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-orange-600 to-orange-500 text-white">
            <CardTitle className="text-2xl font-bold">Transaction History</CardTitle>
            <CardDescription className="text-orange-100">
              View all your deposits, withdrawals, and transfers
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <Tabs defaultValue="deposits" className="w-full">
              <TabsList className="grid w-full grid-cols-4 bg-orange-100 dark:bg-gray-800">
                <TabsTrigger value="deposits" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white">
                  <ArrowDownCircle className="w-4 h-4 mr-2" />
                  Deposits
                </TabsTrigger>
                <TabsTrigger value="withdrawals" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white">
                  <ArrowUpCircle className="w-4 h-4 mr-2" />
                  Withdrawals
                </TabsTrigger>
                <TabsTrigger value="sent" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white">
                  <SendHorizontal className="w-4 h-4 mr-2" />
                  Sent B2B
                </TabsTrigger>
                <TabsTrigger value="received" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white">
                  <TrendingDown className="w-4 h-4 mr-2" />
                  Received B2B
                </TabsTrigger>
              </TabsList>

              <TabsContent value="deposits" className="mt-6">
                <div className="space-y-3">
                  {transactions?.deposits?.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      No deposits found
                    </div>
                  ) : (
                    transactions?.deposits?.map((deposit: any) => (
                      <Card key={deposit.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start">
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-lg">${deposit.amount} USDT</span>
                                {getStatusBadge(deposit.status)}
                              </div>
                              <div className="text-sm text-gray-600 dark:text-gray-400">
                                <p>Method: {deposit.method}</p>
                                {deposit.proof && <p>Proof: {deposit.proof}</p>}
                                {deposit.adminNote && (
                                  <p className="text-orange-600 dark:text-orange-400">Admin Note: {deposit.adminNote}</p>
                                )}
                              </div>
                            </div>
                            <div className="text-sm text-gray-500">
                              {deposit.createdAt && format(new Date(deposit.createdAt), 'MMM dd, yyyy HH:mm')}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </TabsContent>

              <TabsContent value="withdrawals" className="mt-6">
                <div className="space-y-3">
                  {transactions?.withdrawals?.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      No withdrawals found
                    </div>
                  ) : (
                    transactions?.withdrawals?.map((withdrawal: any) => (
                      <Card key={withdrawal.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start">
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-lg">
                                  {withdrawal.amount} {withdrawal.network === 'B2B' ? 'B2B' : 'USDT'}
                                </span>
                                {getStatusBadge(withdrawal.status)}
                                {getNetworkBadge(withdrawal.network)}
                              </div>
                              <div className="text-sm text-gray-600 dark:text-gray-400">
                                <p>Address: {withdrawal.address}</p>
                                {withdrawal.txHash && (
                                  <p className="font-mono text-xs">Tx: {withdrawal.txHash}</p>
                                )}
                              </div>
                            </div>
                            <div className="text-sm text-gray-500">
                              {withdrawal.createdAt && format(new Date(withdrawal.createdAt), 'MMM dd, yyyy HH:mm')}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </TabsContent>

              <TabsContent value="sent" className="mt-6">
                <div className="space-y-3">
                  {transactions?.sentTransfers?.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      No sent transfers found
                    </div>
                  ) : (
                    transactions?.sentTransfers?.map((transfer: any) => (
                      <Card key={transfer.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start">
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-lg">{transfer.amount} B2B</span>
                                <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-300">
                                  <SendHorizontal className="w-3 h-3 mr-1" />
                                  Sent
                                </Badge>
                              </div>
                              <div className="text-sm text-gray-600 dark:text-gray-400">
                                <p>To: @{transfer.toUsername}</p>
                                <p className="font-mono text-xs">Tx: {transfer.txHash}</p>
                              </div>
                            </div>
                            <div className="text-sm text-gray-500">
                              {transfer.createdAt && format(new Date(transfer.createdAt), 'MMM dd, yyyy HH:mm')}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </TabsContent>

              <TabsContent value="received" className="mt-6">
                <div className="space-y-3">
                  {transactions?.receivedTransfers?.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      No received transfers found
                    </div>
                  ) : (
                    transactions?.receivedTransfers?.map((transfer: any) => (
                      <Card key={transfer.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start">
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-lg">{transfer.amount} B2B</span>
                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                                  <TrendingDown className="w-3 h-3 mr-1" />
                                  Received
                                </Badge>
                              </div>
                              <div className="text-sm text-gray-600 dark:text-gray-400">
                                <p>From: @{transfer.fromUsername}</p>
                                <p className="font-mono text-xs">Tx: {transfer.txHash}</p>
                              </div>
                            </div>
                            <div className="text-sm text-gray-500">
                              {transfer.createdAt && format(new Date(transfer.createdAt), 'MMM dd, yyyy HH:mm')}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Bike, Search, CheckCircle2, Clock, MapPin, Phone } from "lucide-react";

export function DeliveryManager() {
  const [searchTerm, setSearchTerm] = useState("");

  const deliveries = [
    { id: "101", customer: "João Silva", address: "Rua das Flores, 123", status: "saiu", value: 1500, courier: "Carlos (Moto)" },
    { id: "102", customer: "Maria Oliveira", address: "Av. Brasil, 500", status: "pendente", value: 850, courier: "-" },
    { id: "103", customer: "Pedro Santos", address: "Rua Sete, 45", status: "entregue", value: 2100, courier: "Marcos (Moto)" },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "saiu": return <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200">Saiu para Entrega</Badge>;
      case "entregue": return <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200">Entregue</Badge>;
      default: return <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100 border-yellow-200">Pendente</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="relative w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar entrega..." 
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button className="gap-2">
          <Bike className="h-4 w-4" /> Nova Entrega
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pedido</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Endereço</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Entregador</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deliveries.map((delivery) => (
                <TableRow key={delivery.id}>
                  <TableCell className="font-medium">#{delivery.id}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span>{delivery.customer}</span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Phone className="h-3 w-3" /> (11) 99999-9999
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm">
                      <MapPin className="h-3 w-3 text-muted-foreground" />
                      {delivery.address}
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(delivery.status)}</TableCell>
                  <TableCell>{delivery.courier}</TableCell>
                  <TableCell className="text-right font-semibold">
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(delivery.value)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm">Ações</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

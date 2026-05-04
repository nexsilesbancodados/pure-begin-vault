/**
 * Evolution API Client
 * Documentação: https://doc.evolution-api.com/
 */

// Todas as chamadas passam pelo proxy server route /api/evolution/*
// que injeta a URL e a API key da Evolution API a partir das secrets do servidor.
const API_URL = "/api/evolution";

export interface Instance {
  instanceName: string;
  instanceId: string;
  status: "open" | "close" | "connecting";
  owner?: string;
  profileName?: string;
  profilePictureUrl?: string;
}

const parseResponse = async (res: Response) => {
  const text = await res.text();
  const data = text ? safeJsonParse(text) : [];

  if (!res.ok) {
    const message =
      (typeof data === "object" && data && "message" in data && typeof data.message === "string" && data.message) ||
      text ||
      `Erro ${res.status} na Evolution API`;
    throw new Error(message);
  }

  return data;
};

const safeJsonParse = (value: string) => {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

export const evolution = {
  async getInstances() {
    const res = await fetch(`${API_URL}/instance/fetchInstances`);
    if (!res.ok) {
      const errorText = await res.text();
      console.error("Evolution API Error (fetchInstances):", res.status, errorText);
      throw new Error(`Falha ao buscar instâncias: ${res.status}`);
    }
    const raw = await res.json();
    // A Evolution API pode retornar array direto OU { instances: [...] }
    // e em v2 cada item vem como { instance: {...} } ou achatado.
    const list: any[] = Array.isArray(raw) ? raw : Array.isArray(raw?.instances) ? raw.instances : [];
    return list.map((item: any): Instance => {
      const i = item.instance ?? item;
      return {
        instanceName: i.instanceName ?? i.name ?? i.instance_name ?? "sem-nome",
        instanceId: i.instanceId ?? i.id ?? i.instance_id ?? String(i.instanceName ?? Math.random()),
        status: (i.status ?? i.connectionStatus ?? i.state ?? "close") as Instance["status"],
        owner: i.owner ?? i.ownerJid ?? i.number,
        profileName: i.profileName,
        profilePictureUrl: i.profilePictureUrl ?? i.profilePicUrl,
      };
    });
  },

   async createInstance(instanceName: string, webhookUrl?: string) {
     // Payload mínimo compatível com Evolution API v2.
     // Webhook e eventos podem ser configurados depois com setWebhook se necessário.
     const body: any = {
       instanceName,
       qrcode: true,
       integration: "WHATSAPP-BAILEYS",
     };
     if (webhookUrl) {
       body.webhook = { url: webhookUrl, enabled: true };
     }
     const res = await fetch(`${API_URL}/instance/create`, {
       method: "POST",
       headers: { "Content-Type": "application/json" },
       body: JSON.stringify(body),
     });
     const data = await res.json();
     if (!res.ok) {
       const msg =
         data?.response?.message?.[0] ||
         data?.message ||
         `Erro ${res.status} ao criar instância`;
       console.error("createInstance falhou:", data);
       throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
     }
     return data;
   },
 
   async setWebhook(instanceName: string, url: string) {
     const res = await fetch(`${API_URL}/webhook/set/${instanceName}`, {
       method: "POST",
       headers: {
         "Content-Type": "application/json",
       },
       body: JSON.stringify({
         enabled: true,
         url: url,
         webhook_by_events: false,
         events: [
           "MESSAGES_UPSERT",
           "MESSAGES_UPDATE",
           "MESSAGES_DELETE",
           "SEND_MESSAGE",
           "CONTACTS_UPSERT",
           "CONTACTS_UPDATE",
           "PRESENCE_UPDATE",
           "CHATS_UPSERT",
           "CHATS_UPDATE",
           "CHATS_DELETE",
           "GROUPS_UPSERT",
           "GROUPS_UPDATE",
           "GROUP_PARTICIPANTS_UPDATE",
           "CONNECTION_UPDATE",
           "CALL"
         ]
       }),
     });
     return res.json();
   },

   async getWebhook(instanceName: string) {
     try {
       const res = await fetch(`${API_URL}/webhook/find/${instanceName}`);
       if (!res.ok) return null;
       return await res.json();
     } catch {
       return null;
     }
   },

   async getQrCode(instanceName: string) {
     try {
       console.log(`Buscando QR Code para: ${instanceName}`);
        const res = await fetch(`${API_URL}/instance/connect/${instanceName}`);
       const data = await res.json();
       console.log("Resposta getQrCode:", data);
       return data;
     } catch (error) {
       console.error("Erro em getQrCode:", error);
       throw error;
     }
   },

  async findChats(instanceName: string) {
    const res = await fetch(`${API_URL}/chat/findChats/${instanceName}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    return parseResponse(res);
  },

  async fetchProfilePictureUrl(instanceName: string, number: string) {
    try {
      const res = await fetch(`${API_URL}/chat/fetchProfilePictureUrl/${instanceName}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ number }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return (data?.profilePictureUrl ?? data?.url ?? null) as string | null;
    } catch {
      return null;
    }
  },

  async findGroupInfo(instanceName: string, groupJid: string) {
    try {
      const res = await fetch(
        `${API_URL}/group/findGroupInfos/${instanceName}?groupJid=${encodeURIComponent(groupJid)}`,
      );
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  },

  async findMessages(instanceName: string, remoteJid: string) {
    const res = await fetch(`${API_URL}/chat/findMessages/${instanceName}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ where: { key: { remoteJid } } }),
    });
    return parseResponse(res);
  },

  async logoutInstance(instanceName: string) {
    const res = await fetch(`${API_URL}/instance/logout/${instanceName}`, {
      method: "DELETE",
    });
    return res.json();
  },

  async getInstanceConnection(instanceName: string) {
    const res = await fetch(`${API_URL}/instance/connectionState/${instanceName}`);
    return res.json();
  },

   async deleteInstance(instanceName: string) {
     const res = await fetch(`${API_URL}/instance/delete/${instanceName}`, {
       method: "DELETE",
     });
     return res.json();
   },

   async getConnectionState(instanceName: string) {
     try {
       const res = await fetch(`${API_URL}/instance/connectionState/${instanceName}`);
       if (!res.ok) return "disconnected";
       const data = await res.json();
       return (data?.instance?.state || data?.state || "disconnected") as "open" | "close" | "connecting" | "disconnected";
     } catch {
       return "disconnected";
     }
   }
};


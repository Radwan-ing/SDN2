export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export interface Customer {
  id?: string;
  customerNumber?: number;
  name: string;
  phone1: string;
  phone2?: string;
  companyName?: string;
  email?: string;
  notes?: string;
  createdAt: any;
}

export interface Invoice {
  id?: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  currency: string;
  totalCost: number;
  amountPaid: number;
  discount?: number;
  status: '10' | '20' | '30' | '40' | '50' | '60' | 'new' | 'in_progress' | 'ready' | 'delivered' | string;
  createdAt: any;
  updatedAt: any;
}

export interface InvoiceItem {
  id?: string;
  invoiceId: string;
  categoryId?: string;
  deviceName?: string;
  invoiceNumber?: string;
  deviceType: string;
  quantity: number;
  faultType: string;
  deviceNotes?: string;
  technicalNotes?: string;
  cost: number;
  status: '10' | '20' | '30' | '40' | '50' | '60' | 'new' | 'inspected' | 'ready' | 'unrepairable' | 'delivered' | string;
  subStatus?: 'intact' | 'unrepairable' | 'refused' | 'ready' | string;
  source?: 'inspection' | 'maintenance' | string;
  customerProblem?: string;
  engineerReport?: string;
  failureReason?: string;
  unitCost?: number;
  deliveredAt?: any;
  recipientName?: string;
  createdBy?: string; 
  technician?: string; 
  updatedAt?: any;
  updatedBy?: string; 
  customerName?: string;
  customerId?: string;
}

export interface Currency {
  id: string;
  code: string;
  name: string;
  symbol: string;
  isDefault?: boolean;
}

export interface DeviceType {
  id: string;
  name: string;
}

export interface User {
  id?: string;
  userNumber?: number;
  username: string;
  password?: string;
  name: string;
  role: 'admin' | 'manager' | 'data_entry';
  isPrimary?: boolean;
}

export interface VaultTransaction {
  id?: string;
  currency: string;
  amount: number;
  customerName: string;
  invoiceNumber: string;
  userName: string;
  userNumber?: number;
  userId: string;
  timestamp: any;
  type: 'invoice_payment' | 'manual_entry';
  notes?: string;
}

export interface Engineer {
  id?: string;
  name: string;
}

export interface MaintenanceAction {
  id?: string;
  engineerName: string;
  actionDate: any;
  notes?: string;
  updates: {
    itemId: string;
    oldStatus: string;
    newStatus: string;
    deviceType: string;
    quantity: number;
  }[];
  createdAt: any;
  userId: string;
  userName: string;
}

export interface ShopConfig {
  shopName: string;
  fiscalYear: string;
  logoUrl?: string;
  startDate: string;
  phone1?: string;
  phone2?: string;
  landline?: string;
  phone1Call?: boolean;
  phone1Whatsapp?: boolean;
  phone2Call?: boolean;
  phone2Whatsapp?: boolean;
  landlineCall?: boolean;
  landlineWhatsapp?: boolean;
  facebookUrl?: string;
  mapUrl?: string;
  email?: string;
  bio?: string;
  address?: string;
  bankYerName?: string;
  bankYerAccount?: string;
  bankSarName?: string;
  bankSarAccount?: string;
  bankUsdName?: string;
  bankUsdAccount?: string;
  bankHolderName?: string;
}

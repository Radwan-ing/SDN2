import React, { useEffect, useState } from 'react';
import { 
  FilePlus, 
  Package, 
  CheckCircle, 
  BarChart3, 
  Users, 
  Settings as SettingsIcon, 
  Database, 
  Search,
  ArrowUpRight,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  CircleDollarSign,
  X,
  Calendar,
  User as UserIcon,
  Tag,
  Cpu,
  MoreVertical,
  Smartphone
} from 'lucide-react';
import { collection, query, where, getDocs, onSnapshot, orderBy } from '../firebase';
import { db } from '../firebase';
import { VaultTransaction, InvoiceItem } from '../types';
import { useTranslation } from 'react-i18next';

export default function Dashboard({ onNavigate, shopName, fiscalYear }: { onNavigate: (tab: any) => void, shopName?: string, fiscalYear?: string }) {
  const { t } = useTranslation();
  const [vaultTotals, setVaultTotals] = useState<Record<string, number>>({
    RY: 0,
    SAR: 0,
    USD: 0
  });
  const [activeDevicesCount, setActiveDevicesCount] = useState(0);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<VaultTransaction[]>([]);

  useEffect(() => {
    // Listen to all vault transactions
    const qVault = query(collection(db, 'vault_transactions'));
    const unsubscribeVault = onSnapshot(qVault, (s) => {
      const totals: Record<string, number> = { RY: 0, SAR: 0, USD: 0 };
      const txs = s.docs.map(d => ({ id: d.id, ...d.data() } as VaultTransaction));
      
      txs.forEach(tx => {
        if (totals[tx.currency] !== undefined) {
          totals[tx.currency] += Number(tx.amount);
        }
      });
      
      setVaultTotals(totals);
      setTransactions(txs.sort((a, b) => {
        const timeA = a.timestamp?.toMillis ? a.timestamp.toMillis() : 0;
        const timeB = b.timestamp?.toMillis ? b.timestamp.toMillis() : 0;
        return timeB - timeA;
      }));
    });

    // Listen to active devices (status != 'delivered' && status != 'returned')
    const qDevices = query(collection(db, 'invoice_items'));
    const unsubscribeDevices = onSnapshot(qDevices, (snapshot) => {
      let count = 0;
      snapshot.forEach(doc => {
        const data = doc.data() as InvoiceItem;
        if (data.status !== 'delivered' && data.status !== 'returned') {
          count++;
        }
      });
      setActiveDevicesCount(count);
    });

    return () => {
      unsubscribeVault();
      unsubscribeDevices();
    };
  }, []);

  return (
    <div className="space-y-4 pb-10">
      {/* Top Card: Active Devices */}
      <div className="w-full bg-gradient-to-br from-orange-500 to-orange-600 text-white p-6 rounded-3xl shadow-lg relative overflow-hidden flex flex-col items-center text-center">
        {/* Faint Background Logo/Pattern Placeholder */}
        <div className="absolute opacity-10 -left-6 -top-6">
          <SettingsIcon size={120} />
        </div>
        
        <h2 className="text-sm font-bold font-cairo text-orange-50 mb-1 z-10">{shopName || 'عالم الصيانة والتجارة'}</h2>
        
        <div className="flex items-center justify-center gap-3 mt-3 z-10">
          <Smartphone size={28} className="text-orange-100" />
          <span className="text-4xl font-black tracking-widest text-white shadow-sm drop-shadow-md">{activeDevicesCount}</span>
        </div>
        
        <p className="text-sm font-medium mt-2 z-10 text-orange-50">الأجهزة النشطة في المحل</p>
      </div>

      {/* Quick Search */}
      <div className="w-full pt-1">
        <button 
          onClick={() => onNavigate('search')}
          className="w-full bg-white dark:bg-[#1a1a1a] py-3.5 px-5 rounded-2xl border border-gray-200 dark:border-white/5 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-white/5 transition-all group shadow-sm text-gray-500 dark:text-gray-400"
        >
          <div className="flex items-center gap-3 flex-1 text-right">
             <span className="text-sm font-bold font-cairo">البحث السريع</span>
          </div>
          <Search size={20} className="text-gray-400" />
        </button>
      </div>

      {/* Action Grid - 3x2 layout */}
      <div className="grid grid-cols-3 gap-3 md:gap-4 max-w-4xl mx-auto pt-2">
        <ActionCard 
          onClick={() => onNavigate('entry-exit')}
          icon={<FilePlus size={24} className="md:w-7 md:h-7" />} 
          label="دخول وخروج" 
          color="bg-orange-600 hover:bg-orange-700"
        />
        <ActionCard 
          onClick={() => onNavigate('device-movement')}
          icon={<SettingsIcon size={24} className="md:w-7 md:h-7" />} 
          label="قسم الصيانة" 
          color="bg-blue-600 hover:bg-blue-700"
        />
        <ActionCard 
          onClick={() => onNavigate('customers')}
          icon={<Users size={24} className="md:w-7 md:h-7" />} 
          label="العملاء" 
          color="bg-amber-500 hover:bg-amber-600"
        />
        <ActionCard 
          onClick={() => onNavigate('vault')}
          icon={<CircleDollarSign size={24} className="md:w-7 md:h-7" />} 
          label="الحسابات" 
          color="bg-emerald-600 hover:bg-emerald-700"
        />
        <ActionCard 
          onClick={() => onNavigate('inventory')}
          icon={<Package size={24} className="md:w-7 md:h-7" />} 
          label="المخزون" 
          color="bg-purple-600 hover:bg-purple-700"
        />
        <ActionCard 
          onClick={() => onNavigate('reports')}
          icon={<BarChart3 size={24} className="md:w-7 md:h-7" />} 
          label="التقارير" 
          color="bg-indigo-600 hover:bg-indigo-700"
        />
      </div>
    </div>
  );
}

function ActionCard({ icon, label, color, onClick }: { icon: React.ReactNode, label: string, color: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`p-4 rounded-2xl flex flex-col items-center justify-center gap-3 transition-all duration-300 group text-center border border-white/5 shadow-sm hover:shadow-md active:scale-95 aspect-square text-white ${color}`}
    >
      <div className="group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <div>
        <h3 className="font-bold text-xs md:text-sm leading-tight drop-shadow-sm">{label}</h3>
      </div>
    </button>
  );
}



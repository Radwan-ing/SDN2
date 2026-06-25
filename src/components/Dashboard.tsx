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
  MoreVertical
} from 'lucide-react';
import { collection, query, where, getDocs, onSnapshot, orderBy } from '../firebase';
import { db } from '../firebase';
import { VaultTransaction } from '../types';
import { useTranslation } from 'react-i18next';

export default function Dashboard({ onNavigate, shopName, fiscalYear }: { onNavigate: (tab: any) => void, shopName?: string, fiscalYear?: string }) {
  const { t } = useTranslation();
  const [vaultTotals, setVaultTotals] = useState<Record<string, number>>({
    RY: 0,
    SAR: 0,
    USD: 0
  });
  const [showHistory, setShowHistory] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<VaultTransaction[]>([]);

  useEffect(() => {
    // Listen to all vault transactions
    const q = query(collection(db, 'vault_transactions'));
    const unsubscribe = onSnapshot(q, (s) => {
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

    return () => unsubscribe();
  }, []);

  return (
    <div className="space-y-5 pb-10">
      <div className="flex justify-between items-center mb-4 px-1">
        <div className="text-xl font-bold font-cairo text-white tracking-tight">الرئيسية</div>
        <button 
          onClick={() => onNavigate('settings')}
          className="p-2 bg-[#1a1a1a] hover:bg-white/10 rounded-full border border-white/5 transition-all"
        >
          <MoreVertical size={24} className="text-gray-400 hover:text-white" />
        </button>
      </div>

      {/* Top Area: Quick Search */}
      <div className="w-full">
        {/* Quick Search (البحث السريع) */}
        <button 
          onClick={() => onNavigate('search')}
          className="w-full bg-[#1a1a1a] py-3 px-4 rounded-2xl border border-white/5 flex items-center justify-between hover:bg-white/5 transition-all group overflow-hidden"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500 group-hover:scale-105 transition-transform">
              <Search size={22} />
            </div>
            <div className="text-left rtl:text-right">
              <h3 className="text-base font-bold font-cairo">{t('common.search')}</h3>
              <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider mt-0.5">البحث السريع والفواتير</p>
            </div>
          </div>
          <ArrowUpRight className="text-gray-500 group-hover:text-emerald-500 transition-colors" size={18} />
        </button>
      </div>

      {/* Action Grid - 2x2 layout */}
      <div className="grid grid-cols-2 gap-4 max-w-4xl mx-auto">
        <ActionCard 
          onClick={() => onNavigate('entry-exit')}
          icon={<FilePlus size={28} className="lg:w-9 lg:h-9" />} 
          label="دخول وخروج أجهزة" 
          description="تسجيل ودخول وخروج الأجهزة"
          color="bg-orange-600 hover:bg-orange-700 text-white"
        />
        <ActionCard 
          onClick={() => onNavigate('device-movement')}
          icon={<SettingsIcon size={28} className="lg:w-9 lg:h-9" />} 
          label="قسم الصيانة" 
          description="حركة وقسم صيانة الأجهزة"
          color="bg-blue-600 hover:bg-blue-700 text-white"
        />
        <ActionCard 
          onClick={() => onNavigate('customers')}
          icon={<Users size={28} className="lg:w-9 lg:h-9" />} 
          label="العملاء" 
          description="إدارة بيانات وحسابات العملاء"
          color="bg-amber-500 hover:bg-amber-600 text-slate-950"
        />
        <ActionCard 
          onClick={() => onNavigate('vault')}
          icon={<CircleDollarSign size={28} className="lg:w-9 lg:h-9" />} 
          label="الحسابات" 
          description="إدارة حسابات وعمليات الخزينة"
          color="bg-emerald-600 hover:bg-emerald-700 text-white"
        />
        <ActionCard 
          onClick={() => onNavigate('inventory')}
          icon={<Package size={28} className="lg:w-9 lg:h-9" />} 
          label="المخزون" 
          description="إدارة مخزون الأجهزة"
          color="bg-purple-600 hover:bg-purple-700 text-white"
        />
        <ActionCard 
          onClick={() => onNavigate('reports')}
          icon={<BarChart3 size={28} className="lg:w-9 lg:h-9" />} 
          label="التقارير" 
          description="عرض تقارير النظام"
          color="bg-indigo-600 hover:bg-indigo-700 text-white"
        />
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string, value: string | number, icon: React.ReactNode, color: string }) {
  return (
    <div className="bg-[#1a1a1a] p-6 rounded-2xl border border-white/5 flex items-center justify-between">
      <div className="space-y-1">
        <p className="text-gray-400 text-sm font-medium">{label}</p>
        <p className="text-2xl font-bold">{value}</p>
      </div>
      <div className={`p-3 rounded-xl ${color}`}>
        {icon}
      </div>
    </div>
  );
}

function ActionCard({ icon, label, color, onClick }: { icon: React.ReactNode, label: string, description: string, color: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`p-6 rounded-[2rem] flex flex-col items-center justify-center gap-4 transition-all duration-300 group text-center ${color} border border-white/5 shadow-xl active:scale-95 aspect-square sm:aspect-auto sm:min-h-[160px]`}
    >
      <div className="p-4 bg-white/10 rounded-2xl group-hover:scale-110 transition-transform shadow-inner">
        {icon}
      </div>
      <div>
        <h3 className="font-bold text-lg md:text-xl leading-tight">{label}</h3>
      </div>
    </button>
  );
}



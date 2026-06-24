import React, { useState, useEffect } from 'react';
import { collection, getDocs } from '../firebase';
import { db } from '../firebase';
import { 
  Package, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  TrendingUp,
  Filter,
  ArrowRight,
  PlusCircle,
  Wrench,
  Search,
  AlertTriangle,
  Sparkles,
  MinusCircle,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Coins,
  FileText,
  BarChart3,
  Calendar,
  Layers,
  ArrowLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';

interface ReportStats {
  totalIncoming: number;
  inShopTotal: number;
  deliveredTotal: number;
  
  // In-shop sub stats
  inShopNew: number;
  inShopInspection: number;
  inShopRepairing: number;
  inShopAwaitingApproval: number;
  inShopAwaitingParts: number;
  inShopReady: number;

  // Delivered sub stats
  deliveredReadyCount: number;
  deliveredUnrepairableCount: number;
  deliveredIntactCount: number;
  deliveredRefusedCount: number;
  deliveredCancelledCount: number;
  
  // Financial stats
  revenueCollected: number;
  revenueAwaiting: number;
  averageTicket: number;
}

type TimeRange = 'today' | 'week' | 'month' | 'custom';
type SubView = 'none' | 'in-shop' | 'delivered';

// Helper to deduce item sub-status for legacy and unified statuses
function getItemSubStatus(item: any): string {
  if (item.subStatus) return item.subStatus;
  
  // Backwards compatibility with legacy status strings
  if (item.status === 'ready') return 'ready';
  if (item.status === 'intact') return 'intact';
  if (item.status === 'unrepairable') return 'unrepairable';
  if (item.status === 'refused') return 'refused';
  
  // For unified status codes
  if (item.status === '50' || item.status === '60' || item.status === 'delivered') {
    const report = (item.engineerReport || '').toLowerCase();
    const reason = (item.failureReason || '').toLowerCase();
    const notes = (item.technicalNotes || '').toLowerCase();
    
    if (reason.includes('لم يوافق') || report.includes('لم يوافق') || notes.includes('لم يوافق')) return 'refused';
    if (reason.includes('لا يصلح') || report.includes('لا يصلح') || reason.includes('unrepairable') || report.includes('unrepairable')) return 'unrepairable';
    if (report.includes('سليم') || report.includes('intact')) return 'intact';
    if (reason.includes('الغاء') || report.includes('الغاء') || reason.includes('cancel') || report.includes('cancel')) return 'cancelled';
    return 'ready';
  }
  
  return item.status || 'new';
}

export default function Reports({ onBack }: { onBack?: () => void }) {
  const { t } = useTranslation();
  const [stats, setStats] = useState<ReportStats>({
    totalIncoming: 0,
    inShopTotal: 0,
    deliveredTotal: 0,
    inShopNew: 0,
    inShopInspection: 0,
    inShopRepairing: 0,
    inShopAwaitingApproval: 0,
    inShopAwaitingParts: 0,
    inShopReady: 0,
    deliveredReadyCount: 0,
    deliveredUnrepairableCount: 0,
    deliveredIntactCount: 0,
    deliveredRefusedCount: 0,
    deliveredCancelledCount: 0,
    revenueCollected: 0,
    revenueAwaiting: 0,
    averageTicket: 0
  });

  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>('today');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Navigation & Sub-views states
  const [activeSubView, setActiveSubView] = useState<SubView>('none');
  const [inShopFilter, setInShopFilter] = useState<string>('all');
  const [deliveredFilter, setDeliveredFilter] = useState<string>('all');
  
  // Raw and filtered items cache for the table
  const [rawItems, setRawItems] = useState<any[]>([]);
  const [filteredPeriodItems, setFilteredPeriodItems] = useState<any[]>([]);
  const [itemInvoiceMap, setItemInvoiceMap] = useState<Map<string, any>>(new Map());

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const itemsSnap = await getDocs(collection(db, 'invoice_items'));
        const allItems = itemsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        setRawItems(allItems);

        const invoicesSnap = await getDocs(collection(db, 'invoices'));
        const allInvoices = invoicesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const invoiceMap = new Map<string, any>();
        allInvoices.forEach((inv: any) => {
          invoiceMap.set(String(inv.invoiceNumber), inv);
        });
        setItemInvoiceMap(invoiceMap);

        // Filter items based on selected time range
        const now = new Date();
        const periodItems = allItems.filter((item: any) => {
          const itemDate = item.createdAt?.toDate ? item.createdAt.toDate() : new Date(item.createdAt);
          if (isNaN(itemDate.getTime())) return false;

          if (timeRange === 'today') {
            return itemDate.toDateString() === now.toDateString();
          }
          if (timeRange === 'week') {
            const weekAgo = new Date();
            weekAgo.setDate(now.getDate() - 7);
            return itemDate >= weekAgo;
          }
          if (timeRange === 'month') {
            const monthAgo = new Date();
            monthAgo.setMonth(now.getMonth() - 1);
            return itemDate >= monthAgo;
          }
          if (timeRange === 'custom') {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            return itemDate >= start && itemDate <= end;
          }
          return true;
        });

        // Sort periodItems so the newest is at the top (highest invoiceNumber / newest date)
        periodItems.sort((a, b) => {
          const numA = Number(a.invoiceNumber) || 0;
          const numB = Number(b.invoiceNumber) || 0;
          if (numB !== numA) return numB - numA;
          
          const dateA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt).getTime();
          const dateB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt).getTime();
          return (Number(dateB) || 0) - (Number(dateA) || 0);
        });

        setFilteredPeriodItems(periodItems);

        // Sum helper
        const sumQuantity = (arr: any[]) => arr.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
        const sumCost = (arr: any[]) => arr.reduce((sum, item) => sum + (Number(item.cost) || 0), 0);

        // Separate In-Shop and Delivered within selected period
        const inShopItems = periodItems.filter(i => i.status !== '60' && i.status !== 'delivered');
        const deliveredItems = periodItems.filter(i => i.status === '60' || i.status === 'delivered');

        // Detailed In-Shop Classifications
        const inShopNew = inShopItems.filter(i => i.status === '10' || i.status === 'new');
        const inShopInspection = inShopItems.filter(i => i.status === '20' || i.status === 'inspected' || i.status === 'testing');
        const inShopRepairing = inShopItems.filter(i => i.status === '40' || i.status === 'repairing');
        const inShopAwaitingApproval = inShopItems.filter(i => i.status === '30' || i.status === 'awaiting_approval');
        const inShopAwaitingParts = inShopItems.filter(i => i.status === '35' || i.status === 'awaiting_parts');
        const inShopReady = inShopItems.filter(i => i.status === '50' || ['ready', 'intact', 'unrepairable', 'refused'].includes(i.status));

        // Detailed Delivered Classifications
        const deliveredReady = deliveredItems.filter(i => getItemSubStatus(i) === 'ready');
        const deliveredUnrepairable = deliveredItems.filter(i => getItemSubStatus(i) === 'unrepairable');
        const deliveredIntact = deliveredItems.filter(i => getItemSubStatus(i) === 'intact');
        const deliveredRefused = deliveredItems.filter(i => getItemSubStatus(i) === 'refused');
        const deliveredCancelled = deliveredItems.filter(i => getItemSubStatus(i) === 'cancelled');

        // Financial analytics
        const revenueCollected = sumCost(deliveredItems);
        const revenueAwaiting = sumCost(inShopItems);
        const avgTicket = periodItems.length > 0 ? (sumCost(periodItems) / periodItems.length) : 0;

        setStats({
          totalIncoming: sumQuantity(periodItems),
          inShopTotal: sumQuantity(inShopItems),
          deliveredTotal: sumQuantity(deliveredItems),
          
          inShopNew: sumQuantity(inShopNew),
          inShopInspection: sumQuantity(inShopInspection),
          inShopRepairing: sumQuantity(inShopRepairing),
          inShopAwaitingApproval: sumQuantity(inShopAwaitingApproval),
          inShopAwaitingParts: sumQuantity(inShopAwaitingParts),
          inShopReady: sumQuantity(inShopReady),

          deliveredReadyCount: sumQuantity(deliveredReady),
          deliveredUnrepairableCount: sumQuantity(deliveredUnrepairable),
          deliveredIntactCount: sumQuantity(deliveredIntact),
          deliveredRefusedCount: sumQuantity(deliveredRefused),
          deliveredCancelledCount: sumQuantity(deliveredCancelled),

          revenueCollected,
          revenueAwaiting,
          averageTicket: Math.round(avgTicket)
        });

      } catch (err) {
        console.error("Error fetching report metrics:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [timeRange, startDate, endDate]);

  const timeRangeLabels = {
    today: 'اليوم',
    week: 'أسبوع',
    month: 'شهر',
    custom: 'فترة محددة'
  };

  // Extract counts for device type distribution categories
  const getCategoryDistribution = () => {
    const counts: Record<string, number> = {};
    filteredPeriodItems.forEach((item) => {
      const type = item.deviceType || 'أخرى';
      counts[type] = (counts[type] || 0) + (Number(item.quantity) || 1);
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  };

  // Filtrations for the lower table depending on clicked sub stats
  const getSubViewTableItems = () => {
    const inShopItems = filteredPeriodItems.filter(i => i.status !== '60' && i.status !== 'delivered');
    const deliveredItems = filteredPeriodItems.filter(i => i.status === '60' || i.status === 'delivered');

    if (activeSubView === 'in-shop') {
      if (inShopFilter === 'all') return inShopItems;
      if (inShopFilter === 'new') return inShopItems.filter(i => i.status === '10' || i.status === 'new');
      if (inShopFilter === 'inspection') return inShopItems.filter(i => i.status === '20' || i.status === 'inspected' || i.status === 'testing');
      if (inShopFilter === 'repairing') return inShopItems.filter(i => i.status === '40' || i.status === 'repairing');
      if (inShopFilter === 'awaiting_approval') return inShopItems.filter(i => i.status === '30' || i.status === 'awaiting_approval');
      if (inShopFilter === 'awaiting_parts') return inShopItems.filter(i => i.status === '35' || i.status === 'awaiting_parts');
      if (inShopFilter === 'ready') return inShopItems.filter(i => i.status === '50' || ['ready', 'intact', 'unrepairable', 'refused'].includes(i.status));
    }

    if (activeSubView === 'delivered') {
      if (deliveredFilter === 'all') return deliveredItems;
      if (deliveredFilter === 'ready') return deliveredItems.filter(i => getItemSubStatus(i) === 'ready');
      if (deliveredFilter === 'unrepairable') return deliveredItems.filter(i => getItemSubStatus(i) === 'unrepairable');
      if (deliveredFilter === 'intact') return deliveredItems.filter(i => getItemSubStatus(i) === 'intact');
      if (deliveredFilter === 'refused') return deliveredItems.filter(i => getItemSubStatus(i) === 'refused');
      if (deliveredFilter === 'cancelled') return deliveredItems.filter(i => getItemSubStatus(i) === 'cancelled');
    }

    return [];
  };

  const tableItems = getSubViewTableItems();

  const getRevenueCollectedFormatted = () => {
    const deliveredItems = filteredPeriodItems.filter(i => i.status === '60' || i.status === 'delivered');
    const totals: { [cur: string]: number } = {};
    deliveredItems.forEach((it) => {
      const cur = itemInvoiceMap.get(String(it.invoiceNumber))?.currency || 'USD';
      totals[cur] = (totals[cur] || 0) + (Number(it.cost) || 0);
    });
    const entries = Object.entries(totals);
    if (entries.length === 0) return '0 USD';
    return entries.map(([cur, val]) => `${val.toLocaleString('en-US')} ${cur}`).join(' / ');
  };

  const getRevenueAwaitingFormatted = () => {
    const inShopItems = filteredPeriodItems.filter(i => i.status !== '60' && i.status !== 'delivered');
    const totals: { [cur: string]: number } = {};
    inShopItems.forEach((it) => {
      const cur = itemInvoiceMap.get(String(it.invoiceNumber))?.currency || 'USD';
      totals[cur] = (totals[cur] || 0) + (Number(it.cost) || 0);
    });
    const entries = Object.entries(totals);
    if (entries.length === 0) return '0 USD';
    return entries.map(([cur, val]) => `${val.toLocaleString('en-US')} ${cur}`).join(' / ');
  };

  const getAverageTicketFormatted = () => {
    if (filteredPeriodItems.length === 0) return '0 USD';
    const totals: { [cur: string]: number } = {};
    const counts: { [cur: string]: number } = {};
    filteredPeriodItems.forEach((it) => {
      const cur = itemInvoiceMap.get(String(it.invoiceNumber))?.currency || 'USD';
      totals[cur] = (totals[cur] || 0) + (Number(it.cost) || 0);
      counts[cur] = (counts[cur] || 0) + 1;
    });
    const entries = Object.entries(totals);
    return entries.map(([cur, val]) => {
      const avg = val / (counts[cur] || 1);
      return `${Math.round(avg).toLocaleString('en-US')} ${cur}`;
    }).join(' / ');
  };

  const getStatusArabicLabel = (status: string, sub?: string) => {
    const itemSub = sub || '';
    if (status === '60' || status === 'delivered') {
      if (itemSub === 'ready') return 'تم التسليم (جاهز)';
      if (itemSub === 'unrepairable') return 'تم التسليم (لا يصلح)';
      if (itemSub === 'intact') return 'تم التسليم (سليم)';
      if (itemSub === 'refused') return 'تم التسليم (لم يوافق العميل)';
      if (itemSub === 'cancelled') return 'تم التسليم (ملغى)';
      return 'تم التسليم';
    }
    if (status === '10' || status === 'new') return 'أجهزة جديدة';
    if (status === '20' || status === 'inspected' || status === 'testing') return 'قيد الفحص';
    if (status === '30' || status === 'awaiting_approval') return 'انتظار الموافقة والقطع';
    if (status === '35' || status === 'awaiting_parts') return 'انتظار قطع الغيار';
    if (status === '40' || status === 'repairing') return 'قيد الصيانة';
    if (status === '50' || ['ready', 'intact', 'unrepairable', 'refused'].includes(status)) return 'جاهز للتسليم';
    return status;
  };

  return (
    <div className="space-y-4 pb-12 text-right rtl" dir="rtl">
      {/* Unified Header */}
      <div className="flex items-center px-4 py-3 border-b border-white/10 bg-black/20" dir="rtl">
        <div className="flex items-center gap-2">
          {onBack && (
            <button 
              type="button"
              onClick={onBack}
              className="p-1.5 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-xl transition-all"
            >
              <ArrowLeft size={18} className="rtl:rotate-180" />
            </button>
          )}
          <div>
            <h1 className="text-lg font-black text-white m-0 p-0 flex items-center gap-2">
              <BarChart3 size={18} className="text-orange-500" />
              {t('common.reports', 'التقارير والإحصائيات')}
            </h1>
            <p className="text-[10px] text-gray-500 font-bold m-0 p-0 leading-none mt-1">
              {t('reports.subtitle', 'متابعة الأداء المالي والتشغيلي والأرباح بدقة')}
            </p>
          </div>
        </div>
      </div>

      {/* Top Controls & Time Period Selector */}
      <div className="bg-white/[0.02] p-4 rounded-3xl border border-white/5 space-y-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-600/15 text-orange-500 rounded-2xl">
              <Filter size={18} />
            </div>
            <div>
              <h2 className="text-base font-black text-white">التقارير دقيقة بدقيقة</h2>
              <p className="text-xs text-slate-400 font-bold">راقب أداء الورشة وحالة الأجهزة المالية والفنية فوراً</p>
            </div>
          </div>

          <div className="flex bg-black/40 p-1 rounded-2xl border border-white/5 w-full md:w-auto overflow-x-auto">
            {(['today', 'week', 'month', 'custom'] as TimeRange[]).map((range) => (
              <button
                key={range}
                onClick={() => {
                  setTimeRange(range);
                  // Reset filters
                  setInShopFilter('all');
                  setDeliveredFilter('all');
                }}
                className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all whitespace-nowrap flex-1 md:flex-none ${
                  timeRange === range 
                    ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' 
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {timeRangeLabels[range]}
              </button>
            ))}
          </div>
        </div>

        {timeRange === 'custom' && (
          <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-white/5 animate-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-3">
              <label className="text-xs font-black text-gray-400">من تاريخ</label>
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-black/60 border border-white/10 text-white text-xs px-4 py-2.5 rounded-xl focus:border-orange-500 outline-none font-bold"
              />
            </div>
            <div className="flex items-center gap-3">
              <label className="text-xs font-black text-gray-400">إلى تاريخ</label>
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-black/60 border border-white/10 text-white text-xs px-4 py-2.5 rounded-xl focus:border-orange-500 outline-none font-bold"
              />
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="h-60 flex flex-col items-center justify-center bg-white/[0.01] rounded-3xl border border-white/5 gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
          <p className="text-sm font-bold text-gray-400">جاري قراءة البيانات وإعداد المؤشرات والرسوم...</p>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          {activeSubView === 'none' && (
            <motion.div 
              key="main-dash"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-6"
            >
              {/* Device Counter Buttons (As specified by user - clickable buttons) */}
              <div className="space-y-3">
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <BarChart3 size={18} className="text-orange-500" />
                  أعداد ومؤشرات الأجهزة الصادرة والواردة
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* 1. Incoming Devices Counter Dashboard */}
                  <div className="bg-[#141414] p-6 rounded-[2rem] border border-white/5 relative overflow-hidden flex flex-col gap-2 transition-all">
                    <div className="absolute top-5 left-5 p-3.5 bg-blue-500/10 text-blue-500 rounded-2xl shadow-inner">
                      <TrendingUp size={24} />
                    </div>
                    <span className="text-gray-400 text-xs font-black tracking-wider">الأجهزة الداخلة</span>
                    <span className="text-5xl font-extrabold font-mono text-white mt-1">{stats.totalIncoming}</span>
                    <p className="text-xs text-gray-500 mt-2 font-bold leading-relaxed">
                      إجمالي الأجهزة التي تم استقبالها في الصيانة ضمن النطاق الزمني المحدد.
                    </p>
                  </div>

                  {/* 2. Devices in Shop (Button) */}
                  <motion.button 
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => {
                      setActiveSubView('in-shop');
                      setInShopFilter('all');
                    }}
                    className="bg-[#141414] p-6 rounded-[2rem] border border-white/5 relative overflow-hidden flex flex-col items-start gap-2 text-right transition-all hover:bg-white/[0.02] hover:border-orange-500/30 cursor-pointer group"
                  >
                    <div className="absolute top-5 left-5 p-3.5 bg-orange-500/10 text-orange-500 rounded-2xl group-hover:bg-orange-500 group-hover:text-white transition-all shadow-inner">
                      <Package size={24} />
                    </div>
                    <span className="text-gray-400 text-xs font-black tracking-wider">أجهزة موجودة في المحل</span>
                    <span className="text-5xl font-extrabold font-mono text-white mt-1 group-hover:text-orange-500 transition-colors">{stats.inShopTotal}</span>
                    <p className="text-xs text-gray-500 mt-2 font-bold leading-relaxed">
                      الأجهزة المتواجدة حالياً لورشتنا لتنفيذ أعمال الفحص والإبرام الفني والصيانة.
                    </p>
                    <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs font-black text-orange-500 w-full group-hover:text-orange-400">
                      <span>اضغط لاستعراض تقارير حالات المحل</span>
                      <ChevronLeft size={16} className="transition-transform group-hover:-translate-x-1" />
                    </div>
                  </motion.button>

                  {/* 3. Delivered/Outgoing Devices (Button) */}
                  <motion.button 
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => {
                      setActiveSubView('delivered');
                      setDeliveredFilter('all');
                    }}
                    className="bg-[#141414] p-6 rounded-[2rem] border border-white/5 relative overflow-hidden flex flex-col items-start gap-2 text-right transition-all hover:bg-white/[0.02] hover:border-emerald-500/30 cursor-pointer group"
                  >
                    <div className="absolute top-5 left-5 p-3.5 bg-emerald-500/10 text-emerald-500 rounded-2xl group-hover:bg-emerald-500 group-hover:text-white transition-all shadow-inner">
                      <CheckCircle2 size={24} />
                    </div>
                    <span className="text-gray-400 text-xs font-black tracking-wider">أجهزة خارجة</span>
                    <span className="text-5xl font-extrabold font-mono text-white mt-1 group-hover:text-emerald-500 transition-colors">{stats.deliveredTotal}</span>
                    <p className="text-xs text-gray-500 mt-2 font-bold leading-relaxed">
                      الأجهزة التي أكملت دورتها وخرجت للعميل (جاهزة، لا تصلح، سليم، ملغاة، إلخ).
                    </p>
                    <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs font-black text-emerald-500 w-full group-hover:text-emerald-400">
                      <span>اضغط لاستعراض تقارير الأجهزة الخارجة</span>
                      <ChevronLeft size={16} className="transition-transform group-hover:-translate-x-1" />
                    </div>
                  </motion.button>
                </div>
              </div>

              {/* Financial Performance Section (العداد المالي - saved for later stages but designed beautifully) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-black text-white flex items-center gap-2">
                    <Coins size={18} className="text-amber-500" />
                    الأداء المالي المحقق والدورة النقدية
                  </h3>
                  <span className="text-[10px] font-bold px-2 px-2.5 py-1 bg-amber-500/10 text-amber-500 rounded-lg">إصدار تجريبي</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-[#141414] p-5 rounded-[2rem] border border-white/5 flex items-center gap-4 relative overflow-hidden">
                    <div className="p-3.5 bg-emerald-500/10 text-emerald-500 rounded-2xl">
                      <Coins size={22} />
                    </div>
                    <div>
                      <h4 className="text-gray-400 text-xs font-black">المحصل من الأجهزة الصادرة</h4>
                      <div className="flex items-baseline gap-1 mt-1 flex-wrap">
                        <span className="text-lg font-black font-mono text-white">{getRevenueCollectedFormatted()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#141414] p-5 rounded-[2rem] border border-white/5 flex items-center gap-4 relative overflow-hidden">
                    <div className="p-3.5 bg-indigo-500/10 text-indigo-500 rounded-2xl">
                      <Wrench size={22} />
                    </div>
                    <div>
                      <h4 className="text-gray-400 text-xs font-black">القيمة المقدرة لأجهزة الصيانة بالداخل</h4>
                      <div className="flex items-baseline gap-1 mt-1 flex-wrap">
                        <span className="text-lg font-black font-mono text-white">{getRevenueAwaitingFormatted()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#141414] p-5 rounded-[2rem] border border-white/5 flex items-center gap-4 relative overflow-hidden">
                    <div className="p-3.5 bg-blue-500/10 text-blue-500 rounded-2xl">
                      <TrendingUp size={22} />
                    </div>
                    <div>
                      <h4 className="text-gray-400 text-xs font-black">متوسط الفاتورة لكل صيانة</h4>
                      <div className="flex items-baseline gap-1 mt-1 flex-wrap">
                        <span className="text-lg font-black font-mono text-white">{getAverageTicketFormatted()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Lower Level: Categories & Configured Reports */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Categories Device Type Distribution (توزيع الأجهزة حسب الصنف) */}
                <div className="lg:col-span-2 bg-[#141414] p-6 rounded-[2rem] border border-white/5 space-y-4">
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    <Layers size={18} className="text-purple-500" />
                    توزيع الأجهزة حسب الصنف والنوع
                  </h3>
                  
                  {getCategoryDistribution().length === 0 ? (
                    <div className="h-40 flex items-center justify-center text-xs text-gray-500 font-bold">
                      لا توجد أجهزة مضافة في هذه الفترة لحساب التوزيع.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {getCategoryDistribution().slice(0, 5).map((cat, idx) => {
                        const colors = ['bg-blue-500', 'bg-orange-500', 'bg-emerald-500', 'bg-pink-500', 'bg-purple-500'];
                        const percentage = stats.totalIncoming > 0 ? Math.round((cat.count / stats.totalIncoming) * 100) : 0;
                        return (
                          <div key={cat.name} className="space-y-2">
                            <div className="flex items-center justify-between text-xs font-bold text-gray-300">
                              <span className="flex items-center gap-2">
                                <span className={`w-2.5 h-2.5 rounded-full ${colors[idx % colors.length]}`}></span>
                                {cat.name}
                              </span>
                              <span className="font-mono text-white">{cat.count} جهاز ({percentage}%)</span>
                            </div>
                            <div className="w-full bg-white/5 h-2.5 rounded-full overflow-hidden">
                              <div className={`${colors[idx % colors.length]} h-full rounded-full`} style={{ width: `${percentage}%` }}></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Pre-configured / Ready Reports (التقارير الجاهزة) */}
                <div className="bg-[#141414] p-6 rounded-[2rem] border border-white/5 space-y-4">
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    <FileText size={18} className="text-cyan-500" />
                    تقارير جاهزة للاستخراج المباشر
                  </h3>

                  <div className="space-y-3">
                    <div className="p-3.5 bg-white/[0.02] border border-white/5 rounded-2xl flex items-center justify-between hover:bg-white/5 hover:border-white/10 transition-all cursor-pointer">
                      <div className="text-right">
                        <h4 className="text-xs font-black text-white">بيان الصيانة المنجزة اليومي</h4>
                        <p className="text-[10px] text-gray-500 font-bold mt-1">كشف بكل صيانة تم تسليمها وماليتها لليوم</p>
                      </div>
                      <span className="text-[9px] font-bold px-2 py-0.5 bg-cyan-500/10 text-cyan-500 rounded-md">قريباً</span>
                    </div>

                    <div className="p-3.5 bg-white/[0.02] border border-white/5 rounded-2xl flex items-center justify-between hover:bg-white/5 hover:border-white/10 transition-all cursor-pointer">
                      <div className="text-right">
                        <h4 className="text-xs font-black text-white">تقرير المعلقات والمتعطلات</h4>
                        <p className="text-[10px] text-gray-500 font-bold mt-1">بيان بالأجهزة التي تجاوزت 5 أيام بالورشة</p>
                      </div>
                      <span className="text-[9px] font-bold px-2 py-0.5 bg-cyan-500/10 text-cyan-500 rounded-md">قريباً</span>
                    </div>

                    <div className="p-3.5 bg-white/[0.02] border border-white/5 rounded-2xl flex items-center justify-between hover:bg-white/5 hover:border-white/10 transition-all cursor-pointer">
                      <div className="text-right">
                        <h4 className="text-xs font-black text-white">إنتاجية ومستحقات الفنيين والمهندسين</h4>
                        <p className="text-[10px] text-gray-500 font-bold mt-1">قياس دقة الأداء وحساب نسب ومستحقات الفحص</p>
                      </div>
                      <span className="text-[9px] font-bold px-2 py-0.5 bg-cyan-500/10 text-cyan-500 rounded-md">قريباً</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Sub View: In-Shop detailed reports (تقارير الأجهزة داخل المحل) */}
          {activeSubView === 'in-shop' && (
            <motion.div 
              key="in-shop-dash"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              {/* Back & Sub-Page Header Controls */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/5">
                <div>
                  <h3 className="text-xl font-black text-white flex items-center gap-2">
                    <Package size={22} className="text-orange-500" />
                    تقارير أجهزة داخل المحل
                  </h3>
                  <p className="text-xs text-gray-400 font-bold mt-1">توزيع كلي وفلترة دقيقة لجميع الأجهزة النشطة بالصيانة ({stats.inShopTotal} جهاز)</p>
                </div>
                
                <button 
                  onClick={() => setActiveSubView('none')}
                  className="bg-white/5 hover:bg-white/10 text-white font-bold px-5 py-2.5 rounded-xl text-xs flex items-center gap-2 transition-all border border-white/5 cursor-pointer"
                >
                  <ArrowRight size={14} className="text-orange-500" />
                  الرجوع للتقرير العام
                </button>
              </div>

              {/* Six Counters as specified representing each sub-status */}
              <div className="grid grid-cols-2 lg:grid-cols-6 gap-3.5">
                {/* 1. New Entry Counter Button */}
                <button 
                  onClick={() => setInShopFilter(inShopFilter === 'new' ? 'all' : 'new')}
                  className={`p-4 rounded-[2rem] border transition-all text-right flex flex-col justify-between h-32 ${
                    inShopFilter === 'new' 
                      ? 'border-blue-500 bg-blue-500/10' 
                      : 'border-white/5 bg-[#141414] hover:border-white/15'
                  }`}
                >
                  <div className="p-2.5 bg-blue-500/10 text-blue-500 rounded-xl self-start">
                    <PlusCircle size={18} />
                  </div>
                  <div>
                    <h4 className="text-gray-400 text-xs font-black">أجهزة جديدة</h4>
                    <p className="text-2xl font-black font-mono text-white mt-0.5">{stats.inShopNew}</p>
                  </div>
                </button>

                {/* 2. Over inspection Button */}
                <button 
                  onClick={() => setInShopFilter(inShopFilter === 'inspection' ? 'all' : 'inspection')}
                  className={`p-4 rounded-[2rem] border transition-all text-right flex flex-col justify-between h-32 ${
                    inShopFilter === 'inspection' 
                      ? 'border-amber-500 bg-amber-500/10' 
                      : 'border-white/5 bg-[#141414] hover:border-white/15'
                  }`}
                >
                  <div className="p-2.5 bg-amber-500/10 text-amber-500 rounded-xl self-start">
                    <Search size={18} />
                  </div>
                  <div>
                    <h4 className="text-gray-400 text-xs font-black">قيد الفحص</h4>
                    <p className="text-2xl font-black font-mono text-white mt-0.5">{stats.inShopInspection}</p>
                  </div>
                </button>

                {/* 3. Under Repair Button */}
                <button 
                  onClick={() => setInShopFilter(inShopFilter === 'repairing' ? 'all' : 'repairing')}
                  className={`p-4 rounded-[2rem] border transition-all text-right flex flex-col justify-between h-32 ${
                    inShopFilter === 'repairing' 
                      ? 'border-indigo-500 bg-indigo-500/10' 
                      : 'border-white/5 bg-[#141414] hover:border-white/15'
                  }`}
                >
                  <div className="p-2.5 bg-indigo-500/10 text-indigo-500 rounded-xl self-start">
                    <Wrench size={18} />
                  </div>
                  <div>
                    <h4 className="text-gray-400 text-xs font-black">قيد الصيانة</h4>
                    <p className="text-2xl font-black font-mono text-white mt-0.5">{stats.inShopRepairing}</p>
                  </div>
                </button>

                {/* 4. Awaiting Approval Button */}
                <button 
                  onClick={() => setInShopFilter(inShopFilter === 'awaiting_approval' ? 'all' : 'awaiting_approval')}
                  className={`p-4 rounded-[2rem] border transition-all text-right flex flex-col justify-between h-32 ${
                    inShopFilter === 'awaiting_approval' 
                      ? 'border-cyan-500 bg-cyan-500/10' 
                      : 'border-white/5 bg-[#141414] hover:border-white/15'
                  }`}
                >
                  <div className="p-2.5 bg-cyan-500/10 text-cyan-500 rounded-xl self-start">
                    <Clock size={18} />
                  </div>
                  <div>
                    <h4 className="text-gray-400 text-xs font-black">انتظار موافقة</h4>
                    <p className="text-2xl font-black font-mono text-white mt-0.5">{stats.inShopAwaitingApproval}</p>
                  </div>
                </button>

                {/* 5. Awaiting Parts Button */}
                <button 
                  onClick={() => setInShopFilter(inShopFilter === 'awaiting_parts' ? 'all' : 'awaiting_parts')}
                  className={`p-4 rounded-[2rem] border transition-all text-right flex flex-col justify-between h-32 ${
                    inShopFilter === 'awaiting_parts' 
                      ? 'border-violet-500 bg-violet-500/10' 
                      : 'border-white/5 bg-[#141414] hover:border-white/15'
                  }`}
                >
                  <div className={`p-2.5 rounded-xl self-start ${
                    inShopFilter === 'awaiting_parts'
                      ? 'bg-violet-500/25 text-violet-400'
                      : 'bg-violet-500/10 text-violet-500'
                  }`}>
                    <Cpu size={18} />
                  </div>
                  <div>
                    <h4 className="text-gray-400 text-xs font-black">انتظار قطع الغيار</h4>
                    <p className="text-2xl font-black font-mono text-white mt-0.5">{stats.inShopAwaitingParts}</p>
                  </div>
                </button>

                {/* 6. Ready Device Button */}
                <button 
                  onClick={() => setInShopFilter(inShopFilter === 'ready' ? 'all' : 'ready')}
                  className={`p-4 rounded-[2rem] border transition-all text-right flex flex-col justify-between h-32 ${
                    inShopFilter === 'ready' 
                      ? 'border-emerald-500 bg-emerald-500/10' 
                      : 'border-white/5 bg-[#141414] hover:border-white/15'
                  }`}
                >
                  <div className="p-2.5 bg-emerald-500/10 text-emerald-500 rounded-xl self-start">
                    <CheckCircle2 size={18} />
                  </div>
                  <div>
                    <h4 className="text-gray-400 text-xs font-black">جاهز للتسليم</h4>
                    <p className="text-2xl font-black font-mono text-white mt-0.5">{stats.inShopReady}</p>
                  </div>
                </button>
              </div>

              {/* Dynamic device list matching filtered button selection */}
              <div className="bg-[#141414] border border-white/5 rounded-3xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-black text-sm text-white flex items-center gap-2">
                    <BarChart3 size={16} className="text-orange-500" />
                    جدول الأجهزة المتوفرة الصادر عنها حالياً ( تصفية: {
                      inShopFilter === 'all' ? 'جميع أجهزة المحل' :
                      inShopFilter === 'new' ? 'أجهزة جديدة' :
                      inShopFilter === 'inspection' ? 'قيد الفحص حالياً' :
                      inShopFilter === 'repairing' ? 'قيد الصيانة النشطة' :
                      inShopFilter === 'awaiting_approval' ? 'في انتظار الموافقة والقطع' :
                      inShopFilter === 'ready' ? 'أجهزة جاهزة للتسليم' : 'أخرى'
                    } )
                  </h4>
                  <span className="text-xs text-gray-500 font-bold">إجمالي السجلات: {tableItems.length}</span>
                </div>

                {tableItems.length === 0 ? (
                  <div className="py-12 text-center text-xs text-gray-500 font-black">
                     لا توجد أجهزة مطابقة للفلترة الفعالة لهذا النطاق الزمني.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead>
                        <tr className="border-b border-white/5 text-gray-400 pb-3">
                          <th className="pb-3 pt-1 font-black px-2">رقم الفاتورة</th>
                          <th className="pb-3 pt-1 font-black px-2">اسم العميل</th>
                          <th className="pb-3 pt-1 font-black">نوع وصنف الجهاز</th>
                          <th className="pb-3 pt-1 font-black">المشكلة والتوصيف</th>
                          <th className="pb-3 pt-1 font-black text-left px-2">تكلفة التقدير</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tableItems.map((item) => (
                          <tr key={item.id} className="border-b border-white/[0.02] hover:bg-white/[0.01]">
                            <td className="py-4 font-mono text-[#fa5f1c] font-bold px-2">{item.invoiceNumber}</td>
                            <td className="py-4 text-white font-bold px-2">{item.customerName || 'مستلم عام'}</td>
                            <td className="py-4 font-black">
                              <span className="text-xs text-white">{item.deviceType || 'موبايل'}</span>
                              <span className="text-[10px] text-gray-400 block mt-0.5">{item.deviceName || 'غير محدد'}</span>
                            </td>
                            <td className="py-4 text-gray-400">
                              <span className="block max-w-xs truncate text-[11px]">{item.customerProblem || 'لم تسرد مواصفات'}</span>
                              {item.engineerReport && <span className="block text-[10px] text-orange-400 font-bold mt-1 max-w-xs truncate">التقرير: {item.engineerReport}</span>}
                              {(item.status === '35' || item.status === 'awaiting_parts') && item.failureReason && (
                                <span className="block text-[10px] text-violet-400 font-bold mt-1 max-w-xs truncate">ملاحظة القطع: {item.failureReason}</span>
                              )}
                            </td>
                            <td className="py-4 font-mono font-bold text-white text-left px-2">{(Number(item.cost) || 0).toLocaleString('en-US')} <span className="text-[10px] text-gray-500 font-black">{itemInvoiceMap.get(String(item.invoiceNumber))?.currency || 'USD'}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Sub View: Outgoing detailed reports (تقارير الأجهزة الخارجة) */}
          {activeSubView === 'delivered' && (
            <motion.div 
              key="delivered-dash"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              {/* Back & Sub-Page Header Controls */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/5">
                <div>
                  <h3 className="text-xl font-black text-white flex items-center gap-2">
                    <CheckCircle2 size={22} className="text-emerald-500" />
                    تقارير أجهزة خارجة
                  </h3>
                  <p className="text-xs text-gray-400 font-bold mt-1">تتبع الأجهزة والعمليات التي خرجت وغادرت المحل بالكامل ({stats.deliveredTotal} جهاز)</p>
                </div>
                
                <button 
                  onClick={() => setActiveSubView('none')}
                  className="bg-white/5 hover:bg-white/10 text-white font-bold px-5 py-2.5 rounded-xl text-xs flex items-center gap-2 transition-all border border-white/5 cursor-pointer"
                >
                  <ArrowRight size={14} className="text-orange-500" />
                  الرجوع للتقرير العام
                </button>
              </div>

              {/* Five Counters representing delivered states */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
                {/* 1. Delivered Repaired */}
                <button 
                  onClick={() => setDeliveredFilter(deliveredFilter === 'ready' ? 'all' : 'ready')}
                  className={`p-4 rounded-[2rem] border transition-all text-right flex flex-col justify-between h-32 ${
                    deliveredFilter === 'ready' 
                      ? 'border-emerald-500 bg-emerald-500/10' 
                      : 'border-white/5 bg-[#141414] hover:border-white/15'
                  }`}
                >
                  <div className="p-2.5 bg-emerald-500/10 text-emerald-500 rounded-xl self-start">
                    <CheckCircle2 size={18} />
                  </div>
                  <div>
                    <h4 className="text-gray-400 text-xs font-black">تم التسليم جاهز</h4>
                    <p className="text-2xl font-black font-mono text-white mt-0.5">{stats.deliveredReadyCount}</p>
                  </div>
                </button>

                {/* 2. Delivered Unrepairable */}
                <button 
                  onClick={() => setDeliveredFilter(deliveredFilter === 'unrepairable' ? 'all' : 'unrepairable')}
                  className={`p-4 rounded-[2rem] border transition-all text-right flex flex-col justify-between h-32 ${
                    deliveredFilter === 'unrepairable' 
                      ? 'border-red-500 bg-red-500/10' 
                      : 'border-white/5 bg-[#141414] hover:border-white/15'
                  }`}
                >
                  <div className="p-2.5 bg-red-500/10 text-red-500 rounded-xl self-start">
                    <XCircle size={18} />
                  </div>
                  <div>
                    <h4 className="text-gray-400 text-xs font-black">تم التسليم لا يصلح</h4>
                    <p className="text-2xl font-black font-mono text-white mt-0.5">{stats.deliveredUnrepairableCount}</p>
                  </div>
                </button>

                {/* 3. Delivered Intact */}
                <button 
                  onClick={() => setDeliveredFilter(deliveredFilter === 'intact' ? 'all' : 'intact')}
                  className={`p-4 rounded-[2rem] border transition-all text-right flex flex-col justify-between h-32 ${
                    deliveredFilter === 'intact' 
                      ? 'border-teal-500 bg-teal-500/10' 
                      : 'border-white/5 bg-[#141414] hover:border-white/15'
                  }`}
                >
                  <div className="p-2.5 bg-teal-500/10 text-teal-400 rounded-xl self-start">
                    <Sparkles size={18} />
                  </div>
                  <div>
                    <h4 className="text-gray-400 text-xs font-black">تم التسليم سليم</h4>
                    <p className="text-2xl font-black font-mono text-white mt-0.5">{stats.deliveredIntactCount}</p>
                  </div>
                </button>

                {/* 4. Delivered Refused */}
                <button 
                  onClick={() => setDeliveredFilter(deliveredFilter === 'refused' ? 'all' : 'refused')}
                  className={`p-4 rounded-[2rem] border transition-all text-right flex flex-col justify-between h-32 ${
                    deliveredFilter === 'refused' 
                      ? 'border-amber-500 bg-amber-500/10' 
                      : 'border-white/5 bg-[#141414] hover:border-white/15'
                  }`}
                >
                  <div className="p-2.5 bg-amber-500/10 text-amber-500 rounded-xl self-start">
                    <AlertTriangle size={18} />
                  </div>
                  <div>
                    <h4 className="text-gray-400 text-xs font-black">تم التسليم لم يوافق العميل</h4>
                    <p className="text-2xl font-black font-mono text-white mt-0.5">{stats.deliveredRefusedCount}</p>
                  </div>
                </button>

                {/* 5. Delivered Process Cancelled (MOCK / Unlinkable placeholder as noted by user) */}
                <div className="p-4 rounded-[2rem] border border-white/5 bg-[#141414]/50 text-right flex flex-col justify-between h-32 relative opacity-60">
                  <div className="p-2.5 bg-white/5 text-gray-500 rounded-xl self-start">
                    <MinusCircle size={18} />
                  </div>
                  <div>
                    <h4 className="text-gray-500 text-xs font-black">تم التسليم تم إلغاء العملية</h4>
                    <p className="text-2xl font-black font-mono text-gray-500 mt-0.5">{stats.deliveredCancelledCount}</p>
                  </div>
                  <span className="absolute top-3 left-3 text-[8px] font-bold text-gray-600 bg-white/5 px-1.5 py-0.5 rounded-sm">مدرج قريباً</span>
                </div>
              </div>

              {/* Dynamic device list matching filtered button selection */}
              <div className="bg-[#141414] border border-white/5 rounded-3xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-black text-sm text-white flex items-center gap-2">
                    <BarChart3 size={16} className="text-emerald-500" />
                    سجل المستلم والمبيعات المخرجة ( تصفية: {
                      deliveredFilter === 'all' ? 'جميع الأجهزة الخارجة' :
                      deliveredFilter === 'ready' ? 'تم التسليم وهو جاهز' :
                      deliveredFilter === 'unrepairable' ? 'تم التسليم وغير قابل للصيانة' :
                      deliveredFilter === 'intact' ? 'تم التسليم وهو سليم' :
                      deliveredFilter === 'refused' ? 'تم التسليم لرفض السعر' :
                      deliveredFilter === 'cancelled' ? 'ملغى كلياً' : 'أخرى'
                    } )
                  </h4>
                  <span className="text-xs text-gray-500 font-bold">إجمالي المخرجات: {tableItems.length}</span>
                </div>

                {tableItems.length === 0 ? (
                  <div className="py-12 text-center text-xs text-gray-500 font-black">
                     لا توجد تسليمات في هذا النطاق الزمني مطابقة للفلترة الفعالة.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead>
                        <tr className="border-b border-white/5 text-gray-400 pb-3">
                          <th className="pb-3 pt-1 font-black px-2">رقم الفاتورة</th>
                          <th className="pb-3 pt-1 font-black px-2">مستلم الصيانة</th>
                          <th className="pb-3 pt-1 font-black">تفاصيل الجهاز والصالحية</th>
                          <th className="pb-3 pt-1 font-black">تقارير الإقفال والمخرجات</th>
                          <th className="pb-3 pt-1 font-black text-left px-2">إجمالي المسدد</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tableItems.map((item) => (
                          <tr key={item.id} className="border-b border-white/[0.02] hover:bg-white/[0.01]">
                            <td className="py-4 font-mono text-emerald-500 font-bold px-2">{item.invoiceNumber}</td>
                            <td className="py-4 text-white font-bold px-2">{item.recipientName || item.customerName || 'مستلم مجهول'}</td>
                            <td className="py-4 font-black">
                              <span className="text-xs text-white">{item.deviceType || 'موبايل'}</span>
                              <span className="text-[10px] text-gray-400 block mt-0.5">{item.deviceName || 'غير محدد'}</span>
                            </td>
                            <td className="py-4 text-gray-400">
                              <span className="text-[9px] px-2 py-0.5 rounded-md inline-block bg-white/5 font-extrabold text-gray-400 mb-1">
                                {getStatusArabicLabel(item.status, getItemSubStatus(item))}
                              </span>
                              <span className="block text-[10px] italic">{item.engineerReport || item.failureReason || 'لم يدون المهندس المذكرة الفنية'}</span>
                            </td>
                            <td className="py-4 font-mono font-bold text-emerald-400 text-left px-2">{(Number(item.cost) || 0).toLocaleString('en-US')} <span className="text-[10px] text-emerald-600 font-black">{itemInvoiceMap.get(String(item.invoiceNumber))?.currency || 'USD'}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}

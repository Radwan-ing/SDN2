import { sharePdfFile } from '../lib/shareHelper';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { localDb } from '../lib/local-db';
import { User } from '../types';
import BankAccountsFooter from './BankAccountsFooter';
import { 
  CircleDollarSign,
  X,
  Calendar,
  User as UserIcon,
  Tag,
  CheckCircle2,
  ArrowRight,
  ArrowRightLeft,
  TrendingUp,
  TrendingDown,
  Percent,
  TrendingUp as ProfitIcon,
  Search,
  Plus,
  Bookmark,
  ChevronLeft,
  Filter,
  Layers,
  FileSpreadsheet,
  Users,
  Wallet,
  Coins,
  FileText,
  Printer,
  ArrowLeft,
  Phone,
  Smartphone,
  MessageCircle,
  Facebook,
  MapPin,
  BarChart,
  PieChart,
  Activity,
  LineChart,
  Eye,
  Check,
  ArrowUpDown,
  Save,
  Loader2
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { doc, getDoc, db } from '../firebase';

interface VaultTransaction {
  id: string;
  currency: string;
  amount: number;
  customerName: string;
  invoiceNumber: string;
  userName: string;
  userNumber?: number;
  userId?: string;
  timestamp: string; // ISO string
  type: 'receipt' | 'payment';
  notes: string;
  updatedAt?: string;
  voucherNumber: number;
  transactionCategory: string;
  fundId: string;
  fundName: string;
  customerId?: string;
}

interface FinFund {
  id: string;
  name: string;
  type: string;
  currency: string;
  description: string;
  status: string;
  balance: number;
}

interface FinCurrency {
  id: string;
  name: string;
  symbol: string;
  decimals: number;
  status: string;
}

interface FinTransactionType {
  id: string;
  name: string;
  type: 'receipt' | 'payment';
}

interface DB_Customer {
  id: string;
  name: string;
  companyName?: string;
  phone1?: string;
}

interface DB_Invoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  currency: string;
  totalCost: number;
  amountPaid: number;
  status: string;
  createdAt: string;
}

const WhatsAppIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M12.012 2c-5.506 0-9.978 4.471-9.978 9.978 0 1.764.459 3.42 1.258 4.873L2 22l5.312-1.393c1.405.766 3 1.18 4.7 1.18 5.506 0 9.978-4.472 9.978-9.978C21.99 6.471 17.518 2 12.012 2zm6.331 14.161c-.244.686-1.22 1.258-1.687 1.341-.468.084-.935.152-2.903-.631-2.479-.982-4.053-3.522-4.175-3.69-.122-.167-.991-1.319-.991-2.518 0-1.199.631-1.787.854-2.028.223-.241.488-.302.65-.302.162 0 .325.003.467.01.147.007.345-.057.545.421.203.488.691 1.687.752 1.809.061.122.102.264.02.427-.081.162-.122.264-.244.407-.122.142-.256.319-.366.427-.122.122-.249.255-.107.498.142.244.631 1.036 1.354 1.678.932.827 1.714 1.082 1.957 1.204.244.122.386.102.528-.061.142-.162.61-2.008.772-2.313.162-.305.325-.244.548-.162.223.081 1.423.671 1.667.793.244.122.406.183.467.284.061.104.061.59-.183 1.277z" />
  </svg>
);

const DashboardButton = ({ onClick, icon, label, description, color, bg }: { onClick: () => void; icon: React.ReactNode; label: string; description: string; color: string; bg: string }) => (
  <button 
    onClick={onClick}
    className="group w-full flex items-center gap-6 p-5 bg-[#181818] border border-white/5 rounded-2xl hover:border-amber-500/50 hover:bg-[#1c1c1c] transition-all relative overflow-hidden active:scale-[0.98]"
  >
    <div className={`p-3 rounded-xl ${bg} ${color} group-hover:scale-110 transition-transform duration-500`}>
      {React.cloneElement(icon as React.ReactElement, { size: 28 })}
    </div>
    <div className="flex flex-col text-right">
      <span className="text-base font-black text-white font-cairo">{label}</span>
      <span className="text-xs text-gray-500 font-cairo">{description}</span>
    </div>
    <div className="mr-auto opacity-0 group-hover:opacity-100 transition-opacity">
      <ArrowLeft size={20} className={color} />
    </div>
  </button>
);

export default function Vault({ user, onBack }: { user: User; onBack: () => void }) {
  const { t } = useTranslation();
  // Navigation
  const [activeSegment, setActiveSegment] = useState<'dashboard' | 'receipt' | 'payment' | 'transfer' | 'funds' | 'customer-ledger' | 'reports'>('dashboard');
  const [reportSubSegment, setReportSubSegment] = useState<'revenues' | 'expenses' | 'profits' | 'fund-balances' | 'outstanding-debts'>('revenues');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const [searchType, setSearchType] = useState<'name' | 'number'>('name');

  // Database lists
  const [funds, setFunds] = useState<FinFund[]>([]);
  const [currencies, setCurrencies] = useState<FinCurrency[]>([]);
  const [txTypes, setTxTypes] = useState<FinTransactionType[]>([]);
  const [customers, setCustomers] = useState<DB_Customer[]>([]);
  const [invoices, setInvoices] = useState<DB_Invoice[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<VaultTransaction[]>([]);

  // Page level stats
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // VOUCHER FORM STATES (Shared structure)
  const [nextVoucherNum, setNextVoucherNum] = useState<number>(1001);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [customerSearch, setCustomerSearch] = useState<string>('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState<string>('');
  const [voucherAmount, setVoucherAmount] = useState<string>('');
  const [voucherNotes, setVoucherNotes] = useState<string>('');
  const [selectedFundId, setSelectedFundId] = useState<string>('');
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [depositorName, setDepositorName] = useState<string>('');

  // TRANSFER TAB STATES
  const [transferSourceFundId, setTransferSourceFundId] = useState<string>('');
  const [transferDestFundId, setTransferDestFundId] = useState<string>('');
  const [transferAmount, setTransferAmount] = useState<string>('');
  const [transferNotes, setTransferNotes] = useState<string>('');

  // CUSTOMER LEDGER TAB STATES
  const [ledgerCustomerId, setLedgerCustomerId] = useState<string>('');
  const [ledgerSearchTerm, setLedgerSearchTerm] = useState<string>('');
  const [showStatementModal, setShowStatementModal] = useState<boolean>(false);
  const [showPrintOptions, setShowPrintOptions] = useState<boolean>(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState<boolean>(false);
  const [shopConfig, setShopConfig] = useState<any>(null);
  const [currentOutput, setCurrentOutput] = useState<any>(null);

  // Fetch all core data from local implementation
  const loadDatabaseData = async () => {
    setLoading(true);
    try {
      // 1. Funds
      const fundsRes = await localDb.query("SELECT * FROM fin_funds WHERE status = 'active' ORDER BY name ASC");
      const activeFunds = (fundsRes.values || []) as FinFund[];
      setFunds(activeFunds);

      // 2. Currencies
      const currRes = await localDb.query("SELECT * FROM fin_currencies WHERE status = 'active' ORDER BY name ASC");
      const activeCurrs = (currRes.values || []) as FinCurrency[];
      setCurrencies(activeCurrs);

      // 3. Types
      const typesRes = await localDb.query("SELECT * FROM fin_transaction_types ORDER BY name ASC");
      setTxTypes((typesRes.values || []) as FinTransactionType[]);

      // 4. Customers
      const custRes = await localDb.query("SELECT id, name, companyName, phone1 FROM customers ORDER BY name ASC");
      setCustomers((custRes.values || []) as DB_Customer[]);

      // 5. Invoices
      const invRes = await localDb.query("SELECT id, invoiceNumber, customerId, customerName, currency, totalCost, amountPaid, status, createdAt FROM invoices");
      setInvoices((invRes.values || []) as DB_Invoice[]);

      // 5.5. Invoice Items
      const itemsRes = await localDb.query("SELECT * FROM invoice_items");
      setItems(itemsRes.values || []);

      // 6. Transactions
      const txRes = await localDb.query("SELECT * FROM vault_transactions ORDER BY timestamp DESC");
      setTransactions((txRes.values || []) as VaultTransaction[]);

      // Reset Form defaults when data shifts
      if (activeFunds.length > 0 && !selectedFundId) {
        setSelectedFundId(activeFunds[0].id);
      }
      if (activeCurrs.length > 0 && !selectedCurrency) {
        setSelectedCurrency(activeCurrs[0].name);
      }

    } catch (err: any) {
      console.error('Error loading vault data:', err);
      setErrorMsg('فشل تحميل حسابات الخزينة');
    } finally {
      setLoading(false);
    }
  };

  // Run initial fetch
  useEffect(() => {
    loadDatabaseData();
    const fetchShopConfig = async () => {
      try {
        const snap = await getDoc(doc(db, 'settings', 'shop'));
        if (snap.exists()) {
          setShopConfig(snap.data() as any);
        } else {
          // Fallback to SQLite
          const localRes = await localDb.query("SELECT * FROM company_details LIMIT 1");
          if (localRes.values && localRes.values.length > 0) {
            setShopConfig(localRes.values[0]);
          }
        }
      } catch (err) {
        console.error("Error fetching shop config:", err);
      }
    };
    fetchShopConfig();
  }, []);

  // Fetch & Calculate Next Voucher Index
  const calculateNextVoucherNumber = async () => {
    try {
      const res = await localDb.query("SELECT COALESCE(MAX(voucherNumber), 1000) as maxNum FROM vault_transactions");
      const max = res.values?.[0]?.maxNum || 1000;
      setNextVoucherNum(Number(max) + 1);
    } catch (err) {
      setNextVoucherNum(1001);
    }
  };

  // Recalculate voucher number whenever segment changes or txTypes are loaded
  useEffect(() => {
    calculateNextVoucherNumber();
    // Default the category selection to the first available category of the current voucher type
    const matchingCats = txTypes.filter(cat => cat.type === activeSegment);
    setSelectedCategory(matchingCats[0]?.name || '');
    setCustomerSearch('');
    setSelectedCustomerId('');
    setVoucherAmount('');
    setVoucherNotes('لا يوجد');
    setReferenceNumber('');
    setDepositorName('');
    setErrorMsg(null);
    setShowPrintPreview(false);
  }, [activeSegment, txTypes]);

  // Synchronize currency automatically with selected fund
  useEffect(() => {
    if (selectedFundId && funds.length > 0) {
      const fund = funds.find(f => f.id === selectedFundId);
      if (fund) {
        setSelectedCurrency(fund.currency);
      }
    }
  }, [selectedFundId, funds]);

  // Form Validity check
  const isFormValid = () => {
    if (!selectedFundId) return false;
    if (!voucherAmount || !voucherAmount.trim()) return false;
    const amountVal = parseFloat(voucherAmount);
    if (isNaN(amountVal) || amountVal <= 0) return false;
    if (!customerSearch || !customerSearch.trim()) return false;
    if (!selectedCategory || !selectedCategory.trim()) return false;
    if (!voucherNotes || !voucherNotes.trim()) return false;

    // Additional checks for bank fund mode
    const matchedFund = funds.find(f => f.id === selectedFundId);
    if (matchedFund && matchedFund.type !== 'cash') {
      if (!referenceNumber || !referenceNumber.trim()) return false;
      if (!depositorName || !depositorName.trim()) return false;
    }

    return true;
  };

  // Handle saving and exporting voucher
  const handleSaveFinalVoucher = async (e: React.FormEvent, action: 'commit' | 'print' | 'whatsapp') => {
    e.preventDefault();
    if (!isFormValid() || isPosting) return;

    if (action === 'print' || action === 'whatsapp') {
      const originalStyle = document.createElement('style');
      originalStyle.innerHTML = `
        @media print {
          body * { visibility: hidden !important; }
          #print-area, #print-area * { visibility: visible !important; }
          #print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            color: #000000 !important;
            background-color: #ffffff !important;
          }
        }
      `;

      if (action === 'print') {
        document.head.appendChild(originalStyle);
        window.print();
        document.head.removeChild(originalStyle);
      } else if (action === 'whatsapp') {
        setIsPosting(true);
        const element = document.getElementById('print-area');
        if (element) {
          const originalGetComputedStyle = window.getComputedStyle;
          let tempEl: HTMLDivElement | null = null;
          try {
            tempEl = document.createElement('div');
            tempEl.style.display = 'none';
            document.body.appendChild(tempEl);

            const convertToRgb = (color: string) => {
              if (!color || (!color.includes('oklch') && !color.includes('oklab'))) return color;
              try {
                if (!tempEl) return 'rgb(0, 0, 0)';
                tempEl.style.color = '';
                tempEl.style.color = color;
                const rgb = originalGetComputedStyle.call(window, tempEl).color;
                if (rgb && !rgb.includes('oklch') && !rgb.includes('oklab')) {
                  return rgb;
                }
                return 'rgb(0, 0, 0)';
              } catch (err) {
                return 'rgb(0, 0, 0)';
              }
            };

            const customGetComputedStyle = (el: Element, pseudoElt?: string | null) => {
              const style = originalGetComputedStyle.call(window, el, pseudoElt);
              return new Proxy(style, {
                get(target: any, prop: string) {
                  const val = target[prop];
                  if (typeof val === 'string' && (val.includes('oklch') || val.includes('oklab'))) {
                    return convertToRgb(val);
                  }
                  if (typeof val === 'function') {
                    return function(...args: any[]) {
                      const res = val.apply(target, args);
                      if (typeof res === 'string' && (res.includes('oklch') || res.includes('oklab'))) {
                        return convertToRgb(res);
                      }
                      return res;
                    };
                  }
                  return val;
                }
              });
            };

            window.getComputedStyle = customGetComputedStyle as any;

            let clonedAreaHeight = 842;
            const canvas = await html2canvas(element, {
              scale: 2,
              useCORS: true,
              allowTaint: true,
              backgroundColor: '#ffffff',
              logging: false,
              onclone: (clonedDoc) => {
                const win = clonedDoc.defaultView;
                if (win) {
                  win.getComputedStyle = customGetComputedStyle;
                }

                const clonedArea = clonedDoc.getElementById('print-area');
                if (clonedArea) {
                  clonedAreaHeight = clonedArea.offsetHeight || 800;
                  clonedArea.style.backgroundColor = '#ffffff';
                  clonedArea.style.color = '#111827';
                  clonedArea.style.padding = '35px';
                  clonedArea.style.borderRadius = '0px';
                  clonedArea.style.boxShadow = 'none';
                  clonedArea.style.direction = 'rtl';
                  clonedArea.style.fontFamily = 'Cairo, system-ui, sans-serif';

                  const allElements = clonedArea.querySelectorAll('*');
                  allElements.forEach((el: any) => {
                    el.style.letterSpacing = 'normal';
                    el.style.setProperty('letter-spacing', 'normal', 'important');

                    let classes = el.className || '';
                    if (typeof classes === 'string' && classes) {
                      if (classes.includes('text-emerald-') || classes.includes('text-green-600')) el.style.color = '#059669';
                      if (classes.includes('text-red-') || classes.includes('text-rose-')) el.style.color = '#e11d48';
                      if (classes.includes('text-orange-')) el.style.color = '#ea580c';
                      if (classes.includes('text-gray-900') || classes.includes('text-black')) el.style.color = '#111827';
                      if (classes.includes('text-gray-500') || classes.includes('text-gray-600')) el.style.color = '#4b5563';
                      if (classes.includes('text-blue-600')) el.style.color = '#2563eb';
                      if (classes.includes('bg-gray-50')) el.style.backgroundColor = '#f9fafb';
                      if (classes.includes('bg-gray-100')) el.style.backgroundColor = '#f3f4f6';
                      if (classes.includes('bg-gray-200')) el.style.backgroundColor = '#e5e7eb';
                    }
                  });
                }
              }
            });

            const imgData = canvas.toDataURL('image/jpeg', 0.8);
            const mmWidth = 210;
            const mmHeight = (clonedAreaHeight * 0.264583) + 20;

            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4',
                compress: true
              });

              const pdfWidth = pdf.internal.pageSize.getWidth();
              const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
              let heightLeft = pdfHeight;
              let position = 0;

              pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight, undefined, 'FAST');
              heightLeft -= pdf.internal.pageSize.getHeight();

              while (heightLeft >= 0) {
                position = heightLeft - pdfHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight, undefined, 'FAST');
                heightLeft -= pdf.internal.pageSize.getHeight();
              }
            
            const formattedDate = new Date().toISOString().split('T')[0];
            const custName = customers.find(c => c.id === selectedCustomerId)?.name || customerSearch || 'عام';
            const reportName = activeSegment === 'receipt' ? 'سند قبض' : 'سند صرف';
            const filename = `${reportName}_${custName}_${formattedDate}.pdf`;
            pdf.save(filename);

            const customerPhone = customers.find(c => c.id === selectedCustomerId || c.name === customerSearch)?.phone1 || '';
            const text = `السلام عليكم ورحمة الله وبركاته...
مرفق لكم تفاصيل سند ${activeSegment === 'receipt' ? 'قبض' : 'صرف'} رقم (${nextVoucherNum}):
نوع السند: ${activeSegment === 'receipt' ? 'سند قبض مالي' : 'سند صرف مالي'}
العميل: ${customerSearch}
المبلغ: ${voucherAmount} ${selectedCurrency}
التصنيف: ${selectedCategory}
الملاحظات: ${voucherNotes || 'لا يوجد'}
شكراً لتعاملكم معنا.`;

            let sharedNatively = false;
            if (navigator.share && navigator.canShare) {
              const pdfBlob = pdf.output('blob');
              const file = new File([pdfBlob], filename, { type: 'application/pdf' });
              if (navigator.canShare({ files: [file] })) {
                 await navigator.share({ files: [file], title: filename, text: text });
                 sharedNatively = true;
              }
            }
            if (!sharedNatively) {
              const encodedMessage = encodeURIComponent(text);
              window.open(`https://wa.me/${customerPhone}?text=${encodedMessage}`, '_blank');
            }
          } catch (err) {
            console.error('Failed to generate or share PDF', err);
          } finally {
            window.getComputedStyle = originalGetComputedStyle;
            if (tempEl && tempEl.parentNode) {
              tempEl.parentNode.removeChild(tempEl);
            }
            setIsPosting(false);
          }
        }
      }
    }

    // Now proceed with normal post logic
    await handlePostVoucher(e);
  };

  // POST / REASSIGN Voucher to Ledger
  const handlePostVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid() || isPosting) return;

    setIsPosting(true);
    try {
      const isReceipt = activeSegment === 'receipt';
      const parsedAmount = parseFloat(voucherAmount);
      const matchedFund = funds.find(f => f.id === selectedFundId);
      if (!matchedFund) {
        setErrorMsg('الصندوق المحدد غير موجود');
        setIsPosting(false);
        return;
      }

      const txId = `vtx-${Math.random().toString(36).substring(2, 8)}`;
      const timestampIso = new Date().toISOString();

      // 1. Insert into database
      await localDb.run(
        `INSERT INTO vault_transactions (
          id, currency, amount, customerName, invoiceNumber, 
          userName, userNumber, userId, timestamp, type, 
          notes, updatedAt, voucherNumber, transactionCategory, 
          fundId, fundName, customerId
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          txId,
          selectedCurrency, // The currency of the voucher
          isReceipt ? parsedAmount : -parsedAmount, // ledger value (receipt +, payment -)
          customerSearch.trim() || 'جهة عامة أخرى',
          '', // No invoice number for manual vouchers
          user.name || 'المدير العام',
          user.userNumber || 1,
          user.id || 'none',
          timestampIso,
          isReceipt ? 'receipt' : 'payment',
          matchedFund.type !== 'cash' 
            ? `رقم المرجع: ${referenceNumber.trim()} | المودع: ${depositorName.trim()} | الملاحظات: ${voucherNotes.trim()}` 
            : voucherNotes.trim(),
          timestampIso,
          nextVoucherNum,
          selectedCategory,
          matchedFund.id,
          matchedFund.name,
          selectedCustomerId || ''
        ]
      );

      // 2. Adjust target box fund balance in database
      const balanceAdjustment = isReceipt ? parsedAmount : -parsedAmount;
      await localDb.run(
        "UPDATE fin_funds SET balance = balance + ? WHERE id = ?",
        [balanceAdjustment, matchedFund.id]
      );

      // Successfully processed
      setSuccessMsg(`تم ترحيل السند رقم (${nextVoucherNum}) بنجاح وتحديث الصناديق المال.`);
      setTimeout(() => setSuccessMsg(null), 3000);
      setShowAddModal(false);

      // Reset form variables
      setSelectedCategory('');
      setCustomerSearch('');
      setSelectedCustomerId('');
      setVoucherAmount('');
      setVoucherNotes('لا يوجد');
      setReferenceNumber('');
      setDepositorName('');
      setShowPrintPreview(false);
      
      // Reload everything
      await loadDatabaseData();
      await calculateNextVoucherNumber();

    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'فشل ترحيل قيد الحسابات');
    } finally {
      setIsPosting(false);
    }
  };

  const handlePostTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isPosting) return;
    
    if (!transferSourceFundId || !transferDestFundId || !transferAmount || parseFloat(transferAmount) <= 0) {
      setErrorMsg('الرجاء تعبئة بيانات التحويل بشكل صحيح والمبلغ أكبر من صفر');
      return;
    }

    if (transferSourceFundId === transferDestFundId) {
      setErrorMsg('لا يمكن التحويل لنفس الصندوق');
      return;
    }

    const sourceFund = funds.find(f => f.id === transferSourceFundId);
    const destFund = funds.find(f => f.id === transferDestFundId);

    if (!sourceFund || !destFund) {
      setErrorMsg('أحد الصناديق غير موجود');
      return;
    }

    if (sourceFund.currency !== destFund.currency) {
      setErrorMsg('التحويل يتطلب تطابق عملة الصندوقين');
      return;
    }

    setIsPosting(true);
    try {
      const parsedAmount = parseFloat(transferAmount);
      const timestampIso = new Date().toISOString();

      // Create transaction for Source (payment/outgoing)
      const txIdOut = `vtx-${Math.random().toString(36).substring(2, 8)}`;
      await localDb.run(
        `INSERT INTO vault_transactions (
          id, currency, amount, customerName, invoiceNumber, 
          userName, userNumber, userId, timestamp, type, 
          notes, updatedAt, voucherNumber, transactionCategory, 
          fundId, fundName, customerId
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          txIdOut,
          sourceFund.currency,
          -parsedAmount, 
          'تحويل داخلي',
          '',
          user.name || 'المدير العام',
          user.userNumber || 1,
          user.id || 'none',
          timestampIso,
          'payment',
          `تحويل صادر إلى الصندوق: ${destFund.name} ${transferNotes ? ' - ' + transferNotes : ''}`,
          timestampIso,
          nextVoucherNum, // Using current voucher num for linking
          'تحويل بين الصناديق',
          sourceFund.id,
          sourceFund.name,
          ''
        ]
      );

      // Create transaction for Destination (receipt/incoming)
      const txIdIn = `vtx-${Math.random().toString(36).substring(2, 8)}`;
      await localDb.run(
        `INSERT INTO vault_transactions (
          id, currency, amount, customerName, invoiceNumber, 
          userName, userNumber, userId, timestamp, type, 
          notes, updatedAt, voucherNumber, transactionCategory, 
          fundId, fundName, customerId
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          txIdIn,
          destFund.currency,
          parsedAmount, 
          'تحويل داخلي',
          '',
          user.name || 'المدير العام',
          user.userNumber || 1,
          user.id || 'none',
          timestampIso,
          'receipt',
          `تحويل وارد من الصندوق: ${sourceFund.name} ${transferNotes ? ' - ' + transferNotes : ''}`,
          timestampIso,
          nextVoucherNum,
          'تحويل بين الصناديق',
          destFund.id,
          destFund.name,
          ''
        ]
      );

      // Adjust balances
      await localDb.run(
        "UPDATE fin_funds SET balance = balance - ? WHERE id = ?",
        [parsedAmount, sourceFund.id]
      );
      await localDb.run(
        "UPDATE fin_funds SET balance = balance + ? WHERE id = ?",
        [parsedAmount, destFund.id]
      );

      setSuccessMsg(`تم التحويل بنجاح من ${sourceFund.name} إلى ${destFund.name}`);
      setTimeout(() => setSuccessMsg(null), 3000);
      
      setTransferAmount('');
      setTransferNotes('');
      setTransferSourceFundId('');
      setTransferDestFundId('');
      
      await loadDatabaseData();
      await calculateNextVoucherNumber();

    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'فشل عملية التحويل');
    } finally {
      setIsPosting(false);
    }
  };

  // Suggest filtered customer autocomplete search
  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    (c.phone1 && c.phone1.includes(customerSearch))
  );

  // LEDGER CUSTOMER MATH
  const selectedLedgerCustomer = customers.find(c => c.id === ledgerCustomerId);
  const ledgerCustomerInvoices = invoices.filter(inv => inv.customerId === ledgerCustomerId);
  const ledgerCustomerTransactions = transactions.filter(tx => tx.customerId === ledgerCustomerId);

  const getInvoiceActualCost = (invoiceItems: any[]) => {
    return invoiceItems.reduce((sum, item) => {
      // Exclude items in pending statuses (new, testing, awaiting approval, awaiting parts, repairing)
      // Because maintenance has not completed yet, so the amount is not yet due/confirmed on the customer.
      if (['10', '20', '25', '30', '35', '40', 'new', 'in_progress', 'awaiting_parts', 'awaiting_approval', 'repairing'].includes(item.status)) {
        return sum;
      }
      
      // Exclude cancelled/withdrawn devices, unrepairable/failed devices, refused devices, or devices backdue to unavailable parts
      const sub = (item.subStatus || '').toLowerCase();
      const status = (item.status || '').toLowerCase();
      const src = (item.source || '').toLowerCase();

      // Check if cancelled, refused, unrepairable (failed), or parts unavailable
      const isExcluded = 
        ['70', 'cancelled', 'refused', 'unrepairable', 'parts_not_available', 'failed'].includes(status) ||
        ['cancelled', 'refused', 'unrepairable', 'parts_not_available', 'failed'].includes(sub) ||
        ['cancelled', 'refused', 'unrepairable', 'parts_not_available', 'failed'].includes(src) ||
        (item.failureReason !== null && item.failureReason !== undefined && item.failureReason !== '');
      
      if (isExcluded) {
        return sum;
      }
      
      return sum + (Number(item.cost) || 0);
    }, 0);
  };

  const getInvoiceItemsForInvoice = (invoiceNumber: string) => {
    return items.filter(it => it.invoiceNumber === invoiceNumber);
  };

  // Accounting aggregates for the specific customer ledger using verified actual/repaired costs
  const totalInvoicesCost = ledgerCustomerInvoices.reduce((acc, curr) => {
    const invItems = getInvoiceItemsForInvoice(curr.invoiceNumber);
    return acc + getInvoiceActualCost(invItems);
  }, 0);

  const totalInvoicesPaid = ledgerCustomerInvoices.reduce((acc, curr) => acc + Number(curr.amountPaid || 0), 0);
  const totalSeparateCollections = ledgerCustomerTransactions
    .filter(tx => tx.type === 'receipt')
    .reduce((acc, curr) => acc + Math.abs(Number(curr.amount || 0)), 0);

  // Net Debt calculation (Invoices cost minus paid on invoice minus general receipts collections)
  const customerUnpaidBalance = Math.max(0, totalInvoicesCost - totalInvoicesPaid - totalSeparateCollections);

  // Generate statement entries chronologically for Selected Customer inside Vault
  const getStatementEntries = (customerId: string) => {
    const entries: {
      id: string;
      date: Date;
      type: string;
      label: string;
      reference: string;
      notes: string;
      debit: number;
      credit: number;
    }[] = [];

    // 1. Get customer invoices
    const customerInvs = invoices.filter(inv => inv.customerId === customerId);
    customerInvs.forEach(inv => {
      const invItems = items.filter(it => it.invoiceNumber === inv.invoiceNumber);
      const actualCost = getInvoiceActualCost(invItems);

      // Merge debit (invoice cost) and credit (amount paid on it) into a single row
      entries.push({
        id: `inv-${inv.id}`,
        date: inv.createdAt?.toDate ? inv.createdAt.toDate() : new Date(inv.createdAt || Date.now()),
        type: 'فاتورة صيانة',
        label: 'فاتورة صيانة أجهزة فنية',
        reference: String(inv.invoiceNumber).replace(/#/g, ''),
        notes: inv.notes || 'خدمات صيانة وقطع غيار للأجهزة المستلمة والمنجزة بالكامل',
        debit: actualCost,
        credit: Number(inv.amountPaid || 0)
      });
    });

    // 2. Get separate receipts and payments
    const customerTransactions = transactions.filter(tx => tx.customerId === customerId);
    customerTransactions.forEach(tx => {
      const txDate = tx.timestamp?.toDate ? tx.timestamp.toDate() : (tx.timestamp ? new Date(tx.timestamp) : new Date());
      if (tx.type === 'receipt') {
        entries.push({
          id: `tx-${tx.id}`,
          date: txDate,
          type: 'سند قبض',
          label: tx.transactionCategory || tx.notes || 'سند قبض مالي مستقل',
          reference: String(tx.voucherNumber || tx.id?.substring(0, 5)).replace(/#/g, ''),
          notes: tx.notes || 'قبض نقدي تحت الحساب',
          debit: 0,
          credit: Math.abs(Number(tx.amount || 0))
        });
      } else if (tx.type === 'payment') {
        entries.push({
          id: `tx-${tx.id}`,
          date: txDate,
          type: 'سند صرف',
          label: tx.transactionCategory || tx.notes || 'سند صرف للعميل مستقل',
          reference: String(tx.voucherNumber || tx.id?.substring(0, 5)).replace(/#/g, ''),
          notes: tx.notes || 'صرف مالي أو استرجاع نقدي',
          debit: Math.abs(Number(tx.amount || 0)),
          credit: 0
        });
      }
    });

    // 3. Sort chronologically
    entries.sort((a, b) => a.date.getTime() - b.date.getTime());

    // 4. Filter entries that have active financial impact (debit > 0 or credit > 0)
    const activeEntries = entries.filter(e => e.debit > 0.001 || e.credit > 0.001);

    // 5. Compute running balance
    let balance = 0;
    return activeEntries.map(entry => {
      balance += entry.debit - entry.credit;
      return {
        ...entry,
        runningBalance: balance
      };
    });
  };

  const handleWhatsAppShare = async (customerId: string) => {
    const cust = customers.find(c => c.id === customerId);
    if (!cust) return;

    setIsGeneratingPDF(true);

    const originalGetComputedStyle = window.getComputedStyle;
    let tempEl: HTMLDivElement | null = null;

    try {
      const element = document.getElementById('print-area');
      if (!element) {
        setIsGeneratingPDF(false);
        return;
      }

      tempEl = document.createElement('div');
      tempEl.style.display = 'none';
      document.body.appendChild(tempEl);

      const convertToRgb = (color: string) => {
        if (!color || (!color.includes('oklch') && !color.includes('oklab'))) return color;
        try {
          if (!tempEl) return 'rgb(0, 0, 0)';
          tempEl.style.color = '';
          tempEl.style.color = color;
          const rgb = originalGetComputedStyle.call(window, tempEl).color;
          if (rgb && !rgb.includes('oklch') && !rgb.includes('oklab')) {
            return rgb;
          }
          return 'rgb(0, 0, 0)';
        } catch (e) {
          return 'rgb(0, 0, 0)';
        }
      };

      const cleanOklchString = (val: string): string => {
        if (typeof val !== 'string') return val;
        if (!val.includes('oklch') && !val.includes('oklab')) return val;
        return val.replace(/(oklch|oklab)\([^)]+\)/g, (match) => convertToRgb(match));
      };

      const customGetComputedStyle = function (elt: Element, pseudoElt?: string) {
        const style = originalGetComputedStyle.call(window, elt, pseudoElt);
        return new Proxy(style, {
          get(target, prop) {
            if (prop === 'getPropertyValue') {
              return function(propertyName: string) {
                const val = target.getPropertyValue(propertyName);
                if (typeof val === 'string' && (val.includes('oklch') || val.includes('oklab'))) {
                  return cleanOklchString(val);
                }
                return val;
              };
            }
            const val = (target as any)[prop];
            if (typeof val === 'string' && (val.includes('oklch') || val.includes('oklab'))) {
              return cleanOklchString(val);
            }
            if (typeof val === 'function') {
              return val.bind(target);
            }
            return val;
          }
        });
      } as any;

      // Apply globally
      window.getComputedStyle = customGetComputedStyle;

      let clonedAreaHeight = 800; // fallback

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        onclone: (clonedDoc) => {
          const win = clonedDoc.defaultView;
          if (win) {
            win.getComputedStyle = customGetComputedStyle;
          }

          const clonedArea = clonedDoc.getElementById('print-area');
          if (clonedArea) {
            clonedAreaHeight = clonedArea.offsetHeight || 800;
            clonedArea.style.backgroundColor = '#ffffff';
            clonedArea.style.color = '#111827';
            clonedArea.style.padding = '35px';
            clonedArea.style.borderRadius = '0px';
            clonedArea.style.boxShadow = 'none';
            clonedArea.style.direction = 'rtl';
            clonedArea.style.fontFamily = 'Cairo, system-ui, sans-serif';

            // Transform inner elements of the clone to ensure crisp light theme printing
            const allElements = clonedArea.querySelectorAll('*');
            allElements.forEach((el: any) => {
              // Standardize letter spacing to normal (0px) to prevent Arabic letters from overlapping or disjointing
              el.style.letterSpacing = 'normal';
              el.style.setProperty('letter-spacing', 'normal', 'important');

              let classes = el.className || '';
              if (typeof classes === 'string' && classes) {
                // Ensure no letter spacing leaks to Arabic
                if (classes.includes('tracking-')) {
                  el.style.letterSpacing = 'normal';
                  el.style.setProperty('letter-spacing', 'normal', 'important');
                }

                // Inline backgrounds to bypass html2canvas modern CSS (Tailwind variables / oklch) parsing issues which cause black boxes
                if (classes.includes('bg-gray-50') || classes.includes('bg-gray-50/50') || classes.includes('bg-gray-50/10') || classes.includes('bg-gray-50/20')) {
                  el.style.backgroundColor = '#f9fafb';
                } else if (classes.includes('bg-gray-100') || classes.includes('bg-gray-100/80') || classes.includes('bg-gray-100/50')) {
                  el.style.backgroundColor = '#f3f4f6';
                } else if (classes.includes('bg-gray-200') || classes.includes('bg-gray-200/60') || classes.includes('bg-gray-200/50')) {
                  el.style.backgroundColor = '#e5e7eb';
                } else if (classes.includes('bg-gray-300')) {
                  el.style.backgroundColor = '#d1d5db';
                } else if (classes.includes('bg-gray-900') || classes.includes('bg-slate-900') || classes.includes('bg-[#1c1c1c]') || classes.includes('bg-[#181818]') || classes.includes('bg-black/20')) {
                  el.style.backgroundColor = '#ffffff';
                } else if (classes.includes('bg-white') || classes.includes('bg-white/5') || classes.includes('bg-white/10')) {
                  el.style.backgroundColor = '#ffffff';
                } else if (classes.includes('bg-purple-600/10')) {
                  el.style.backgroundColor = '#faf5ff';
                }

                // Inline text colors
                if (classes.includes('text-white')) {
                  el.style.color = '#111827';
                } else if (classes.includes('text-gray-900') || classes.includes('text-slate-900') || classes.includes('text-black')) {
                  el.style.color = '#111827';
                } else if (classes.includes('text-gray-800') || classes.includes('text-gray-700')) {
                  el.style.color = '#1f2937';
                } else if (classes.includes('text-gray-600') || classes.includes('text-gray-500') || classes.includes('text-gray-400')) {
                  el.style.color = '#4b5563';
                } else if (classes.includes('text-purple-400')) {
                  el.style.color = '#7e22ce';
                  el.style.fontWeight = 'bold';
                } else if (classes.includes('text-emerald-400')) {
                  el.style.color = '#047857';
                  el.style.fontWeight = 'bold';
                } else if (classes.includes('text-rose-400')) {
                  el.style.color = '#be123c';
                  el.style.fontWeight = 'bold';
                }

                // Inline borders
                if (classes.includes('border-gray-200') || classes.includes('border-white/10')) {
                  el.style.borderColor = '#e5e7eb';
                } else if (classes.includes('border-gray-300')) {
                  el.style.borderColor = '#d1d5db';
                } else if (classes.includes('border-gray-400')) {
                  el.style.borderColor = '#9ca3af';
                } else if (classes.includes('border-gray-900') || classes.includes('border-black')) {
                  el.style.borderColor = '#111827';
                }

                // Replace dark background classes with custom light ones for general DOM compatibility
                classes = classes.replace(/bg-gray-50\/50/g, 'bg-gray-50');
                classes = classes.replace(/bg-gray-100\/80/g, 'bg-gray-100');
                classes = classes.replace(/bg-[#1c1c1c]/g, 'bg-white'); 
                classes = classes.replace(/bg-[#181818]/g, 'bg-white');
                classes = classes.replace(/bg-gray-900\/80/g, 'bg-white');
                classes = classes.replace(/bg-black\/20/g, 'bg-white');
                classes = classes.replace(/bg-white\/5/g, 'bg-gray-50');
                classes = classes.replace(/border-white\/10/g, 'border-gray-200');
                classes = classes.replace(/border-white\/5/g, 'border-gray-100');
                classes = classes.replace(/text-white/g, 'text-gray-900');
                classes = classes.replace(/text-gray-400/g, 'text-gray-600');
                classes = classes.replace(/text-gray-500/g, 'text-gray-500');
                classes = classes.replace(/text-purple-400/g, 'text-purple-700 font-bold');
                classes = classes.replace(/text-emerald-400/g, 'text-emerald-700 font-bold');
                classes = classes.replace(/text-rose-400/g, 'text-rose-700 font-bold');
                classes = classes.replace(/bg-purple-600\/10/g, 'bg-purple-100/50');
                el.className = classes;
              }

              // Apply clean border/line formatting
              if (el.tagName === 'TABLE' || el.tagName === 'TR' || el.tagName === 'TH' || el.tagName === 'TD') {
                el.style.borderColor = '#e5e7eb';
                el.style.borderWidth = '1px';
                el.style.borderStyle = 'solid';
              }
              if (el.tagName === 'TH') {
                el.style.backgroundColor = '#f3f4f6';
                el.style.color = '#111827';
                el.style.fontWeight = 'bold';
              }
              if (el.tagName === 'TD') {
                el.style.backgroundColor = '#ffffff';
                el.style.color = '#1f2937';
              }
            });
          }
        }
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.8);

      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4',
        compress: true
      });
      const imgWidth = 210;
      const pageHeight = 297;
      
      // Calculate realistic height based on scale width vs height ratio
      const imgHeight = (clonedAreaHeight * imgWidth) / 800;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pageHeight;

      while (heightLeft > 5) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
        heightLeft -= pageHeight;
      }

      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const printDate = `${year}-${month}-${day}`;
      const filename = `كشف حساب_${cust.name}_${printDate}.pdf`;

      // 2. Prepare PDF Base64 details & save to database folder and sqlite saved_pdfs
      let pdfBase64 = '';
      try {
        pdfBase64 = pdf.output('datauristring').split(',')[1];
      } catch (err) {
        console.error('Failed to get PDF Base64 string:', err);
      }

      // Save to Capacitor filesystem folder
      try {
        await Filesystem.writeFile({
          path: `customer_ledgers/${filename}`,
          data: pdfBase64,
          directory: Directory.Documents,
          recursive: true
        });
        console.log('PDF file saved successfully to customer_ledgers directory.');
      } catch (fsError) {
        console.warn('Skipping Device Filesystem save:', fsError);
      }

      // Save to SQLite database table (saved_pdfs history log)
      try {
        // Create table dynamically in sqlite if not created
        await localDb.run(`
          CREATE TABLE IF NOT EXISTS saved_pdfs (
            id TEXT PRIMARY KEY,
            customerId TEXT,
            customerName TEXT,
            filename TEXT,
            createdAt TEXT,
            fileSize TEXT,
            fileData TEXT
          )
        `);
        const docId = `pdf_${Date.now()}`;
        const fileSize = `${Math.round(pdfBase64.length * 0.75 / 1024)} KB`;
        await localDb.run(
          `INSERT INTO saved_pdfs (id, customerId, customerName, filename, createdAt, fileSize, fileData) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [docId, customerId, cust.name, filename, new Date().toISOString(), fileSize, pdfBase64]
        );
        console.log('PDF saved to local database saved_pdfs table!');
      } catch (dbError) {
        console.warn('Failed to save to SQLite database table saved_pdfs:', dbError);
      }

      pdf.save(filename);

      // 3. Launch WhatsApp link or Native Share
      const totalCost = totalInvoicesCost;
      const totalPaid = totalInvoicesPaid + totalSeparateCollections;
      const diff = totalCost - totalPaid;
      const currency = 'USD';

      let statusText = '';
      if (diff < -0.01) {
        statusText = `رصيد دائن للعميل بفائض: ${Math.abs(diff).toLocaleString('en-US')} ${currency}`;
      } else if (diff > 0.01) {
        statusText = `متبقي عليه كديون متراكمة: ${Math.abs(diff).toLocaleString('en-US')} ${currency}`;
      } else {
        statusText = `الحساب متزن بالكامل (0.00)`;
      }

      let message = `*كشف حساب مالي رسمي وموحد (منقولات الخزينة) بصيغة PDF* 📄\n\n`;
      message += `عزيزي العميل *${cust.name}*،\n`;
      message += `تجدون أدناه الملخص المالي لحسابات الخزينة وقسم الصيانة والقيود المسجلة لدينا. كما تم تنزيل وحفظ مستند الـ PDF للتقرير في مجلد قاعدة البيانات.\n\n`;
      message += `- *الرصيد الصافي:* ${statusText}\n`;
      message += `- *إجمالي قيمة صيانة الأجهزة المقبولة:* ${totalCost.toLocaleString('en-US')} ${currency}\n`;
      message += `- *إجمالي المقبوضات والسندات:* ${totalPaid.toLocaleString('en-US')} ${currency}\n\n`;
      message += `يرجى مشاركة وإرسال كشف مستند الـ PDF المحفوظ الآن بنجاح على جهازكم.`;

      // Native Share API if supported (to attach actual PDF sheet on mobile)
      let sharedNatively = false;
      try {
        const pdfBlob = pdf.output('blob');
        sharedNatively = await sharePdfFile(pdfBlob, filename, message);
      } catch (shareErr) {
        console.warn('Native share was skipped:', shareErr);
      }

      if (!sharedNatively) {
        const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
        window.open(waUrl, '_blank');
      }
    } catch (e) {
      console.error('Failed to export PDF & share:', e);
    } finally {
      window.getComputedStyle = originalGetComputedStyle;
      if (tempEl && tempEl.parentNode) {
        tempEl.parentNode.removeChild(tempEl);
      }
      setIsGeneratingPDF(false);
    }
  };

  // --- REVENUE & EXPENSE REPORT STATISTICS ---
  const receiptTransactions = transactions.filter(tx => tx.type === 'receipt');
  const paymentTransactions = transactions.filter(tx => tx.type === 'payment');

  // Calculates sums of values dynamically grouped by currency code/symbol
  const computeCurrencyTotals = (txs: VaultTransaction[]) => {
    const sums: Record<string, number> = {};
    txs.forEach(tx => {
      const code = tx.currency || 'USD';
      sums[code] = (sums[code] || 0) + Math.abs(Number(tx.amount || 0));
    });
    return sums;
  };

  const revenueCurrencyTotals = computeCurrencyTotals(receiptTransactions);
  const expenseCurrencyTotals = computeCurrencyTotals(paymentTransactions);

  // Build unique currencies checklist for calculations
  const allUsedCurrencies = Array.from(new Set([
    ...Object.keys(revenueCurrencyTotals),
    ...Object.keys(expenseCurrencyTotals),
    ...funds.map(f => f.currency),
    ...currencies.map(c => c.name)
  ]));

  return (
    <div className="financial-vault-container h-full flex flex-col gap-4 overflow-hidden text-right pb-4 max-w-7xl mx-auto" dir="rtl">
      
      {/* Unified Header */}
      {activeSegment !== 'dashboard' && !showAddModal && (
        <div className="flex items-center px-4 py-3 border-b border-white/10 bg-black/20">
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
              <h1 className="text-lg font-black text-white m-0 p-0">{t('vault.title', 'إدارة وتحركات الحسابات المالية')}</h1>
              <p className="text-[10px] text-gray-500 font-bold m-0 p-0 leading-none mt-1">
                {t('vault.subtitle', 'سندات الصرف والقبض، تدفقات الصناديق المتكاملة، حسابات العملاء التفصيلية، والتقارير المالية.')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Notifications banner */}
      {successMsg && (
        <div className="mx-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 p-4 rounded-2xl flex items-center gap-2 text-xs font-cairo transition-all animate-bounce">
          <CheckCircle2 size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="mx-4 bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-2xl flex items-center justify-between gap-2 text-xs font-cairo transition-all">
          <div className="flex items-center gap-2">
            <X size={18} />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-[10px] bg-white/5 px-2 py-0.5 rounded hover:bg-white/10">إخفاء</button>
        </div>
      )}

      {/* Primary Layout Wrapper */}
      <div className="flex-1 grid grid-cols-1 gap-4 px-4 overflow-hidden">
        
        {/* RIGHT SIDEBAR MENU - Accounts Hierarchy */}
        {false && activeSegment !== 'dashboard' && (
          <div className="lg:col-span-1 bg-[#101010] border border-white/5 rounded-3xl p-4 flex flex-col gap-5 overflow-y-auto">
            <div>
              <h3 className="text-[10px] font-black uppercase text-gray-500 tracking-wider mr-1 mb-2 font-cairo">شجرة النظام المالي</h3>
              
              <div className="space-y-1">
                
                {/* Dashboard Back */}
                <button 
                  onClick={() => { setActiveSegment('dashboard'); setErrorMsg(null); }}
                  className={`w-full text-right px-4 py-2.5 rounded-xl text-xs font-bold font-cairo transition-all flex items-center gap-2 hover:bg-white/5 text-gray-300 mb-4`}
                >
                  <ArrowRight size={16} className="text-gray-500" />
                  العودة للرئيسية
                </button>

                {/* Vouchers Header */}
              <div className="px-2 py-1 text-xs text-gray-400 font-bold font-cairo">
                سندات التحويل المالي
              </div>

              {/* Receipt */}
              <button 
                onClick={() => { setActiveSegment('receipt'); setErrorMsg(null); }}
                className={`w-full text-right px-4 py-2.5 rounded-xl text-xs font-bold font-cairo transition-all flex items-center justify-between ${activeSegment === 'receipt' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/15' : 'hover:bg-white/5 text-gray-300'}`}
              >
                <span className="flex items-center gap-2">
                  <TrendingUp size={16} className={activeSegment === 'receipt' ? 'text-white' : 'text-green-500'} />
                  سند قبض ونقد وارد
                </span>
                <span className="font-mono text-[9px] bg-white/10 px-1.5 py-0.5 rounded text-white font-bold">وارد</span>
              </button>

              {/* Payment */}
              <button 
                onClick={() => { setActiveSegment('payment'); setErrorMsg(null); }}
                className={`w-full text-right px-4 py-2.5 rounded-xl text-xs font-bold font-cairo transition-all flex items-center justify-between ${activeSegment === 'payment' ? 'bg-amber-600 text-white shadow-lg shadow-amber-500/15' : 'hover:bg-white/5 text-gray-300'}`}
              >
                <span className="flex items-center gap-2">
                  <TrendingDown size={16} className={activeSegment === 'payment' ? 'text-white' : 'text-amber-500'} />
                  سند صرف ونفقات صادرة
                </span>
                <span className="font-mono text-[9px] bg-white/10 px-1.5 py-0.5 rounded text-white font-bold">صادر</span>
              </button>

              <div className="h-[1px] bg-white/5 my-3" />

              {/* Box Funds */}
              <button 
                onClick={() => { setActiveSegment('funds'); setErrorMsg(null); }}
                className={`w-full text-right px-4 py-2.5 rounded-xl text-xs font-bold font-cairo transition-all flex items-center gap-2 ${activeSegment === 'funds' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/15' : 'hover:bg-white/5 text-gray-300'}`}
              >
                <Wallet size={16} className={activeSegment === 'funds' ? 'text-white' : 'text-blue-500'} />
                رصيد وحركة الصناديق المال
              </button>

              {/* Client Ledger */}
              <button 
                onClick={() => { setActiveSegment('customer-ledger'); setErrorMsg(null); }}
                className={`w-full text-right px-4 py-2.5 rounded-xl text-xs font-bold font-cairo transition-all flex items-center gap-2 ${activeSegment === 'customer-ledger' ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/15' : 'hover:bg-white/5 text-gray-300'}`}
              >
                <Users size={16} className={activeSegment === 'customer-ledger' ? 'text-white' : 'text-purple-500'} />
                كشف حسابات العملاء
              </button>

              <div className="h-[1px] bg-white/5 my-3" />

              {/* Reports */}
              <div className="px-2 py-1 text-xs text-gray-400 font-bold font-cairo">
                التقارير والمؤشرات المالية
              </div>

              <button 
                onClick={() => { setActiveSegment('reports'); setReportSubSegment('revenues'); setErrorMsg(null); }}
                className={`w-full text-right px-4 py-2 rounded-xl text-xs font-medium font-cairo transition-all flex items-center justify-between ${activeSegment === 'reports' && reportSubSegment === 'revenues' ? 'bg-white/10 text-white font-bold' : 'hover:bg-white/5 text-gray-400'}`}
              >
                <span>• الإيرادات والمداخيل</span>
              </button>

              <button 
                onClick={() => { setActiveSegment('reports'); setReportSubSegment('expenses'); setErrorMsg(null); }}
                className={`w-full text-right px-4 py-2 rounded-xl text-xs font-medium font-cairo transition-all flex items-center justify-between ${activeSegment === 'reports' && reportSubSegment === 'expenses' ? 'bg-white/10 text-white font-bold' : 'hover:bg-white/5 text-gray-400'}`}
              >
                <span>• المصروفات والمدفوعات</span>
              </button>

              <button 
                onClick={() => { setActiveSegment('reports'); setReportSubSegment('profits'); setErrorMsg(null); }}
                className={`w-full text-right px-4 py-2 rounded-xl text-xs font-medium font-cairo transition-all flex items-center justify-between ${activeSegment === 'reports' && reportSubSegment === 'profits' ? 'bg-white/10 text-white font-bold' : 'hover:bg-white/5 text-gray-400'}`}
              >
                <span>• الأرباح والصافي</span>
              </button>

              <button 
                onClick={() => { setActiveSegment('reports'); setReportSubSegment('fund-balances'); setErrorMsg(null); }}
                className={`w-full text-right px-4 py-2 rounded-xl text-xs font-medium font-cairo transition-all flex items-center justify-between ${activeSegment === 'reports' && reportSubSegment === 'fund-balances' ? 'bg-white/10 text-white font-bold' : 'hover:bg-white/5 text-gray-400'}`}
              >
                <span>• أرصدة كتل الصناديق</span>
              </button>

              <button 
                onClick={() => { setActiveSegment('reports'); setReportSubSegment('outstanding-debts'); setErrorMsg(null); }}
                className={`w-full text-right px-4 py-2 rounded-xl text-xs font-medium font-cairo transition-all flex items-center justify-between ${activeSegment === 'reports' && reportSubSegment === 'outstanding-debts' ? 'bg-white/10 text-white font-bold' : 'hover:bg-white/5 text-gray-400'}`}
              >
                <span>• مديونيات وحقوق معلقة</span>
              </button>

            </div>
          </div>
        </div>
      )}

      {/* LEFT WORKSPACE CARD */}
      <div className={`${activeSegment === 'dashboard' ? 'lg:col-span-4 bg-transparent border-0 !p-0 shadow-none' : 'lg:col-span-4 bg-[#101010] border border-white/5 rounded-3xl p-4 sm:p-6'} flex flex-col overflow-y-auto`}>
          
          {/* Dashboard View */}
          {activeSegment === 'dashboard' && (
            <div className="max-w-md mx-auto w-full bg-[#101010] border border-white/5 rounded-[2rem] p-6 sm:p-8 my-auto shadow-2xl">
              <div>
                <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4 font-cairo text-right pr-1">{t('vault.treeTitle', 'شجرة النظام المالي')}</h3>
                
                <button 
                  onClick={onBack}
                  className="w-full flex items-center justify-between p-3 px-5 bg-[#181818]/80 hover:bg-white/5 rounded-2xl border border-white/5 transition-all group mb-6 text-right"
                >
                  <div className="flex items-center gap-3">
                     <ArrowRight size={16} className="text-gray-400 group-hover:text-amber-500 transition-colors" />
                     <span className="text-xs font-bold text-gray-300 font-cairo">{t('vault.backToMain', 'العودة للرئيسية')}</span>
                  </div>
                </button>

                <div className="space-y-3">
                   <div className="px-1 text-[11px] font-bold text-[#e5e7eb]/40 uppercase tracking-wider font-cairo text-right mb-2">{t('vault.transferSection', 'سندات التحويل المالي')}</div>
                   
                   {/* Receipt Row */}
                   <button 
                     onClick={() => { setActiveSegment('receipt'); setGlobalSearch(''); }}
                     className="w-full flex items-center justify-between p-3.5 px-5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl shadow-lg shadow-emerald-950/20 transition-all active:scale-[0.98] group"
                   >
                     <div className="flex items-center gap-3">
                        <TrendingUp size={18} className="text-white" />
                        <span className="text-xs font-bold font-cairo leading-none">{t('vault.receiptIncoming', 'سند قبض ونقد وارد')}</span>
                     </div>
                     <span className="px-2.5 py-1 rounded-lg bg-[#000000]/20 text-[9px] font-bold text-white font-cairo">{t('vault.incoming', 'وارد')}</span>
                   </button>

                   {/* Payment Row */}
                   <button 
                     onClick={() => { setActiveSegment('payment'); setGlobalSearch(''); }}
                     className="w-full flex items-center justify-between p-3.5 px-5 bg-[#181818] hover:bg-[#202020] border border-white/5 rounded-2xl transition-all active:scale-[0.98] group"
                   >
                     <div className="flex items-center gap-3">
                        <TrendingDown size={18} className="text-amber-500" />
                        <span className="text-xs font-bold text-gray-300 font-cairo leading-none">{t('vault.paymentOutgoing', 'سند صرف ونفقات صادرة')}</span>
                     </div>
                     <span className="px-2.5 py-1 rounded-lg bg-white/5 text-[9px] font-bold text-gray-500 font-cairo">{t('vault.outgoing', 'صادر')}</span>
                   </button>

                   {/* Transfer Row */}
                   <button 
                     onClick={() => { setActiveSegment('transfer'); setGlobalSearch(''); }}
                     className="w-full flex items-center justify-between p-3.5 px-5 bg-[#181818] hover:bg-[#202020] border border-white/5 rounded-2xl transition-all active:scale-[0.98] group"
                   >
                     <div className="flex items-center gap-3">
                        <ArrowRightLeft size={18} className="text-blue-400" />
                        <span className="text-xs font-bold text-gray-300 font-cairo leading-none">التحويل بين الصناديق</span>
                     </div>
                     <span className="px-2.5 py-1 rounded-lg bg-white/5 text-[9px] font-bold text-gray-500 font-cairo">داخلي</span>
                   </button>

                   <div className="pt-1 space-y-1">
                     <button 
                       onClick={() => setActiveSegment('funds')}
                       className="w-full flex items-center justify-between p-3 px-5 bg-transparent hover:bg-white/5 rounded-xl transition-all"
                     >
                       <div className="flex items-center gap-3">
                          <Wallet size={18} className="text-blue-500" />
                          <span className="text-xs font-bold text-gray-300 font-cairo leading-none">{t('vault.fundBalances', 'رصيد وحركات الصناديق المال')}</span>
                       </div>
                     </button>

                     <button 
                       onClick={() => setActiveSegment('customer-ledger')}
                       className="w-full flex items-center justify-between p-3 px-5 bg-transparent hover:bg-white/5 rounded-xl transition-all"
                     >
                       <div className="flex items-center gap-3">
                          <Users size={18} className="text-purple-500" />
                          <span className="text-xs font-bold text-gray-300 font-cairo leading-none">{t('vault.customersLedger', 'كشف حساب العملاء')}</span>
                       </div>
                     </button>
                   </div>
                </div>

                {/* Reports Section */}
                <div className="mt-8 pt-6 border-t border-white/5 space-y-4">
                   <div className="px-1 text-[11px] font-bold text-[#e5e7eb]/40 uppercase tracking-wider font-cairo text-right mb-2">{t('vault.reportsSection', 'التقارير والمؤشرات المالية')}</div>
                   
                   <div className="space-y-0.5">
                      {[
                        { name: t('vault.reportRevenues', 'الإيرادات والمداخيل'), key: 'revenues' },
                        { name: t('vault.reportExpenses', 'المصروفات والمدفوعات'), key: 'expenses' },
                        { name: t('vault.reportProfits', 'الأرباح والصافي'), key: 'profits' },
                        { name: t('vault.reportFundBalances', 'أرصدة كتل الصناديق'), key: 'fund-balances' },
                        { name: t('vault.reportOutstandingDebts', 'مديونيات وحقوق معلقة'), key: 'outstanding-debts' }
                      ].map((report, idx) => (
                        <div 
                          key={idx} 
                          onClick={() => { setActiveSegment('reports'); setReportSubSegment(report.key); setErrorMsg(null); }}
                          className="flex items-center justify-between p-2.5 px-4 text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition-all cursor-pointer group text-right"
                        >
                          <span className="text-xs font-bold font-cairo">{report.name}</span>
                          <div className="w-1.5 h-1.5 bg-gray-700 rounded-sm group-hover:bg-amber-500 transition-all ml-1" />
                        </div>
                      ))}
                   </div>
                </div>
              </div>
            </div>
          )}

          {/* 1. RECEIPT OR PAYMENT VOUCHERS LIST VIEW */}
          {(activeSegment === 'receipt' || activeSegment === 'payment') && !showAddModal && (
            <div className="space-y-5">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <div className="flex items-center gap-3">
                  <h3 className="text-base font-bold text-white font-cairo">
                    {activeSegment === 'receipt' ? 'سندات القبض' : 'سندات الصرف'}
                  </h3>
                  <button 
                    onClick={() => setActiveSegment('dashboard')}
                    className="p-1.5 bg-white/5 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-all"
                  >
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                 <div className="flex items-center justify-between text-[11px] text-gray-500 font-bold px-1" dir="rtl">
                    <span>البحث باسم العميل أو رقم السند:</span>
                    <div className="flex items-center gap-3">
                       <button 
                         type="button"
                         onClick={() => setSearchType('name')}
                         className={`transition-all font-cairo ${searchType === 'name' ? 'text-amber-500 font-bold underline decoration-2 underline-offset-4' : 'text-gray-500 hover:text-gray-300'}`}
                       >
                          البحث بالاسم
                       </button>
                       <span className="text-gray-700">|</span>
                       <button 
                         type="button"
                         onClick={() => setSearchType('number')}
                         className={`transition-all font-cairo ${searchType === 'number' ? 'text-amber-500 font-bold underline decoration-2 underline-offset-4' : 'text-gray-500 hover:text-gray-300'}`}
                       >
                          البحث بالرقم
                       </button>
                    </div>
                 </div>

                 <div className="flex gap-3">
                    <div className="flex-1 relative group">
                       <Search className="absolute right-4 top-3 text-gray-600 group-focus-within:text-amber-500 transition-colors" size={16} />
                       <input 
                         type="text" 
                         placeholder={searchType === 'name' ? 'ابدأ بكتابة اسم العميل...' : 'ابدأ بكتابة رقم السند...'}
                         value={globalSearch}
                         onChange={(e) => setGlobalSearch(e.target.value)}
                         className="w-full bg-[#161616] border border-white/5 rounded-xl pr-11 pl-4 py-3 text-[11px] font-cairo text-white outline-none focus:border-amber-500/50 transition-all font-bold placeholder:text-gray-700"
                       />
                    </div>
                    
                    <button 
                       onClick={() => setShowAddModal(true)}
                       className="p-3 bg-amber-600/10 text-amber-500 border border-amber-500/20 rounded-xl hover:bg-amber-600 hover:text-white transition-all flex items-center justify-center active:scale-95"
                       title="إضافة سند جديد"
                    >
                       <Plus size={20} />
                    </button>
                 </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between pb-1" dir="rtl">
                   <div className="flex items-center gap-2">
                      <div className="p-2 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-xl">
                         <FileText size={16} />
                      </div>
                      <span className="text-xs font-bold text-gray-300 font-cairo">جدول جميع السندات المسجلة في النظام</span>
                   </div>
                   <button className="p-2 bg-white/5 border border-white/5 rounded-lg text-gray-400 hover:text-white transition-all">
                      <ArrowUpDown size={14} />
                   </button>
                </div>

                <div className="border border-white/5 rounded-2xl overflow-x-auto bg-black/10 scrollbar-thin">
                  <table className="w-full text-right text-[11px] whitespace-nowrap">
                    <thead>
                      <tr className="bg-white/5 text-gray-500 font-bold border-b border-white/5 uppercase">
                        <th className="px-4 py-3">رقم السند</th>
                        <th className="px-4 py-3">اسم العميل / الجهة</th>
                        <th className="px-4 py-3 text-center">نوع العملية</th>
                        <th className="px-4 py-3 text-center">مبلغ السند</th>
                        <th className="px-4 py-3 text-left">التاريخ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {transactions
                        .filter(tx => tx.type === activeSegment)
                        .filter(tx => {
                          if (searchType === 'name') {
                            return tx.customerName.toLowerCase().includes(globalSearch.toLowerCase());
                          } else {
                            return tx.voucherNumber.toString().includes(globalSearch);
                          }
                        })
                        .map(tx => (
                          <tr key={tx.id} className="hover:bg-white/5 bg-[#141414] transition-all group">
                            <td className="px-4 py-2.5 font-mono font-bold text-amber-500">{tx.voucherNumber}</td>
                            <td className="px-4 py-2.5 font-bold text-gray-200">{tx.customerName}</td>
                            <td className="px-4 py-2.5 text-center">
                               <span className={`px-2 py-1 rounded text-[10px] font-bold ${activeSegment === 'receipt' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                                  {tx.transactionCategory || (activeSegment === 'receipt' ? 'قبض' : 'صرف')}
                               </span>
                            </td>
                            <td className={`px-4 py-2.5 text-center font-bold text-xs ${activeSegment === 'receipt' ? 'text-emerald-500' : 'text-rose-500'}`}>
                              {Math.abs(tx.amount).toLocaleString('en-US')} <span className="text-[9px] opacity-70 font-sans">{tx.currency}</span>
                            </td>
                            <td className="px-4 py-2.5 text-left text-gray-500 font-mono italic">
                              {new Date(tx.timestamp).toLocaleString('ar-YE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 1. RECEIPT OR PAYMENT VOUCHERS SUBMIT SEGMENTS (Now as a modal or dedicated state) */}
          {(activeSegment === 'receipt' || activeSegment === 'payment') && showAddModal && (
            <div className="space-y-6 animate-fade-in">
              
              {/* Show PRINT PREVIEW if true */}
              {showPrintPreview ? (
                <div className="fixed inset-0 z-[120] bg-black/95 flex flex-col pointer-events-auto" dir="rtl">
                  {/* Top Actions Bar */}
                  <div className="flex justify-between items-center bg-black/50 p-4 border-b border-white/10 shrink-0 flex-wrap gap-4 print:hidden">
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => setShowPrintPreview(false)}
                        className="px-4 py-2 bg-slate-200 border border-slate-300 rounded-xl text-slate-900 hover:bg-slate-300 font-bold transition-all flex items-center gap-2 text-sm shadow-md"
                      >
                        <ArrowLeft size={16} className="rtl:rotate-180" />
                        العودة للتعديل
                      </button>
                      <h2 className="text-white font-bold hidden sm:block">معاينة {activeSegment === 'receipt' ? 'سند قبض' : 'سند صرف'}</h2>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {/* Save Voucher */}
                      <button 
                        onClick={(e) => handleSaveFinalVoucher(e, 'commit')}
                        disabled={isPosting}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition-all disabled:opacity-50 flex items-center gap-2 text-sm shadow-[0_0_15px_rgba(5,150,105,0.3)]"
                      >
                        {isPosting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        حفظ وترحيل
                      </button>

                      {/* Save and print */}
                      <button 
                        onClick={(e) => handleSaveFinalVoucher(e, 'print')}
                        disabled={isPosting}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all flex items-center gap-2 text-sm disabled:opacity-50"
                      >
                        <Printer size={16} />
                        حفظ وطباعة مباشرة
                      </button>

                      {/* Save and WhatsApp */}
                      <button 
                        onClick={(e) => handleSaveFinalVoucher(e, 'whatsapp')}
                        disabled={isPosting}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition-all flex items-center gap-2 text-sm shadow-[0_0_15px_rgba(5,150,105,0.3)] disabled:opacity-50"
                      >
                        {isPosting ? <Loader2 size={16} className="animate-spin" /> : <WhatsAppIcon className="w-4 h-4 flex-shrink-0" />}
                        حفظ وتصدير للواتس
                      </button>
                    </div>
                  </div>

                  {/* High Fidelity Paper (820px) centered to look like an actual generated PDF */}
                  <div className="flex-1 overflow-x-auto bg-black p-4 md:p-8 pb-24 text-right w-full">
                    <style>{`
                      @media print {
                        body * {
                          visibility: hidden !important;
                        }
                        #print-area, #print-area * {
                          visibility: visible !important;
                        }
                        #print-area {
                          position: absolute !important;
                          left: 0 !important;
                          top: 0 !important;
                          width: 100% !important;
                          max-width: 100% !important;
                          color: #000000 !important;
                          background-color: #ffffff !important;
                          box-shadow: none !important;
                          border: none !important;
                          padding: 30px !important;
                          margin: 0 !important;
                          border-radius: 0 !important;
                        }
                      }
                    `}</style>
                    <div id="print-area" className="p-8 bg-white text-gray-900 print:p-0 print:bg-white print:text-black w-[794px] min-h-[1123px] mx-auto flex flex-col relative shrink-0 font-cairo text-right" dir="rtl">
                      
                      {/* Header Box identical format to device inspection report */}
                      <div className="flex justify-between items-start border-b-2 border-gray-900 pb-4 mb-6">
                        {/* Right Corner: Shop Name */}
                        <div className="text-right flex-1 pt-1">
                          <h2 className="text-xl font-black text-gray-900 tracking-tight leading-tight font-cairo">{shopConfig?.shopName || 'عالم الصيانة والتجارة'}</h2>
                          <div className="text-sm font-black text-gray-900 tracking-tight leading-tight mt-1.5 font-cairo">قسم الحسابات والمالية</div>
                          <div className="mt-2 space-y-1">
                            {(shopConfig?.phone1 || shopConfig?.phone2) && (
                              <div className="text-[10px] font-bold text-gray-800 flex items-center justify-start gap-1.5 w-fit">
                                <span>تلفون :</span>
                                <span dir="ltr" className="font-mono">
                                  {shopConfig?.phone1}
                                  {shopConfig?.phone1 && shopConfig?.phone2 && ' - '}
                                  {shopConfig?.phone2}
                                </span>
                                <div className="flex items-center gap-1 mr-1.5">
                                  <Smartphone size={10} className="text-gray-700" />
                                  {(shopConfig?.phone1Whatsapp || shopConfig?.phone2Whatsapp) && (
                                    <MessageCircle size={10} className="text-green-600" />
                                  )}
                                </div>
                              </div>
                            )}
                            {shopConfig?.landline && (
                              <div className="text-[10px] font-bold text-gray-800 flex items-center justify-start gap-1.5 w-fit">
                                <span>ثابت :</span>
                                <span dir="ltr" className="font-mono">{shopConfig.landline}</span>
                                <div className="flex items-center gap-1 mr-1.5">
                                  <Phone size={10} className="text-gray-700" />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Center: Title / Logo */}
                        <div className="text-center flex-[1.4] flex flex-col items-center justify-center">
                          {shopConfig?.logoUrl ? (
                            <img src={shopConfig.logoUrl} alt="Logo" className="h-16 max-w-[150px] object-contain mb-1.5" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-12 h-12 border border-dashed border-gray-300 rounded-xl mb-1.5 flex items-center justify-center text-gray-400 text-[10px] font-bold font-sans">شعار المحل</div>
                          )}
                          <h1 className="text-xl font-black text-gray-950 tracking-tight border-b-2 border-gray-950 px-6 py-0.5 inline-block font-cairo bg-gray-50/50">
                            {activeSegment === 'receipt' ? 'سَنَد قَبْض مَالِي' : 'سَنَد صَرْف مَالِي'}
                          </h1>
                        </div>

                        {/* Left Corner: Metadata */}
                        <div className="text-left flex-1 space-y-1 pt-1 bg-gray-50/50 p-3 rounded-lg border border-gray-200">
                          <div className="text-sm font-bold text-gray-700 flex justify-between gap-4">
                            <span>رقم السند:</span>
                            <span className="font-mono text-gray-900">{nextVoucherNum}</span>
                          </div>
                          <div className="text-sm font-bold text-gray-700 flex justify-between gap-4">
                            <span>التاريخ:</span>
                            <span className="font-mono text-gray-900">{new Date().toLocaleDateString('ar-YE', { year: 'numeric', month: 'numeric', day: 'numeric' })}</span>
                          </div>
                          <div className="text-sm font-bold text-gray-700 flex justify-between gap-4">
                            <span>وقت الإصدار:</span>
                            <span className="font-mono text-gray-900">
                              {new Date().toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div className="text-sm font-bold text-gray-700 flex justify-between gap-4 border-t border-gray-200 pt-1 mt-1 font-cairo">
                            <span>المستخدم:</span>
                            <span className="font-mono text-gray-900">1</span>
                          </div>
                          {funds.find(f => f.id === selectedFundId)?.type !== 'cash' && referenceNumber && (
                            <div className="text-sm font-bold text-gray-700 flex justify-between gap-4">
                              <span>رقم المرجع:</span>
                              <span className="font-mono text-gray-900">{referenceNumber}</span>
                            </div>
                          )}
                        </div>
                      </div>






                      {/* Main Voucher Grid Information */}
                      <div className="border border-gray-400 rounded-xl overflow-hidden mb-6">
                        <div className="grid grid-cols-4 bg-gray-50 border-b border-gray-300 text-xs text-gray-700 font-bold">
                          <div className="col-span-1 px-4 py-2 border-l border-gray-300">البيان المالي</div>
                          <div className="col-span-3 px-4 py-2">التفاصيل والبيانات المدخلة</div>
                        </div>
                        
                        <div className="divide-y divide-gray-300 text-xs">
                          {/* 1. Name */}
                          <div className="grid grid-cols-4">
                            <div className="col-span-1 bg-gray-50 px-4 py-2.5 font-bold border-l border-gray-300 text-gray-800">
                              {activeSegment === 'receipt' ? 'مقبوض من السيد:' : 'مدفوع إلى السيد:'}
                            </div>
                            <div className="col-span-3 px-4 py-2.5 font-bold text-gray-950">
                              {customerSearch || 'جهة عامة أخرى'}
                            </div>
                          </div>

                          {/* 2. Amount */}
                          <div className="grid grid-cols-4">
                            <div className="col-span-1 bg-gray-50 px-4 py-2.5 font-bold border-l border-gray-300 text-gray-800">المبلغ الإجمالي:</div>
                            <div className="col-span-3 px-4 py-2.5 font-black text-emerald-700 text-sm">
                              {parseFloat(voucherAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {selectedCurrency}
                            </div>
                          </div>

                          {/* 3. Category */}
                          <div className="grid grid-cols-4">
                            <div className="col-span-1 bg-gray-50 px-4 py-2.5 font-bold border-l border-gray-300 text-gray-800">نوع العملية والتصنيف:</div>
                            <div className="col-span-3 px-4 py-2.5 text-gray-900 font-semibold">
                              {selectedCategory}
                            </div>
                          </div>

                          {/* 4. Fund Box */}
                          <div className="grid grid-cols-4">
                            <div className="col-span-1 bg-gray-50 px-4 py-2.5 font-bold border-l border-gray-300 text-gray-800">الصندوق المستلم:</div>
                            <div className="col-span-3 px-4 py-2.5 text-gray-900 font-semibold flex items-center gap-2">
                              <span>{funds.find(f => f.id === selectedFundId)?.name}</span>
                              <span className="text-[10px] bg-gray-200 text-gray-700 px-2 py-0.5 rounded font-black">
                                {funds.find(f => f.id === selectedFundId)?.type === 'cash' ? 'نقدي' : 'حساب بنكي'}
                              </span>
                            </div>
                          </div>

                          {/* 5. Bank Info if exists */}
                          {funds.find(f => f.id === selectedFundId)?.type !== 'cash' && (
                            <>
                              <div className="grid grid-cols-4">
                                <div className="col-span-1 bg-gray-50 px-4 py-2.5 font-bold border-l border-gray-300 text-gray-800">رقم المرجع البنكي:</div>
                                <div className="col-span-3 px-4 py-2.5 text-gray-955 font-mono font-bold">
                                  {referenceNumber}
                                </div>
                              </div>
                              <div className="grid grid-cols-4">
                                <div className="col-span-1 bg-gray-50 px-4 py-2.5 font-bold border-l border-gray-300 text-gray-800">اسم مودع المبلغ:</div>
                                <div className="col-span-3 px-4 py-2.5 text-gray-955 font-semibold">
                                  {depositorName}
                                </div>
                              </div>
                            </>
                          )}

                          {/* 6. Notes */}
                          <div className="grid grid-cols-4">
                            <div className="col-span-1 bg-gray-50 px-4 py-2.5 font-bold border-l border-gray-300 text-gray-800">الشرح والبيان:</div>
                            <div className="col-span-3 px-4 py-2.5 text-gray-800 italic">
                              {voucherNotes || 'لا يوجد'}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Stamp & Signatures */}
                      <div className="grid grid-cols-3 gap-6 text-center mt-12 text-xs pt-4 border-t border-dashed border-gray-300">
                        <div>
                          <p className="font-bold text-gray-800 mb-10">المستلم / المحاسب</p>
                          <p className="text-gray-400">_____________________</p>
                        </div>
                        <div>
                          <p className="font-bold text-gray-800 mb-10">الختم الرسمي</p>
                          <div className="w-16 h-16 border-2 border-dashed border-gray-300 rounded-full mx-auto flex items-center justify-center text-gray-300 text-[10px]">قسم الصندوق</div>
                        </div>
                        <div>
                          <p className="font-bold text-gray-800 mb-10">المودع / العميل</p>
                          <p className="text-gray-400">_____________________</p>
                        </div>
                      </div>

                      <div className="border-t-[3px] border-black mt-2 mb-1 border-solid"></div>
                      
                      {/* Address and Facebook */}
                      <div className="flex flex-row items-center justify-between text-[10px] font-bold text-black font-cairo py-1 mt-0">
                        {shopConfig?.address && (
                          <div className="flex items-center gap-1.5 justify-center flex-row-reverse text-center w-max">
                             <MapPin size={12} className="text-gray-600" />
                             <span>{shopConfig.address}</span>
                          </div>
                        )}

                        {shopConfig?.facebookUrl && (
                          <div className="flex items-center gap-1.5 justify-center flex-row-reverse text-center w-max">
                             <Facebook size={12} className="text-blue-600" />
                             <span dir="ltr">{shopConfig.facebookUrl}</span>
                          </div>
                        )}
                      </div>

                      <div className="mt-2">
                        <BankAccountsFooter shopConfig={shopConfig} currentOutput={currentOutput || { output_datetime: new Date() }} />
                      </div>

                      {/* Footer */}
                      <div className="text-center text-[9px] text-gray-500 font-sans mt-4 pt-2 border-t border-gray-200">
                        تاريخ الطباعة: {new Date().toLocaleString('ar-YE')} | النظام المحاسبي الموحد للخزائن والعهود
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Header Title */}
                  <div className="border-b border-white/5 pb-3 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => setShowAddModal(false)}
                        className="p-1.5 bg-white/5 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-all ml-1"
                      >
                        <ArrowRight size={16} />
                      </button>
                      <h3 className="text-base font-black text-white font-cairo">
                         {activeSegment === 'receipt' ? 'بناء سند قبض جديد' : 'بناء سند صرف جديد'}
                      </h3>
                    </div>
                    <div className="bg-[#141414] px-3 py-1 rounded-xl border border-white/5 flex items-center gap-2">
                      <span className="text-[9px] text-gray-500 font-bold font-cairo">رقم السند المتوقع:</span>
                      <span className="text-sm font-mono font-black text-amber-500">{nextVoucherNum}</span>
                    </div>
                  </div>

                   {/* FORM BODY - Super compact styled elements */}
                  <div className="max-w-xl mx-auto bg-[#141414] border border-white/5 rounded-2xl p-3.5 space-y-1.5 font-cairo">
                     
                     {/* Row 1: تحديد الصندوق */}
                     <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-4 py-1 border-b border-white/5">
                        <label className="text-[11px] font-bold text-gray-400 min-w-[120px]">
                          الصندوق المالي:
                        </label>
                        <select 
                          value={selectedFundId}
                          onChange={(e) => setSelectedFundId(e.target.value)}
                          className="flex-1 max-w-xs bg-black/40 border border-white/5 rounded-xl px-3 py-1 text-xs text-white outline-none focus:border-amber-500/50 text-right appearance-none font-semibold"
                          required
                        >
                           <option value="" className="bg-[#1c1c1c]">-- اختر الصندوق --</option>
                           {funds.map(f => {
                             const mCur = currencies.find(c => c.name === f.currency);
                             const curSym = mCur ? mCur.symbol : f.currency;
                             const typeStr = f.type === 'cash' ? 'نقدي' : 'بنكي';
                             return (
                               <option key={f.id} value={f.id} className="bg-[#1c1c1c]">
                                 {`${f.name} / ${curSym} / ${typeStr}`}
                               </option>
                             );
                           })}
                        </select>
                     </div>

                     {/* Layout switches depending on whether selected fund is CASH or BANK */}
                     {(() => {
                        const matchedFund = funds.find(f => f.id === selectedFundId);
                        const isCash = matchedFund ? matchedFund.type === 'cash' : true;

                        if (isCash) {
                          return (
                            <>
                              {/* CASH LAYOUT */}
                              
                              {/* Row 3: أدخل المبلغ */}
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-4 py-1 border-b border-white/5">
                                 <label className="text-[11px] font-bold text-gray-400 min-w-[120px]">
                                   أدخل المبلغ:
                                 </label>
                                 <div className="flex-1 max-w-xs relative text-right">
                                    <input 
                                      type="number"
                                      dir="ltr"
                                      lang="en"
                                      onFocus={e => e.target.select()}
                                      placeholder="0.00"
                                      value={voucherAmount}
                                      onChange={(e) => setVoucherAmount(e.target.value)}
                                      className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-1 text-xs text-emerald-400 font-bold font-mono outline-none focus:border-amber-500/50 placeholder:text-gray-800 text-left"
                                      required
                                    />
                                    {selectedCurrency && (
                                      <span className="absolute right-3 top-1 text-[9px] text-gray-500 font-bold">{selectedCurrency}</span>
                                    )}
                                 </div>
                              </div>

                              {/* Row 4: اسم العميل (أوتوكومبليت حساس للاحرف) */}
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-4 py-1 border-b border-white/5">
                                 <label className="text-[11px] font-bold text-gray-400 min-w-[120px]">
                                   اسم العميل / المستفيد:
                                 </label>
                                 <div className="flex-1 max-w-xs relative bg-transparent text-right">
                                    <div className="flex gap-1">
                                      <input 
                                        type="text"
                                        placeholder="ابحث بالحرف أو اختر من السهم..."
                                        value={customerSearch}
                                        onChange={(e) => {
                                           setCustomerSearch(e.target.value);
                                           setSelectedCustomerId('');
                                           setShowCustomerDropdown(true);
                                        }}
                                        onFocus={() => setShowCustomerDropdown(true)}
                                        className="flex-1 bg-black/40 border border-white/5 rounded-xl px-3 py-1 text-xs text-white outline-none focus:border-amber-500/50"
                                      />
                                      <button 
                                        type="button"
                                        onClick={() => setShowCustomerDropdown(!showCustomerDropdown)}
                                        className="px-2 bg-white/5 hover:bg-white/10 rounded-xl text-gray-400 border border-white/5"
                                      >
                                        <ArrowUpDown size={14} />
                                      </button>
                                    </div>

                                    {/* Combobox Dropdown */}
                                    {showCustomerDropdown && (
                                       <div className="absolute top-full right-0 w-full mt-1 bg-[#1a1a1a] border border-white/10 rounded-xl overflow-hidden z-30 shadow-2xl max-h-40 overflow-y-auto">
                                         {customers
                                           .filter(c => 
                                             !customerSearch || 
                                             c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
                                             (c.phone1 && c.phone1.includes(customerSearch))
                                           )
                                           .map(c => (
                                             <button 
                                               key={c.id}
                                               type="button"
                                               onClick={() => {
                                                  setCustomerSearch(c.name);
                                                  setSelectedCustomerId(c.id);
                                                  setShowCustomerDropdown(false);
                                               }}
                                               className="w-full text-right px-3 py-2 text-[10px] text-gray-300 hover:bg-amber-600/20 hover:text-white transition-all font-cairo border-b border-white/5 last:border-0"
                                             >
                                               {c.name} {c.companyName ? `(${c.companyName})` : ''}
                                             </button>
                                           ))}
                                           {customers.filter(c => !customerSearch || c.name.toLowerCase().includes(customerSearch.toLowerCase())).length === 0 && (
                                              <div className="p-3 text-center text-xs text-gray-650">لا توجد نتائج مسبقة، السند سيسجل باسم جديد</div>
                                           )}
                                       </div>
                                    )}
                                 </div>
                              </div>

                              {/* Row 5: نوع العملية */}
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-4 py-1 border-b border-white/5">
                                 <label className="text-[11px] font-bold text-gray-400 min-w-[120px]">
                                   نوع العملية:
                                 </label>
                                 <select 
                                   value={selectedCategory}
                                   onChange={(e) => setSelectedCategory(e.target.value)}
                                   className="flex-1 max-w-xs bg-black/40 border border-white/5 rounded-xl px-3 py-1 text-xs text-white outline-none focus:border-amber-500/50 appearance-none text-right font-semibold"
                                   required
                                 >
                                    {txTypes
                                      .filter(cat => cat.type === activeSegment)
                                      .map(cat => (
                                        <option key={cat.id} value={cat.name} className="bg-[#1c1c1c]">{cat.name}</option>
                                      ))
                                    }
                                 </select>
                              </div>

                              {/* Row 6: ملاحظات السند */}
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-4 py-1">
                                 <label className="text-[11px] font-bold text-gray-400 min-w-[120px]">
                                   البيان والملاحظات:
                                 </label>
                                 <input 
                                   type="text"
                                   placeholder="أدخل ملاحظات السند..."
                                   value={voucherNotes}
                                   onChange={(e) => setVoucherNotes(e.target.value)}
                                   className="flex-1 max-w-xs bg-black/40 border border-white/5 rounded-xl px-3 py-1 text-xs text-white outline-none focus:border-amber-500/50"
                                   required
                                 />
                              </div>

                            </>
                          );
                        } else {
                          return (
                            <>
                              {/* BANK LAYOUT */}
                              
                              {/* Row 2: رقم المرجع */}
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-4 py-1 border-b border-white/5">
                                 <label className="text-[11px] font-bold text-gray-400 min-w-[120px]">
                                   رقم المرجع البنكي:
                                 </label>
                                 <input 
                                   type="text"
                                   placeholder="أدخل رقم المرجع أو الشيك..."
                                   value={referenceNumber}
                                   onChange={(e) => setReferenceNumber(e.target.value)}
                                   className="flex-1 max-w-xs bg-black/40 border border-white/5 rounded-xl px-3 py-1 text-xs text-white outline-none focus:border-amber-500/50 font-mono text-left"
                                   required
                                 />
                              </div>

                              {/* Row 3: المبلغ المالي */}
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-4 py-1 border-b border-white/5">
                                 <label className="text-[11px] font-bold text-gray-400 min-w-[120px]">
                                   المبلغ المالي:
                                 </label>
                                 <div className="flex-1 max-w-xs relative text-right">
                                    <input 
                                      type="number"
                                      dir="ltr"
                                      lang="en"
                                      onFocus={e => e.target.select()}
                                      placeholder="0.00"
                                      value={voucherAmount}
                                      onChange={(e) => setVoucherAmount(e.target.value)}
                                      className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-1 text-xs text-emerald-400 font-bold font-mono outline-none focus:border-amber-500/50 placeholder:text-gray-800 text-left"
                                      required
                                    />
                                    {selectedCurrency && (
                                      <span className="absolute right-3 top-1 text-[9px] text-gray-500 font-bold">{selectedCurrency}</span>
                                    )}
                                 </div>
                              </div>

                              {/* Row 4: اسم المودع */}
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-4 py-1 border-b border-white/5">
                                 <label className="text-[11px] font-bold text-gray-400 min-w-[120px]">
                                   اسم المودع الشخصي:
                                 </label>
                                 <input 
                                   type="text"
                                   placeholder="أدخل اسم مودع المبلغ بالكامل..."
                                   value={depositorName}
                                   onChange={(e) => setDepositorName(e.target.value)}
                                   className="flex-1 max-w-xs bg-black/40 border border-white/5 rounded-xl px-3 py-1 text-xs text-white outline-none focus:border-amber-500/50"
                                   required
                                 />
                              </div>

                              {/* Row 5: اسم العميل (أوتوكومبليت حساس للاحرف) */}
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-4 py-1 border-b border-white/5">
                                 <label className="text-[11px] font-bold text-gray-400 min-w-[120px]">
                                   اسم العميل / المستفيد:
                                 </label>
                                 <div className="flex-1 max-w-xs relative bg-transparent text-right">
                                    <div className="flex gap-1">
                                      <input 
                                        type="text"
                                        placeholder="ابحث بالحرف أو اختر من السهم..."
                                        value={customerSearch}
                                        onChange={(e) => {
                                           setCustomerSearch(e.target.value);
                                           setSelectedCustomerId('');
                                           setShowCustomerDropdown(true);
                                        }}
                                        onFocus={() => setShowCustomerDropdown(true)}
                                        className="flex-1 bg-black/40 border border-white/5 rounded-xl px-3 py-1 text-xs text-white outline-none focus:border-amber-500/50"
                                      />
                                      <button 
                                        type="button"
                                        onClick={() => setShowCustomerDropdown(!showCustomerDropdown)}
                                        className="px-2 bg-white/5 hover:bg-white/10 rounded-xl text-gray-400 border border-white/5"
                                      >
                                        <ArrowUpDown size={14} />
                                      </button>
                                    </div>

                                    {/* Combobox Dropdown */}
                                    {showCustomerDropdown && (
                                       <div className="absolute top-full right-0 w-full mt-1 bg-[#1a1a1a] border border-white/10 rounded-xl overflow-hidden z-30 shadow-2xl max-h-40 overflow-y-auto">
                                         {customers
                                           .filter(c => 
                                             !customerSearch || 
                                             c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
                                             (c.phone1 && c.phone1.includes(customerSearch))
                                           )
                                           .map(c => (
                                             <button 
                                               key={c.id}
                                               type="button"
                                               onClick={() => {
                                                  setCustomerSearch(c.name);
                                                  setSelectedCustomerId(c.id);
                                                  setShowCustomerDropdown(false);
                                               }}
                                               className="w-full text-right px-3 py-2 text-[10px] text-gray-300 hover:bg-amber-600/20 hover:text-white transition-all font-cairo border-b border-white/5 last:border-0"
                                             >
                                               {c.name} {c.companyName ? `(${c.companyName})` : ''}
                                             </button>
                                           ))}
                                           {customers.filter(c => !customerSearch || c.name.toLowerCase().includes(customerSearch.toLowerCase())).length === 0 && (
                                              <div className="p-3 text-center text-xs text-gray-650">لا توجد نتائج مسبقة، السند سيسجل باسم جديد</div>
                                           )}
                                       </div>
                                    )}
                                 </div>
                              </div>

                              {/* Row 6: نوع العملية */}
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-4 py-1 border-b border-white/5">
                                 <label className="text-[11px] font-bold text-gray-400 min-w-[120px]">
                                   نوع العملية:
                                 </label>
                                 <select 
                                   value={selectedCategory}
                                   onChange={(e) => setSelectedCategory(e.target.value)}
                                   className="flex-1 max-w-xs bg-black/40 border border-white/5 rounded-xl px-3 py-1 text-xs text-white outline-none focus:border-amber-500/50 appearance-none text-right font-semibold"
                                   required
                                 >
                                    {txTypes
                                      .filter(cat => cat.type === activeSegment)
                                      .map(cat => (
                                        <option key={cat.id} value={cat.name} className="bg-[#1c1c1c]">{cat.name}</option>
                                      ))
                                    }
                                 </select>
                              </div>

                              {/* Row 7: ملاحظات السند */}
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-4 py-1">
                                 <label className="text-[11px] font-bold text-gray-400 min-w-[120px]">
                                   البيان والملاحظات:
                                 </label>
                                 <input 
                                   type="text"
                                   placeholder="أدخل ملاحظات السند..."
                                   value={voucherNotes}
                                   onChange={(e) => setVoucherNotes(e.target.value)}
                                   className="flex-1 max-w-xs bg-black/40 border border-white/5 rounded-xl px-3 py-1 text-xs text-white outline-none focus:border-amber-500/50"
                                   required
                                 />
                              </div>

                            </>
                          );
                        }
                     })()}
                  </div>

                  {/* Form Actions */}
                  <div className="flex items-center justify-between pt-4 border-t border-white/5 max-w-xl mx-auto">
                     <button 
                        onClick={() => setShowAddModal(false)}
                        className="flex items-center gap-1.5 px-6 py-2.5 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-xl transition-all font-bold font-cairo text-xs active:scale-95"
                     >
                        <ArrowRight size={14} />
                        رجوع وإلغاء
                     </button>
                     
                     <button 
                       onClick={() => setShowPrintPreview(true)}
                       disabled={!isFormValid()}
                       className={`flex items-center gap-1.5 px-8 py-2.5 rounded-xl font-bold font-cairo text-xs text-white transition-all shadow-md active:scale-95 ${!isFormValid() ? 'bg-gray-700 cursor-not-allowed opacity-50' : 'bg-amber-600 hover:bg-amber-500 text-black font-black'}`}
                     >
                        <Eye size={14} />
                        إجراء معاينة للمراجعة
                     </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TRANSFER FUNDS VIEW */}
          {activeSegment === 'transfer' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                <button 
                  onClick={() => setActiveSegment('dashboard')}
                  className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white transition-all ml-2"
                >
                  <ArrowRight size={20} />
                </button>
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-blue-500/10 rounded-xl text-blue-400">
                    <ArrowRightLeft size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-white font-cairo leading-none">التحويل بين الصناديق</h2>
                    <p className="text-xs text-gray-400 font-cairo mt-1">نقل الأموال بين الصناديق المختلفة بنفس العملة</p>
                  </div>
                </div>
              </div>

              <form onSubmit={handlePostTransfer} className="bg-[#181818] border border-white/5 rounded-3xl p-6 sm:p-8">
                <div className="max-w-2xl mx-auto space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {/* Source Fund */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 font-cairo flex items-center gap-2">
                        <Wallet size={14} className="text-rose-400" />
                        الصندوق المُحول منه (الرصيد يقل)
                      </label>
                      <select
                        value={transferSourceFundId}
                        onChange={(e) => setTransferSourceFundId(e.target.value)}
                        className="w-full bg-[#101010] border border-white/10 rounded-xl px-4 py-3 text-sm font-cairo text-white focus:border-blue-500/50 outline-none transition-all"
                        required
                      >
                        <option value="" disabled className="text-gray-600">اختر الصندوق المصدر...</option>
                        {funds.filter(f => f.status === 'active').map(f => (
                          <option key={f.id} value={f.id} className="bg-[#1c1c1c]">{f.name} ({f.currency}) - الرصيد: {f.balance?.toLocaleString('en-US')}</option>
                        ))}
                      </select>
                    </div>

                    {/* Destination Fund */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 font-cairo flex items-center gap-2">
                        <Wallet size={14} className="text-emerald-400" />
                        الصندوق المُحول إليه (الرصيد يزداد)
                      </label>
                      <select
                        value={transferDestFundId}
                        onChange={(e) => setTransferDestFundId(e.target.value)}
                        className="w-full bg-[#101010] border border-white/10 rounded-xl px-4 py-3 text-sm font-cairo text-white focus:border-blue-500/50 outline-none transition-all"
                        required
                      >
                        <option value="" disabled className="text-gray-600">اختر الصندوق الوجهة...</option>
                        {funds.filter(f => f.status === 'active').map(f => (
                          <option key={f.id} value={f.id} className="bg-[#1c1c1c]">{f.name} ({f.currency}) - الرصيد: {f.balance?.toLocaleString('en-US')}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 font-cairo">المبلغ المراد تحويله</label>
                    <div className="relative">
                      <input 
                        type="number"
                        min="0.01"
                        step="0.01"
                        dir="ltr"
                        lang="en"
                        onFocus={e => e.target.select()}
                        value={transferAmount}
                        onChange={(e) => setTransferAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-[#101010] border border-white/10 rounded-xl px-4 py-3 text-lg font-mono font-bold text-blue-400 focus:border-blue-500/50 outline-none transition-all text-center"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 font-cairo flex items-center gap-2">
                      <FileText size={14} />
                      البيان / ملاحظات التحويل
                    </label>
                    <textarea 
                      value={transferNotes}
                      onChange={(e) => setTransferNotes(e.target.value)}
                      placeholder="أدخل سبب أو ملاحظات التحويل (اختياري)..."
                      className="w-full bg-[#101010] border border-white/10 rounded-xl px-4 py-3 text-sm font-cairo text-white focus:border-blue-500/50 outline-none transition-all resize-none h-24"
                    />
                  </div>

                  <div className="pt-4 flex items-center justify-end">
                    <button 
                      type="submit"
                      disabled={isPosting || !transferSourceFundId || !transferDestFundId || !transferAmount}
                      className="flex items-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:opacity-50 text-white rounded-xl font-bold font-cairo transition-all active:scale-95 shadow-lg shadow-blue-500/20"
                    >
                      {isPosting ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                      تنفيذ التحويل المالي
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}

          {/* 2. BOX FUNDS REAL-TIME OVERLAY */}
          {activeSegment === 'funds' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setActiveSegment('dashboard')}
                    className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white transition-all ml-2"
                  >
                    <ArrowRight size={20} />
                  </button>
                  <div>
                    <h3 className="text-xl font-black text-white font-cairo flex items-center gap-2">
                      <Wallet className="text-blue-400" size={22} />
                      أرصدة وحركات الصناديق المالية
                    </h3>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative group flex-1 sm:flex-none sm:w-64">
                    <Search className="absolute right-3 top-2.5 text-gray-500 group-focus-within:text-blue-500 transition-colors" size={16} />
                    <input 
                      type="text" 
                      placeholder="بحث في الصناديق والحركات..."
                      value={globalSearch}
                      onChange={(e) => setGlobalSearch(e.target.value)}
                      className="w-full bg-[#181818] border border-white/5 rounded-xl pr-10 pl-4 py-2 text-xs font-cairo text-white outline-none focus:border-blue-500/50 transition-all"
                    />
                  </div>
                  {/* Add New Fund / Movement Button */}
                  <button 
                    onClick={() => {
                        // For simplicity, we trigger the payment/receipt modal if they need to add money
                        // Or we can just show a message. But to follow the pattern:
                        setActiveSegment('receipt');
                        setShowAddModal(true);
                    }}
                    className="p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all shadow-lg shadow-blue-900/20 active:scale-95"
                    title="إضافة حركة نقدية جديدة"
                  >
                    <Plus size={20} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {funds.map((fund) => {
                  const fundTxs = transactions.filter(t => t.fundId === fund.id);
                  const inSum = fundTxs.filter(t => t.type === 'receipt').reduce((acc, curr) => acc + Math.abs(Number(curr.amount)), 0);
                  const outSum = fundTxs.filter(t => t.type === 'payment').reduce((acc, curr) => acc + Math.abs(Number(curr.amount)), 0);

                  return (
                    <div key={fund.id} className="bg-[#181818] border border-white/5 rounded-2xl p-5 flex flex-col justify-between gap-4 hover:border-blue-500/30 transition-all group">
                      <div>
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-black text-white font-cairo">{fund.name}</h4>
                          <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black ${fund.type === 'cash' ? 'bg-amber-500/15 text-amber-500' : 'bg-blue-500/15 text-blue-400'}`}>
                            {fund.type === 'cash' ? 'نقدي' : 'بنك'}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-500 font-cairo mt-1">{fund.description || 'لا يوجد وصف للمجمع التلقائي للمال.'}</p>
                      </div>

                      <div className="bg-[#121212] p-3 rounded-xl border border-white/5 grid grid-cols-2 gap-2 text-center">
                        <div>
                          <p className="text-[9px] text-gray-500 font-cairo leading-none">مجموع الواردات</p>
                          <p className="font-mono text-xs font-bold text-green-400 mt-1">+{inSum.toLocaleString('en-US')}</p>
                        </div>
                        <div className="border-r border-white/5">
                          <p className="text-[9px] text-gray-500 font-cairo leading-none">مجموع النفقات</p>
                          <p className="font-mono text-xs font-bold text-red-500 mt-1">-{outSum.toLocaleString('en-US')}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between border-t border-white/5 pt-3">
                        <span className="text-xs text-gray-400 font-cairo">متوفر حالياً بالصندوق:</span>
                        <span className="font-mono text-lg font-black text-emerald-400">
                          {fund.balance?.toLocaleString('en-US')} <span className="text-[11px] font-sans text-gray-500">{fund.currency}</span>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Fund Movements Table below boxes */}
              <div className="mt-8 space-y-4">
                <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest font-cairo mr-1">سجل حركات الصناديق الأخيرة</h4>
                <div className="border border-white/5 rounded-2xl overflow-hidden bg-black/20">
                  <table className="w-full text-right text-[10px]">
                    <thead>
                      <tr className="bg-white/5 text-gray-500 font-black border-b border-white/5">
                        <th className="px-4 py-3">الصندوق</th>
                        <th className="px-4 py-3">التاريخ</th>
                        <th className="px-4 py-3">نوع الحركة</th>
                        <th className="px-4 py-3 text-center">المبلغ</th>
                        <th className="px-4 py-3 text-left">التفاصيل</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {transactions
                        .filter(tx => 
                          tx.customerName.toLowerCase().includes(globalSearch.toLowerCase()) || 
                          tx.fundName?.toLowerCase().includes(globalSearch.toLowerCase())
                        )
                        .slice(0, 50)
                        .map(tx => (
                          <tr key={tx.id} className="hover:bg-white/5 bg-[#141414] transition-colors">
                            <td className="px-4 py-3 font-bold text-gray-300">{tx.fundName || 'غير معروف'}</td>
                            <td className="px-4 py-3 text-gray-500 font-mono">{new Date(tx.timestamp).toLocaleString('ar-YE', { day: '2-digit', month: '2-digit', year: 'numeric' })}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded-lg font-black ${tx.type === 'receipt' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                                {tx.type === 'receipt' ? 'إيداع' : 'صحب'}
                              </span>
                            </td>
                            <td className={`px-4 py-3 text-center font-bold ${tx.type === 'receipt' ? 'text-emerald-500' : 'text-rose-500'}`}>
                              {Math.abs(tx.amount).toLocaleString('en-US')} {tx.currency}
                            </td>
                            <td className="px-4 py-3 text-gray-500 text-left truncate max-w-[200px]">{tx.notes || tx.customerName}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 3. CLIENT STATEMENT LEDGERS */}
          {activeSegment === 'customer-ledger' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setActiveSegment('dashboard')}
                    className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white transition-all ml-2"
                  >
                    <ArrowRight size={20} />
                  </button>
                  <div>
                    <h3 className="text-xl font-black text-white font-cairo flex items-center gap-2">
                      <Users className="text-purple-400" size={22} />
                      كشف حسابات العملاء والديون
                    </h3>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative group flex-1 sm:flex-none sm:w-96">
                    <Search className="absolute right-3 top-2.5 text-gray-500 group-focus-within:text-purple-500 transition-colors" size={16} />
                    <input 
                      type="text" 
                      placeholder="ابحث باسم العميل لاستخراج الكشف..."
                      value={ledgerSearchTerm}
                      onChange={(e) => setLedgerSearchTerm(e.target.value)}
                      className="w-full bg-[#181818] border border-white/5 rounded-xl pr-10 pl-4 py-2 text-xs font-cairo text-white outline-none focus:border-purple-500/50 transition-all font-bold"
                    />
                  </div>
                  {/* Add New Customer Button */}
                  <button 
                    onClick={() => {
                        // Redirect to customers page or show a toast
                        alert("لإضافة عميل جديد، يرجى الانتقال إلى صفحة العملاء من القائمة الرئيسية.");
                    }}
                    className="p-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition-all shadow-lg shadow-purple-900/20 active:scale-95"
                  >
                    <Plus size={20} />
                  </button>
                </div>
              </div>

              {/* Horizontal chips of matches (More elegant) */}
              <div className="flex flex-wrap gap-2 pt-1">
                {customers
                  .filter(c => c.name.toLowerCase().includes(ledgerSearchTerm.toLowerCase()))
                  .slice(0, 15)
                  .map(cust => (
                    <button
                      key={cust.id}
                      type="button"
                      onClick={() => setLedgerCustomerId(cust.id)}
                      className={`px-4 py-2 rounded-xl text-xs font-cairo transition-all border ${ledgerCustomerId === cust.id ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-500/20 font-bold scale-105' : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10 hover:text-white'}`}
                    >
                      {cust.name}
                    </button>
                  ))
                }
              </div>

              {/* Ledger Presentation Sheet */}
              {ledgerCustomerId && selectedLedgerCustomer ? (
                <div className="space-y-6 border-t border-white/5 pt-4">
                  
                  <div className="flex items-center justify-between bg-white/[0.02] p-4 rounded-2xl border border-white/5">
                    <div className="text-right">
                      <h4 className="text-sm font-black text-white font-cairo">{selectedLedgerCustomer.name}</h4>
                      {selectedLedgerCustomer.companyName && (
                        <p className="text-[10px] text-gray-400 font-cairo mt-0.5">الجهة/الشركة: {selectedLedgerCustomer.companyName}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowStatementModal(true)}
                      className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold font-cairo shadow-lg shadow-purple-500/10 transition-all flex items-center gap-2 cursor-pointer"
                    >
                      <Printer size={13} />
                      <span>إصدار كشف حساب شامل وملخص مالي</span>
                    </button>
                  </div>
                  
                  {/* Ledger Header Stat boxes */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    
                    <div className="bg-[#181818] p-4 rounded-2xl border border-white/5 flex flex-col justify-between">
                      <span className="text-[10px] text-gray-500 font-cairo leading-none">إجمالي الفواتير الصادرة</span>
                      <p className="font-mono text-lg font-black text-white mt-1.5">{totalInvoicesCost.toLocaleString('en-US')} <span className="text-[10px] font-sans text-gray-500">USD</span></p>
                      <span className="text-[9px] text-gray-600 font-cairo mt-1">عدد الفواتير المنقولة: {ledgerCustomerInvoices.length}</span>
                    </div>

                    <div className="bg-[#181818] p-4 rounded-2xl border border-white/5 flex flex-col justify-between">
                      <span className="text-[10px] text-gray-500 font-cairo leading-none font-bold text-green-400">مجموع المبالغ المسددة</span>
                      <p className="font-mono text-lg font-black text-green-400 mt-1.5">{(totalInvoicesPaid + totalSeparateCollections).toLocaleString('en-US')} <span className="text-[10px] font-sans text-gray-500">USD</span></p>
                      <span className="text-[9px] text-gray-500 font-cairo mt-1">مسدد بالفاتورة: {totalInvoicesPaid} + قبض مستقل: {totalSeparateCollections}</span>
                    </div>

                    <div className="bg-[#181818] p-4 rounded-2xl border border-white/5 flex flex-col justify-between">
                      <span className="text-[10px] text-gray-500 font-cairo leading-none font-bold text-red-500">صافي المديونية المتبقية</span>
                      <p className="font-mono text-lg font-black text-red-500 mt-1.5">{customerUnpaidBalance.toLocaleString('en-US')} <span className="text-[10px] font-sans text-gray-500">USD</span></p>
                      <span className="text-[9px] text-gray-600 font-cairo mt-1">مستحق للمركز حالياً دائن</span>
                    </div>

                  </div>

                  {/* Customer Invoices statement */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-black text-white font-cairo">دفتر تفاصيل الفواتير:</h4>
                    <div className="bg-[#141414] border border-white/5 rounded-2xl overflow-hidden text-xs">
                      <table className="w-full border-collapse text-right">
                        <thead>
                          <tr className="bg-white/5 border-b border-white/5 text-gray-500 font-cairo font-bold">
                            <th className="py-2.5 px-3">رقم الفاتورة</th>
                            <th className="py-2.5 px-3">قيمة الفاتورة</th>
                            <th className="py-2.5 px-3 text-green-400">المسدد منها</th>
                            <th className="py-2.5 px-3">متبقي الباقي</th>
                            <th className="py-2.5 px-3 text-center">الحالة</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-gray-300 font-mono">
                          {ledgerCustomerInvoices.map(inv => {
                            const invItems = getInvoiceItemsForInvoice(inv.invoiceNumber);
                            const actualCost = getInvoiceActualCost(invItems);
                            const unpaid = Math.max(0, actualCost - inv.amountPaid);
                            return (
                              <tr key={inv.id} className="hover:bg-white/5 font-mono text-[11px]">
                                <td className="py-2.5 px-3 text-white font-bold">{inv.invoiceNumber}</td>
                                <td className="py-2.5 px-3">{actualCost?.toLocaleString('en-US')} {inv.currency}</td>
                                <td className="py-2.5 px-3 text-green-400">{inv.amountPaid?.toLocaleString('en-US')} {inv.currency}</td>
                                <td className="py-2.5 px-3 text-red-500 font-bold">{unpaid.toLocaleString('en-US')} {inv.currency}</td>
                                <td className="py-2.5 px-3 text-center font-cairo">
                                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${inv.status === 'delivered' ? 'bg-green-600/15 text-green-400' : 'bg-amber-600/15 text-amber-500'}`}>
                                    {inv.status}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                          {ledgerCustomerInvoices.length === 0 && (
                            <tr>
                              <td colSpan={5} className="text-center py-4 text-gray-500 font-cairo text-[11px]">لا توجد فواتير صيانة منقولة لهذا العميل.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Vouchers lists */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-black text-white font-cairo">تحركات سندات النقدية (الإضافية):</h4>
                    <div className="bg-[#141414] border border-white/5 rounded-2xl max-h-60 overflow-y-auto divide-y divide-white/5">
                      {ledgerCustomerTransactions.map(tx => (
                        <div key={tx.id} className="p-3 text-xs flex items-center justify-between hover:bg-white/5">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white font-mono text-xs">سند رقم: {tx.voucherNumber}</span>
                              <span className="text-[10px] text-amber-500 font-cairo">({tx.transactionCategory})</span>
                            </div>
                            <p className="text-[10px] text-gray-500 font-cairo">{tx.notes || 'سند قبض معلق بالدفاتر.'}</p>
                            <span className="text-[9px] text-gray-600 font-mono">{new Date(tx.timestamp?.toDate ? tx.timestamp.toDate() : tx.timestamp).toLocaleString('en-US')}</span>
                          </div>
                          
                          <div className="text-left font-mono">
                            <span className={`text-sm font-black ${tx.type === 'receipt' ? 'text-green-500' : 'text-amber-500'}`}>
                              {tx.type === 'receipt' ? '+' : '-'}{Math.abs(tx.amount).toLocaleString('en-US')} {tx.currency}
                            </span>
                            <p className="text-[9px] text-gray-500 font-cairo mt-0.5">{tx.fundName}</p>
                          </div>
                        </div>
                      ))}
                      {ledgerCustomerTransactions.length === 0 && (
                        <div className="text-center py-5 text-gray-500 font-cairo text-[11px]">لا يوجد سند قبض أو صرف مسجل لهذا العميل بشكل مستقل.</div>
                      )}
                    </div>
                  </div>

                </div>
              ) : (
                <div className="text-center py-12 text-gray-500 font-cairo">الرجاء اختيار العميل من القائمة أعلاه لعرض التفاصيل المحاسبية وحساب الديون المتبقية.</div>
              )}
            </div>
          )}

          {/* 4. FINANCIAL REPORTS VIEW */}
          {activeSegment === 'reports' && (
            <div className="space-y-6">
              
              {/* Report Category Header */}
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setActiveSegment('dashboard')}
                    className="p-1.5 bg-white/5 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-all"
                    title="العودة لشجرة النظام المالي"
                  >
                    <ArrowRight size={16} />
                  </button>
                  <h3 className="text-base font-bold text-white font-cairo flex items-center gap-2">
                    <FileSpreadsheet className="text-emerald-400" size={16} />
                    <span>تقارير الحسابات المالية:</span>
                    <span className="text-amber-500 font-bold">
                      {reportSubSegment === 'revenues' && 'الإيرادات والنقود الواردة'}
                      {reportSubSegment === 'expenses' && 'المصروفات والمبالغ الصادرة'}
                      {reportSubSegment === 'profits' && 'الأرباح وصافي الميزان'}
                      {reportSubSegment === 'fund-balances' && 'رصيد ومحتويات الصناديق'}
                      {reportSubSegment === 'outstanding-debts' && 'سجل الديون والمديونيات المستحقة'}
                    </span>
                  </h3>
                </div>
              </div>

              {/* SECTION: REVENUES (وارد) */}
              {reportSubSegment === 'revenues' && (
                <div className="space-y-4">
                  {/* Currencies stats */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {allUsedCurrencies.map(curr => {
                      const sum = revenueCurrencyTotals[curr] || 0;
                      return (
                        <div key={curr} className="bg-green-600/10 border border-green-500/15 p-4 rounded-2xl">
                          <span className="text-[10px] text-green-400 font-cairo">وارد الإيرادات المتراكمة</span>
                          <p className="font-mono text-xl font-black text-white mt-1">{sum.toLocaleString('en-US')} <span className="text-xs text-green-400">{curr}</span></p>
                        </div>
                      );
                    })}
                  </div>

                  {/* Vouchers Receipt ledger list */}
                  <div className="bg-[#141414] border border-white/5 rounded-2xl overflow-hidden">
                    <div className="bg-white/5 px-4 py-3 font-cairo font-black text-xs text-white">سندات القبض المسجلة بالدخول:</div>
                    <div className="p-2 overflow-x-auto">
                      <table className="w-full text-right border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-white/5 text-gray-500 font-cairo font-bold">
                            <th className="py-2 px-3">رقم السند</th>
                            <th className="py-2 px-3">التاريخ</th>
                            <th className="py-2 px-3">التصنيف</th>
                            <th className="py-2 px-3">الجهة المستلمة</th>
                            <th className="py-2 px-3">الصندوق</th>
                            <th className="py-2 px-3 text-left">المبلغ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 font-mono text-[11px] text-gray-300">
                          {receiptTransactions.map(tx => (
                            <tr key={tx.id} className="hover:bg-white/5">
                              <td className="py-2.5 px-3 text-white font-bold">{tx.voucherNumber}</td>
                              <td className="py-2.5 px-3 font-sans text-[10px]">{new Date(tx.timestamp?.toDate ? tx.timestamp.toDate() : tx.timestamp).toLocaleString('en-US')}</td>
                              <td className="py-2.5 px-3 text-emerald-400 font-cairo">{tx.transactionCategory}</td>
                              <td className="py-2.5 px-3 font-cairo">{tx.customerName}</td>
                              <td className="py-2.5 px-3 font-cairo">{tx.fundName}</td>
                              <td className="py-2.5 px-3 text-left font-bold text-green-400 font-mono">+{Math.abs(tx.amount).toLocaleString('en-US')} {tx.currency}</td>
                            </tr>
                          ))}
                          {receiptTransactions.length === 0 && (
                            <tr>
                              <td colSpan={6} className="text-center py-6 text-gray-600 font-cairo font-bold">لا توجد أي سندات مقبوضات حتى الآن.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION: EXPENSES (مصروف) */}
              {reportSubSegment === 'expenses' && (
                <div className="space-y-4">
                  {/* Currencies stats */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {allUsedCurrencies.map(curr => {
                      const sum = expenseCurrencyTotals[curr] || 0;
                      return (
                        <div key={curr} className="bg-red-600/10 border border-red-500/15 p-4 rounded-2xl">
                          <span className="text-[10px] text-red-400 font-cairo">إجمالي عموم المدفوعات والمصروفات</span>
                          <p className="font-mono text-xl font-black text-white mt-1">{sum.toLocaleString('en-US')} <span className="text-xs text-red-400">{curr}</span></p>
                        </div>
                      );
                    })}
                  </div>

                  {/* Vouchers payment table */}
                  <div className="bg-[#141414] border border-white/5 rounded-2xl overflow-hidden">
                    <div className="bg-white/5 px-4 py-3 font-cairo font-black text-xs text-white">سندات الصرف والنفقات المسجلة:</div>
                    <div className="p-2 overflow-x-auto">
                      <table className="w-full text-right border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-white/5 text-gray-500 font-cairo font-bold">
                            <th className="py-2 px-3">رقم السند</th>
                            <th className="py-2 px-3">التاريخ</th>
                            <th className="py-2 px-3">التصنيف المصروف</th>
                            <th className="py-2 px-3">الصرف لصالح</th>
                            <th className="py-2 px-3">المصدر (الصندوق)</th>
                            <th className="py-2 px-3 text-left">المبلغ المنصرف</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 font-mono text-[11px] text-gray-300">
                          {paymentTransactions.map(tx => (
                            <tr key={tx.id} className="hover:bg-white/5">
                              <td className="py-2.5 px-3 text-white font-bold">{tx.voucherNumber}</td>
                              <td className="py-2.5 px-3 font-sans text-[10px]">{new Date(tx.timestamp?.toDate ? tx.timestamp.toDate() : tx.timestamp).toLocaleString('en-US')}</td>
                              <td className="py-2.5 px-3 text-amber-500 font-cairo">{tx.transactionCategory}</td>
                              <td className="py-2.5 px-3 font-cairo">{tx.customerName}</td>
                              <td className="py-2.5 px-3 font-cairo">{tx.fundName}</td>
                              <td className="py-2.5 px-3 text-left font-bold text-red-400 font-mono">-{Math.abs(tx.amount).toLocaleString('en-US')} {tx.currency}</td>
                            </tr>
                          ))}
                          {paymentTransactions.length === 0 && (
                            <tr>
                              <td colSpan={6} className="text-center py-6 text-gray-600 font-cairo font-bold">لا توجد أي نفقات أو سندات صرف حتى الآن.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION: PROFITS (صافي الميزان) */}
              {reportSubSegment === 'profits' && (
                <div className="space-y-5">
                  <p className="text-xs text-gray-400 font-cairo">صافي الربح يتم احتسابه بطرح إجمالي النفقات والمصروفات من إجمالي النقدية الواردة عبر السندات والفواتير المدمجة.</p>

                  <div className="space-y-3">
                    {allUsedCurrencies.map(curr => {
                      const totalIn = revenueCurrencyTotals[curr] || 0;
                      const totalOut = expenseCurrencyTotals[curr] || 0;
                      const netProfit = totalIn - totalOut;
                      
                      return (
                        <div key={curr} className="bg-[#181818] border border-white/5 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="space-y-1">
                            <span className="text-xs font-black text-white font-cairo">مؤشر أرباح عملة: {curr}</span>
                            <div className="flex gap-4 text-[10px] text-gray-500 font-cairo">
                              <span>إجمالي الوارد: <strong className="text-emerald-400 font-mono">{totalIn}</strong></span>
                              <span>إجمالي المنصرف: <strong className="text-red-500 font-mono">{totalOut}</strong></span>
                            </div>
                          </div>

                          <div className="text-left">
                            <p className="text-[10px] text-gray-500 font-cairo">صافي ربح الصندوق</p>
                            <p className={`font-mono text-xl font-black ${netProfit >= 0 ? 'text-emerald-400' : 'text-red-500'}`}>
                              {netProfit >= 0 ? '+' : ''}{netProfit.toLocaleString('en-US')} <span className="text-xs text-gray-500">{curr}</span>
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* SECTION: FUND BALANCES (أرصدة الصناديق) */}
              {reportSubSegment === 'fund-balances' && (
                <div className="space-y-4">
                  <div className="bg-[#181818] border border-white/5 rounded-2xl overflow-hidden p-3 w-full">
                    <table className="w-full text-right text-xs">
                      <thead>
                        <tr className="bg-white/5 text-gray-400 font-cairo font-black border-b border-white/5 py-2">
                          <th className="p-3">اسم الصندوق المالي</th>
                          <th className="p-3">النوع</th>
                          <th className="p-3">العملة الأساسية</th>
                          <th className="p-3 text-left">الرصيد الفعلي المتوقع</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-gray-200">
                        {funds.map(f => (
                          <tr key={f.id} className="hover:bg-white/5">
                            <td className="p-3 font-bold font-cairo">{f.name}</td>
                            <td className="p-3 font-cairo">{f.type === 'cash' ? 'نقدي' : 'حساب بنك'}</td>
                            <td className="p-3 font-cairo">{f.currency}</td>
                            <td className="p-3 text-left font-mono font-black text-emerald-400">{f.balance?.toLocaleString('en-US')} {f.currency}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* SECTION: OUTSTANDING DEBTS (المديونيات) */}
              {reportSubSegment === 'outstanding-debts' && (
                <div className="space-y-4">
                  <p className="text-xs text-gray-400 font-cairo">سجل بمطالبات العملاء الذين لديهم فواتير معلقة تفوق مبالغ سدادهم الحالية.</p>

                  <div className="bg-[#141414] border border-white/5 rounded-2xl overflow-hidden">
                    <table className="w-full text-right border-collapse text-xs">
                      <thead>
                        <tr className="bg-white/5 border-b border-white/5 text-gray-400 font-cairo font-bold">
                          <th className="py-2.5 px-3">اسم العميل بالكامل</th>
                          <th className="py-2.5 px-3">اسم الشركة المستهدفة</th>
                          <th className="py-2.5 px-3">رقم الهاتف للتواصل</th>
                          <th className="py-2.5 px-3 text-left text-red-400 font-bold">الديون المتبقية لصالحه</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-gray-300">
                        {customers.map(cust => {
                          const custInvs = invoices.filter(inv => inv.customerId === cust.id);
                          const totalCost = custInvs.reduce((a, b) => {
                            const invItems = getInvoiceItemsForInvoice(b.invoiceNumber);
                            return a + getInvoiceActualCost(invItems);
                          }, 0);
                          const totalPaid = custInvs.reduce((a, b) => a + Number(b.amountPaid || 0), 0);
                          const extCollections = transactions
                            .filter(t => t.customerId === cust.id && t.type === 'receipt')
                            .reduce((a, b) => a + Math.abs(Number(b.amount || 0)), 0);

                          const unpaid = Math.max(0, totalCost - totalPaid - extCollections);
                          if (unpaid <= 0) return null; // Only show debtor customers

                          return (
                            <tr key={cust.id} className="hover:bg-white/5">
                              <td className="py-2.5 px-3 font-bold font-cairo text-white">{cust.name}</td>
                              <td className="py-2.5 px-3 font-cairo text-gray-500">{cust.companyName || 'بدون شركة'}</td>
                              <td className="py-2.5 px-3 font-mono text-gray-400">{cust.phone1 || 'لم يدخل هاتف'}</td>
                              <td className="py-2.5 px-3 text-left font-bold text-red-500 font-mono">{unpaid.toLocaleString('en-US')} USD</td>
                            </tr>
                          );
                        })}
                        {customers.length === 0 && (
                          <tr>
                            <td colSpan={4} className="text-center py-6 text-gray-500 font-cairo">لا يوجد أي عملاء مسجلين بنظام المديونيات.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>
          )}

        </div>

      </div>

      {/* 5. COMPREHENSIVE CUSTOMER FINANCIAL STATEMENT MODAL FOR VAULT TAB */}
      {showStatementModal && ledgerCustomerId && selectedLedgerCustomer && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 overflow-y-auto">
          <div className="bg-[#141414] border border-white/10 rounded-3xl w-full max-w-4xl p-6 md:p-8 space-y-6 shadow-2xl relative max-h-[90vh] overflow-y-auto text-right text-gray-200">
            
            {isGeneratingPDF && (
              <div className="absolute inset-0 z-[120] bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4 rounded-3xl text-center p-6">
                <div className="w-14 h-14 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-white font-black font-cairo text-base">جاري إنشاء وتصدير ملف الـ PDF المحاسبي...</p>
                <p className="text-gray-400 font-cairo text-xs max-w-md leading-relaxed">بضع ثوانٍ وسيكون التقرير المالي الموحد للخزينة جاهزاً على جهازك ومعداً للإرسال التلقائي عبر تطبيق واتساب للعميل.</p>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-between border-b border-white/5 pb-4 print:hidden">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => setShowStatementModal(false)}
                  className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-gray-400"
                >
                  <X size={20} />
                </button>
                <h3 className="text-sm font-black text-purple-400 font-cairo flex items-center gap-1.5 flex-row-reverse">
                  <FileText size={18} />
                  كشف الحساب المالي الموحد والشامل (منقولات الخزينة والأقسام)
                </h3>
              </div>
              <div className="flex items-center gap-2 relative">
                <button
                  type="button"
                  onClick={() => setShowPrintOptions(!showPrintOptions)}
                  className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold font-cairo flex items-center gap-1.5 transition-all shadow-md shadow-purple-500/10 cursor-pointer"
                >
                  <Printer size={13} />
                  طباعة وتصدير الكشف
                </button>

                {showPrintOptions && (
                  <div className="absolute top-11 left-0 mt-1 w-64 rounded-2xl bg-[#1c1c1c] border border-white/10 p-2 shadow-2xl z-[110] text-right font-cairo animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="space-y-1">
                      <span className="text-[10px] text-gray-500 block px-3 py-1 font-bold">اختر وسيلة تصدير كشف الحساب</span>
                      
                      {/* WhatsApp Option */}
                      <button
                        type="button"
                        onClick={() => {
                          handleWhatsAppShare(selectedLedgerCustomer.id!);
                          setShowPrintOptions(false);
                        }}
                        className="w-full text-right px-3 py-2.5 rounded-xl hover:bg-emerald-500/10 text-emerald-400 font-bold text-xs flex items-center justify-between gap-2 transition-all group cursor-pointer"
                      >
                        <span className="flex items-center gap-2">
                          <WhatsAppIcon className="w-4 h-4 text-emerald-500 group-hover:scale-110 transition-transform" />
                          <span>إرسال وتصدير عبر الواتساب</span>
                        </span>
                        <ChevronLeft size={12} className="text-gray-500 group-hover:translate-x-[-2px] transition-transform" />
                      </button>

                      {/* Printer Option */}
                      <button
                        type="button"
                        onClick={() => {
                          window.print();
                          setShowPrintOptions(false);
                        }}
                        className="w-full text-right px-3 py-2.5 rounded-xl hover:bg-purple-500/10 text-purple-400 font-bold text-xs flex items-center justify-between gap-2 transition-all group cursor-pointer"
                      >
                        <span className="flex items-center gap-2">
                          <Printer size={14} className="text-purple-500 group-hover:scale-110 transition-transform" />
                          <span>طباعة كشف الحساب الفورية</span>
                        </span>
                        <ChevronLeft size={12} className="text-gray-500 group-hover:translate-x-[-2px] transition-transform" />
                      </button>

                      <div className="border-t border-white/5 mt-1.5 pt-1.5 px-3">
                        <span className="text-[9px] text-amber-500 leading-relaxed block">سيتم مستقبلاً تطوير وربط الطباعة المباشرة مع نظام إدارة الطابعات الحرارية والشبكية.</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Printable ledger content */}
            <div className="overflow-x-auto w-full pb-6">
              {(() => {
                const entries = getStatementEntries(ledgerCustomerId);
                let dateRangeStr = '';
                if (entries.length > 0) {
                  const dates = entries.map(e => e.date.getTime());
                  const minDate = new Date(Math.min(...dates));
                  const maxDate = new Date(Math.max(...dates));
                  const minStr = minDate.toLocaleDateString('ar-YE', { year: 'numeric', month: 'numeric', day: 'numeric' });
                  const maxStr = maxDate.toLocaleDateString('ar-YE', { year: 'numeric', month: 'numeric', day: 'numeric' });
                  dateRangeStr = `الفترة من ${minStr} إلى ${maxStr}`;
                } else {
                  dateRangeStr = `الفترة من --/--/---- إلى --/--/----`;
                }
                
                const getCustomerCurrencyLabel = (customerId: string) => {
                  const customerInvs = invoices.filter(inv => inv.customerId === customerId);
                  const currencies = Array.from(new Set(customerInvs.map(inv => inv.currency || 'USD')));
                  if (currencies.length === 0) return 'USD';
                  return currencies.join(' / ');
                };

                const getArabicCurrencyName = (currCode: string) => {
                  if (!currCode) return 'دولار';
                  if (currCode.toUpperCase() === 'USD') return 'دولار';
                  if (currCode.toUpperCase() === 'YER') return 'ريال يمني';
                  if (currCode.toUpperCase().includes('USD') && currCode.toUpperCase().includes('YER')) return 'دولار / ريال يمني';
                  return currCode;
                };
                
                const curr = getCustomerCurrencyLabel(ledgerCustomerId);
                const arCurrency = getArabicCurrencyName(curr);

                return (
                  <div id="print-area" className="w-[820px] mx-auto space-y-6 bg-white text-gray-900 p-8 rounded-2xl border border-gray-300 text-right font-cairo shadow-lg" dir="rtl">
                    {/* Header Box identical format to device inspection report */}
                    <div className="flex justify-between items-start border-b-2 border-gray-900 pb-4 mb-4">
                      {/* Right Corner: Shop Name */}
                      <div className="text-right flex-1 pt-1">
                        <h2 className="text-xl font-black text-gray-900 tracking-tight leading-tight font-cairo">{shopConfig?.shopName || 'عالم الصيانة والتجارة'}</h2>
                        <div className="text-sm font-black text-gray-900 tracking-tight leading-tight mt-1.5 font-cairo">قسم الحسابات</div>
                        <div className="mt-2 space-y-1">
                          {(shopConfig?.phone1 || shopConfig?.phone2) && (
                            <div className="text-[10px] font-bold text-gray-800 flex items-center justify-start gap-1.5 w-fit">
                              <span>تلفون :</span>
                              <span dir="ltr" className="font-mono">
                                {shopConfig?.phone1}
                                {shopConfig?.phone1 && shopConfig?.phone2 && ' - '}
                                {shopConfig?.phone2}
                              </span>
                              <div className="flex items-center gap-1 mr-1.5">
                                <Smartphone size={10} className="text-gray-700" />
                                {(shopConfig?.phone1Whatsapp || shopConfig?.phone2Whatsapp) && (
                                  <MessageCircle size={10} className="text-green-600" />
                                )}
                              </div>
                            </div>
                          )}
                          {shopConfig?.landline && (
                            <div className="text-[10px] font-bold text-gray-800 flex items-center justify-start gap-1.5 w-fit">
                              <span>ثابت :</span>
                              <span dir="ltr" className="font-mono">{shopConfig.landline}</span>
                              <div className="flex items-center gap-1 mr-1.5">
                                <Phone size={10} className="text-gray-700" />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Center: Title / Logo */}
                      <div className="text-center flex-[1.4] flex flex-col items-center justify-center">
                        {shopConfig?.logoUrl ? (
                          <img src={shopConfig.logoUrl} alt="Logo" className="h-16 max-w-[150px] object-contain mb-1" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-12 h-12 border border-dashed border-gray-300 rounded-xl mb-1 flex items-center justify-center text-gray-400 text-[10px] font-bold font-cairo">شعار المحل</div>
                        )}
                        <h1 className="text-xl font-black text-gray-950 tracking-tight border-b-2 border-gray-950 px-6 py-0.5 inline-block font-cairo">
                          كشف حساب
                        </h1>
                      </div>

                      {/* Left Corner: Info */}
                      <div className="text-left flex-1 flex flex-col items-end pt-1">
                        <div className="text-sm font-bold text-gray-750 flex justify-between gap-4">
                          <span>رقم التقرير:</span>
                          <span className="font-mono text-gray-900">{selectedLedgerCustomer.customerNumber || selectedLedgerCustomer.id?.substring(0, 5)}</span>
                        </div>
                        <div className="text-sm font-bold text-gray-750 flex justify-between gap-4">
                          <span>التاريخ:</span>
                          <span className="font-mono text-gray-900">{new Date().toLocaleDateString('ar-YE', { year: 'numeric', month: 'numeric', day: 'numeric' })}</span>
                        </div>
                      </div>
                    </div>

                    {/* New subtitle statement row before customer name row */}
                    <div className="text-center mb-1">
                      <p className="text-sm font-black text-gray-900 border border-gray-400 rounded-lg px-6 py-1.5 inline-block bg-white font-cairo">
                        كشف حساب {arCurrency} {dateRangeStr}
                      </p>
                    </div>

                    {/* Customer Info Single Line */}
                    <div className="bg-gray-100 p-3 rounded-lg mb-4 border border-gray-300 flex justify-between items-center px-6">
                      <div className="text-sm font-black text-gray-900">
                        <span className="text-xs text-gray-650 ml-2 font-bold font-cairo">إسم العميل:</span>
                        {selectedLedgerCustomer.name}
                      </div>
                      <div className="text-sm font-bold text-gray-900 border-r border-gray-300 pr-6">
                        <span className="text-xs text-gray-655 ml-2 font-cairo">الجهة:</span>
                        {selectedLedgerCustomer.companyName || '---'}
                      </div>
                      <div className="text-sm font-bold text-gray-900 border-r border-gray-300 pr-6">
                        <span className="text-xs text-gray-655 ml-2 font-cairo">التليفون:</span>
                        <span className="font-mono">{selectedLedgerCustomer.phone1 || '---'}</span>
                      </div>
                    </div>

                    {/* Distinctive Net Balance Box with NO background shading (unshaded) */}
                    {(() => {
                      const totalCost = totalInvoicesCost;
                      const totalPaid = totalInvoicesPaid + totalSeparateCollections;
                      const diff = totalPaid - totalCost;
                      const isCreditor = diff > 0.01;
                      const isDebtor = diff < -0.01;
                      
                      const balanceStatus = isCreditor ? 'دائن (له في الحساب)' : isDebtor ? 'مدين (متبقي عليه ديون)' : 'متزن الحساب';

                      return (
                        <div className="border border-gray-400 p-4 rounded-xl text-center font-cairo bg-white">
                          <div className="text-[11px] font-black text-gray-500 uppercase tracking-wider mb-0.5">صافي الحساب المالي الجاري</div>
                          <div className="text-2xl font-black font-mono text-gray-950 tracking-tight my-1">
                            {Math.abs(diff).toLocaleString('en-US')} <span className="text-sm font-cairo font-bold">{arCurrency}</span>
                          </div>
                          <div className="text-xs font-black text-gray-900">
                            حالة الحساب: {balanceStatus}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Chronological operations table with clear rows and column gridlines (border-gray-400) */}
                    <div className="space-y-2">
                      <span className="text-xs font-black text-gray-800 font-cairo block">العمليات والتحركات المالية (القيود مرتبة بتسلسل تاريخي):</span>
                      <div className="border border-gray-400 rounded-xl overflow-hidden bg-white text-xs">
                        <table className="w-full border-collapse text-right select-none">
                          <thead>
                            <tr className="bg-white border-b-2 border-gray-400 text-gray-950 font-cairo font-black">
                              <th className="py-2.5 px-3 text-center w-12 border-l border-gray-400">مـ</th>
                              <th className="py-2.5 px-3 border-l border-gray-400 w-28">نوع الحركة</th>
                              <th className="py-2.5 px-3 text-center border-l border-gray-400 w-24">رقم المرجع</th>
                              <th className="py-2.5 px-3 text-center border-l border-gray-400 w-36">تاريخ ووقت القيد</th>
                              <th className="py-2.5 px-4 border-l border-gray-400">البيان والتفاصيل</th>
                              <th className="py-2.5 px-4 text-rose-800 text-center border-l border-gray-400 bg-rose-50/10 w-28">المستحق (مدين)</th>
                              <th className="py-2.5 px-4 text-emerald-800 text-center border-l border-gray-400 bg-emerald-50/10 w-28">المقبوض (دائن)</th>
                              <th className="py-2.5 px-4 text-center font-black bg-gray-50 w-32">الرصيد الجاري</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-400">
                            {entries.length === 0 ? (
                              <tr>
                                <td colSpan={8} className="py-8 text-center text-gray-500 font-cairo font-bold bg-white">
                                  لا يوجد أي قيود أو عمليات محاسبية مسجلة لهذا العميل حتى الآن.
                                </td>
                              </tr>
                            ) : (
                              entries.map((entry, index) => {
                                const year = entry.date.getFullYear();
                                const month = String(entry.date.getMonth() + 1).padStart(2, '0');
                                const day = String(entry.date.getDate()).padStart(2, '0');
                                const hours = String(entry.date.getHours()).padStart(2, '0');
                                const minutes = String(entry.date.getMinutes()).padStart(2, '0');
                                const formattedDate = `${year}/${month}/${day} ${hours}:${minutes}`;

                                return (
                                  <tr key={entry.id} className="hover:bg-gray-50 transition-all text-gray-950 bg-white">
                                    <td className="py-2.5 px-3 font-mono text-center text-gray-600 border-l border-gray-400 bg-gray-50/50">
                                      {index + 1}
                                    </td>
                                    <td className="py-2.5 px-3 font-cairo font-bold text-gray-900 border-l border-gray-400">
                                      {entry.type}
                                    </td>
                                    <td className="py-2.5 px-3 font-mono font-bold text-gray-800 text-center border-l border-gray-400">
                                      {entry.reference}
                                    </td>
                                    <td className="py-2.5 px-3 font-mono text-[11px] text-gray-700 text-center whitespace-nowrap border-l border-gray-400">
                                      {formattedDate}
                                    </td>
                                    <td className="py-2.5 px-4 font-cairo text-gray-900 max-w-[200px] border-l border-gray-400 leading-relaxed">
                                      <div className="font-bold">{entry.label}</div>
                                      {entry.notes && <div className="text-[10px] text-gray-600 truncate mt-0.5">{entry.notes}</div>}
                                    </td>
                                    <td className="py-2.5 px-4 font-mono font-black text-rose-800 text-center border-l border-gray-400 bg-rose-50/5">
                                      {entry.debit > 0 ? `${entry.debit.toLocaleString('en-US')}` : '---'}
                                    </td>
                                    <td className="py-2.5 px-4 font-mono font-black text-emerald-800 text-center border-l border-gray-400 bg-emerald-50/5">
                                      {entry.credit > 0 ? `${entry.credit.toLocaleString('en-US')}` : '---'}
                                    </td>
                                    <td className={`py-2.5 px-4 font-mono font-black text-center ${entry.runningBalance > 0.01 ? 'text-rose-800' : entry.runningBalance < -0.01 ? 'text-emerald-800' : 'text-gray-600'}`}>
                                      {entry.runningBalance.toLocaleString('en-US')} {arCurrency}
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Footer Notes & Signatures section */}
                    <div className="border-t border-gray-300 my-4"></div>
                    
                    <div className="text-center font-cairo text-xs text-gray-700 font-bold mb-6">
                      يعتبر هذا الكشف صحيحاً بعد أسبوع من تاريخ استلامه مالم يردنا أي اعتراض.
                    </div>

                    <div className="grid grid-cols-2 text-center pb-4 font-cairo text-xs text-gray-950 font-bold gap-6">
                      <div className="space-y-4">
                        <div>اسم مستلم الكشف: ........................................</div>
                        <div>التوقيع والختم: ........................................</div>
                      </div>
                      <div className="space-y-4">
                        <div>اسم المختص المعتمد: ........................................</div>
                        <div>التوقيع والختم: ........................................</div>
                      </div>
                    </div>

                    {/* Footer Address, Facebook, and Bank Accounts (Absolute Last Line) */}
                    <div className="border-t-[3px] border-black my-4 border-solid"></div>
                    
                    <div className="flex flex-col items-center justify-center gap-2.5 text-[10px] font-bold text-black font-cairo pb-4">
                      {/* First line of info footer: Address & Facebook */}
                      {(shopConfig?.address || shopConfig?.facebookUrl) && (
                        <div className="flex flex-row items-center justify-center gap-4">
                          {shopConfig?.address && (
                            <div className="flex items-center gap-1.5 justify-center flex-row-reverse text-center w-max">
                              <MapPin size={12} className="text-gray-600" />
                              <span>{shopConfig.address}</span>
                            </div>
                          )}
                          
                          {shopConfig?.address && shopConfig?.facebookUrl && (
                            <div className="px-2 text-gray-300 font-light select-none">|</div>
                          )}

                          {shopConfig?.facebookUrl && (
                            <div className="flex items-center gap-1.5 justify-center flex-row-reverse text-center w-max">
                              <Facebook size={12} className="text-blue-600" />
                              <span dir="ltr">{shopConfig.facebookUrl}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Second line of info footer: Bank Accounts (Absolute Last Line) */}
                      {shopConfig?.bankAccounts && shopConfig.bankAccounts.length > 0 && (
                        <div className="w-full text-center text-[10.5px] font-bold text-gray-900 border-t border-gray-200/60 pt-2 mt-1.5">
                          <div className="flex flex-wrap justify-center items-center gap-x-6 gap-y-1">
                            {shopConfig.bankAccounts.map((bank: any, idx: number) => (
                              <div key={idx} className="flex items-center gap-1.5 justify-center flex-row-reverse">
                                <span className="text-gray-500 font-medium">حساب {bank.bankName}:</span>
                                <span className="font-mono text-blue-900 text-[11px] font-black" dir="ltr">{bank.accountNumber}</span>
                                <span className="text-gray-400 font-normal mr-0.5">- باسم:</span>
                                <span className="text-gray-800 font-extrabold">{bank.accountHolder || '---'}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

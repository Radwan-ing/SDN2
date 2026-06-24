import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Cpu, ChevronLeft, Activity, CheckCircle, PackageCheck, 
  X, AlertTriangle, ArrowRight, User as UserIcon, 
  Eye, Info, Calendar, DollarSign, Hash, Phone, Clock, Search as SearchIcon, ArrowLeft
} from 'lucide-react';
import { collection, onSnapshot, doc, writeBatch, serverTimestamp } from '../firebase';
import { db } from '../firebase';
import { Invoice, InvoiceItem, User, Customer, OperationType } from '../types';
import { useTranslation } from 'react-i18next';
import { handleFirestoreError } from '../lib/error-handler';

import DeviceExit from './entry-exit/DeviceExit';
import Inspection from './movement/Inspection';
import ApprovalAndParts from './movement/ApprovalAndParts';
import Maintenance from './movement/Maintenance';

export default function DeviceManagement({ user, onBack }: { user: User; onBack: () => void }) {
  const { t } = useTranslation();
  
  // Navigation State
  const [subview, setSubview] = useState<'hub' | 'active_devices' | 'ready_exit' | 'delivered' | 'inspection_form' | 'approval_form' | 'maintenance_form' | 'admin_correction' | 'admin_correction_action'>('hub');
  
  // Admin Correction States
  const [selectedInvoiceForAdmin, setSelectedInvoiceForAdmin] = useState<Invoice | null>(null);
  const [timeFilter, setTimeFilter] = useState<'day' | 'week' | 'month' | 'custom'>('day');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [adminInvoiceSearch, setAdminInvoiceSearch] = useState<string>('');
  
  // Admin device update form states
  const [selectedItemForEdit, setSelectedItemForEdit] = useState<InvoiceItem | null>(null);
  const [adminNewStatus, setAdminNewStatus] = useState<string>('');
  const [adminNewQuantity, setAdminNewQuantity] = useState<number>(1);
  const [adminNewPrice, setAdminNewPrice] = useState<number>(0);
  const [adminSaveLoading, setAdminSaveLoading] = useState<boolean>(false);

  const ALL_STATUSES = [
    { value: '10', label: 'دخول جديد (New Entry)' },
    { value: '25', label: 'قيد الفحص / التشخيص' },
    { value: '30', label: 'إنتظار موافقة العميل (Awaiting Approval)' },
    { value: 'approved', label: 'تمت موافقة العميل (Approved)' },
    { value: '35', label: 'بانتظار قطع الغيار (Awaiting Parts)' },
    { value: 'parts_available', label: 'تم توفير قطع الغيار (Parts Available)' },
    { value: 'parts_not_available', label: 'لم تتوفر قطع الغيار (Parts Unavailable)' },
    { value: '40', label: 'قيد الصيانة (Under Maintenance)' },
    { value: '50', label: 'جاهز للتسليم (Ready)' },
    { value: 'intact', label: 'سليم بدون صيانة (Intact)' },
    { value: 'unrepairable', label: 'غير قابل للإصلاح (Unrepairable)' },
    { value: 'refused', label: 'مرفوض من العميل (Refused)' },
    { value: '60', label: 'تم تسليمها ومغادرتها (Delivered)' },
    { value: '70', label: 'إلغاء العملية وسحب الأجهزة (Cancelled/Withdrawn)' }
  ];

  const EDIT_OPTIONS_STATUSES = [
    { value: '10', label: 'دخول جديد' },
    { value: '20', label: 'قيد الفحص والتشخيص' },
    { value: '30', label: 'إنتظار موافقة العميل' },
    { value: 'approved', label: 'تمت موافقة العميل (البدء في الصيانة)' },
    { value: '35', label: 'بانتظار قطع الغيار' },
    { value: 'parts_available', label: 'تم توفير قطع الغيار (البدء في الصيانة)' },
    { value: 'parts_not_available', label: 'لم تتوفر قطع الغيار (تحويل للتسليم)' },
    { value: '40', label: 'قيد الصيانة' },
    { value: '50', label: 'جاهز للتسليم (إصلاح كامل)' },
    { value: 'intact', label: 'سليم بدون صيانة' },
    { value: 'unrepairable', label: 'غير قابل للإصلاح' },
    { value: 'refused', label: 'مرفوض من العميل' },
    { value: '60', label: 'تم تسليمها ومغادرتها' },
    { value: '70', label: 'إلغاء العملية وسحب الأجهزة' }
  ];
  
  // DB State
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  
  // Active Devices State
  const [selectedOptions, setSelectedOptions] = useState<Record<string, 'action1' | 'action2'>>({});
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [activeSearch, setActiveSearch] = useState('');
  
  // Cancel operation Form Modal
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelNotes, setCancelNotes] = useState('');
  const [loadingCancel, setLoadingCancel] = useState(false);

  // Delivered Invoice Preview Modal
  const [activePreviewInvoice, setActivePreviewInvoice] = useState<Invoice | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Real-time Listeners
  useEffect(() => {
    const unsubInvoices = onSnapshot(collection(db, 'invoices'), (s) => {
      setInvoices(s.docs.map(d => ({ id: d.id, ...d.data() } as Invoice)));
    });
    const unsubItems = onSnapshot(collection(db, 'invoice_items'), (s) => {
      setItems(s.docs.map(d => ({ id: d.id, ...d.data() } as InvoiceItem)));
    });
    const unsubCustomers = onSnapshot(collection(db, 'customers'), (s) => {
      setCustomers(s.docs.map(d => ({ id: d.id, ...d.data() } as Customer)));
    });
    return () => {
      unsubInvoices();
      unsubItems();
      unsubCustomers();
    };
  }, []);

  const getCustomerPhone = (customerId: string) => {
    const c = customers.find(cust => cust.id === customerId);
    return c ? c.phone1 : '---';
  };

  const getCustomerNum = (customerId: string) => {
    const c = customers.find(cust => cust.id === customerId);
    return c ? String(c.customerNumber || '---') : '---';
  };

  const getDevicesCount = (invoiceNumber: string) => {
    return items
      .filter(item => item.invoiceNumber === invoiceNumber)
      .reduce((sum, i) => sum + (Number(i.quantity) || 0), 0);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // 1. Filter Active Devices (new/10, inspected/20, approval/30, parts/35, maintenance/40)
  const ACTIVE_STATUSES = ['10', 'new', '20', 'inspected', 'testing', '30', 'awaiting_approval', '35', 'awaiting_parts', '40', 'repairing'];
  const activeInvoicesFiltered = invoices
    .filter(inv => {
      const isStatusActive = ACTIVE_STATUSES.includes(inv.status);
      const isSearchMatch = 
        inv.customerName.toLowerCase().includes(activeSearch.toLowerCase()) ||
        inv.invoiceNumber.includes(activeSearch);
      return isStatusActive && isSearchMatch;
    })
    .sort((a, b) => Number(b.invoiceNumber) - Number(a.invoiceNumber));

  // 2. Filter Delivered Devices (60)
  const deliveredInvoicesFiltered = invoices
    .filter(inv => {
      const isDelivered = inv.status === '60';
      const isSearchMatch = 
        inv.customerName.toLowerCase().includes(activeSearch.toLowerCase()) ||
        inv.invoiceNumber.includes(activeSearch);
      return isDelivered && isSearchMatch;
    })
    .sort((a, b) => Number(b.invoiceNumber) - Number(a.invoiceNumber));

  // Initialize Row Choices
  useEffect(() => {
    const newOptions = { ...selectedOptions };
    activeInvoicesFiltered.forEach(inv => {
      if (!newOptions[inv.id!]) {
        newOptions[inv.id!] = 'action1'; // Default action 1 is selected
      }
    });
    setSelectedOptions(newOptions);
  }, [invoices]);

  // Execute choice for a single row
  const handleExecuteAction = async (invoice: Invoice) => {
    const choice = selectedOptions[invoice.id!] || 'action1';
    
    if (choice === 'action2') {
      // cancel operation modal
      setSelectedInvoice(invoice);
      setCancelNotes('');
      setShowCancelModal(true);
      return;
    }

    // Process Action 1 pathways
    const currentStatus = invoice.status;
    
    if (currentStatus === '10' || currentStatus === 'new') {
      // Transition directly to Under Inspection '20'
      try {
        const batch = writeBatch(db);
        const invRef = doc(db, 'invoices', invoice.id!);
        batch.update(invRef, {
          status: '20',
          updatedAt: serverTimestamp()
        });

        // Also update items
        const invoiceItems = items.filter(i => i.invoiceNumber === invoice.invoiceNumber);
        invoiceItems.forEach(item => {
          batch.update(doc(db, 'invoice_items', item.id!), {
            status: '20',
            updatedAt: serverTimestamp()
          });
        });

        await batch.commit();
        showToast(`تم تحويل الفاتورة #${invoice.invoiceNumber} بنجاح إلى قيد الفحص.`);
      } catch (err) {
        console.error(err);
        showToast('فشل في تعديل حالة الأجهزة.');
      }
    } else if (currentStatus === '20' || currentStatus === 'inspected' || currentStatus === 'testing') {
      // Open traditional Inspection form matching status 20
      setSelectedInvoice(invoice);
      setSubview('inspection_form');
    } else if (currentStatus === '30' || currentStatus === 'awaiting_approval' || currentStatus === '35' || currentStatus === 'awaiting_parts') {
      // Open approvals & parts page for invoice status 30 / 35
      setSelectedInvoice(invoice);
      setSubview('approval_form');
    } else if (currentStatus === '40' || currentStatus === 'repairing') {
      // Open maintenance actions page for invoice status 40
      setSelectedInvoice(invoice);
      setSubview('maintenance_form');
    }
  };

  // Composing Cancel Operation Confirmation
  const handleConfirmCancel = async () => {
    if (!selectedInvoice) return;
    if (!cancelNotes.trim()) {
      alert('الرجاء كتابة سبب إلغاء العملية والانسحاب لتسجيل الإجراء.');
      return;
    }

    setLoadingCancel(true);
    try {
      const batch = writeBatch(db);
      
      // Update invoice as Cancelled '70' with reason
      batch.update(doc(db, 'invoices', selectedInvoice.id!), {
        status: '70',
        cancelReason: cancelNotes,
        updatedAt: serverTimestamp()
      });

      // Update all items of this invoice to status 70/cancelled with cancel notes stored in failureReason
      const invoiceItems = items.filter(i => i.invoiceNumber === selectedInvoice.invoiceNumber);
      invoiceItems.forEach(item => {
        batch.update(doc(db, 'invoice_items', item.id!), {
          status: '70',
          subStatus: 'cancelled',
          failureReason: cancelNotes,
          engineerReport: cancelNotes,
          updatedAt: serverTimestamp()
        });
      });

      await batch.commit();
      setShowCancelModal(false);
      showToast(`تم إلغاء فاتورة العميل بنجاح ونقله لصفحة الخروج.`);
      
      // Transition directly to Exit page as requested
      setSubview('ready_exit');
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء إجراء محاولة إلغاء وحفظ العملية.');
    } finally {
      setLoadingCancel(false);
    }
  };

  const getStatusStyle = (status: string) => {
    switch(status) {
      case '10':
      case 'new':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case '20':
      case 'inspected':
      case 'testing':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case '30':
      case 'awaiting_approval':
        return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
      case 'approved':
        return 'bg-teal-500/10 text-teal-400 border-teal-500/20';
      case '35':
      case 'awaiting_parts':
        return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
      case 'parts_available':
        return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
      case 'parts_not_available':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      case '40':
      case 'repairing':
        return 'bg-[#a855f7]/10 text-[#a855f7] border-[#a855f7]/20';
      case '50':
      case 'ready':
      case 'intact':
      case 'unrepairable':
      case 'refused':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case '60':
      case 'delivered':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      case '70':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      default:
        return 'bg-gray-500/10 text-gray-400 border-white/5';
    }
  };

  const getStatusTextArabic = (status: string) => {
    switch(status) {
      case '10':
      case 'new':
        return 'دخول جديد';
      case '20':
      case 'inspected':
      case 'testing':
        return 'قيد الفحص';
      case '30':
      case 'awaiting_approval':
        return 'إنتظار موافقة العميل';
      case 'approved':
        return 'تمت موافقة العميل';
      case '35':
      case 'awaiting_parts':
        return 'انتظار قطع الغيار';
      case 'parts_available':
        return 'تم توفير قطع الغيار';
      case 'parts_not_available':
        return 'لم تتوفر قطع الغيار';
      case '40':
      case 'repairing':
        return 'قيد الصيانة';
      case '50':
      case 'ready':
      case 'intact':
      case 'unrepairable':
      case 'refused':
        return 'جاهز للتسليم';
      case '60':
      case 'delivered':
        return 'تم التسليم والمغادرة';
      case '70':
        return 'إلغاء وسحب الجهاز';
      default:
        return 'غير محدد';
    }
  };

  const parseFirestoreDate = (val: any): Date | null => {
    if (!val) return null;
    if (typeof val.toDate === 'function') return val.toDate();
    if (val.seconds) return new Date(val.seconds * 1000);
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d;
    return null;
  };

  const getFilteredInvoicesForAdmin = () => {
    return invoices.filter(inv => {
      // 1. Filter by invoice number search if provided
      if (adminInvoiceSearch.trim()) {
        return inv.invoiceNumber.includes(adminInvoiceSearch.trim());
      }
      
      // 2. Otherwise apply date filter to invoice creation time
      if (!inv.createdAt) return false;
      const createdAtDate = parseFirestoreDate(inv.createdAt);
      if (!createdAtDate) return false;
      
      const now = new Date();
      
      if (timeFilter === 'day') {
        return (
          createdAtDate.getFullYear() === now.getFullYear() &&
          createdAtDate.getMonth() === now.getMonth() &&
          createdAtDate.getDate() === now.getDate()
        );
      } else if (timeFilter === 'week') {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(now.getDate() - 7);
        return createdAtDate >= sevenDaysAgo;
      } else if (timeFilter === 'month') {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(now.getDate() - 30);
        return createdAtDate >= thirtyDaysAgo;
      } else if (timeFilter === 'custom') {
        if (customStartDate && customEndDate) {
          const start = new Date(customStartDate);
          start.setHours(0, 0, 0, 0);
          const end = new Date(customEndDate);
          end.setHours(23, 59, 59, 999);
          return createdAtDate >= start && createdAtDate <= end;
        }
        return true; // if dates are empty in custom view, show all
      }
      return true;
    }).sort((a, b) => Number(b.invoiceNumber || 0) - Number(a.invoiceNumber || 0));
  };

  const handleAdminSaveDevice = async () => {
    if (!selectedInvoiceForAdmin || !selectedItemForEdit) return;
    setAdminSaveLoading(true);
    try {
      const itemCost = Number(adminNewQuantity) * Number(adminNewPrice);
      const batch = writeBatch(db);
      
      // Determine final Firestore status & subStatus & failureReason to store based on custom admin key
      let finalStatus = adminNewStatus;
      let finalSubStatus = '';
      let additionalFields: any = {};

      if (adminNewStatus === 'approved') {
        finalStatus = '40';
        finalSubStatus = 'repairing';
        additionalFields.source = 'admin_approved';
      } else if (adminNewStatus === 'parts_available') {
        finalStatus = '40';
        finalSubStatus = 'repairing';
        additionalFields.source = 'parts_available';
      } else if (adminNewStatus === 'parts_not_available') {
        finalStatus = '50';
        finalSubStatus = 'refused';
        additionalFields.failureReason = 'لم تتوفر قطع الغيار';
        additionalFields.source = 'parts_not_available';
      } else {
        // Handle common defaults cleanly
        if (['10', 'new'].includes(adminNewStatus)) {
          finalSubStatus = '';
        } else if (['20', 'inspected', 'testing'].includes(adminNewStatus)) {
          finalSubStatus = 'testing';
        } else if (['30', 'awaiting_approval'].includes(adminNewStatus)) {
          finalSubStatus = 'awaiting_approval';
        } else if (['35', 'awaiting_parts'].includes(adminNewStatus)) {
          finalSubStatus = 'awaiting_parts';
        } else if (['40', 'repairing'].includes(adminNewStatus)) {
          finalSubStatus = 'repairing';
        } else if (['50', 'ready', 'intact', 'unrepairable', 'refused'].includes(adminNewStatus)) {
          finalSubStatus = adminNewStatus === '50' ? 'ready' : adminNewStatus;
        } else if (['60', 'delivered'].includes(adminNewStatus)) {
          finalSubStatus = 'delivered';
        }
      }

      // 1. Update the item document in Firestore
      const itemRef = doc(db, 'invoice_items', selectedItemForEdit.id!);
      batch.update(itemRef, {
        quantity: adminNewQuantity,
        unitCost: adminNewPrice,
        cost: itemCost,
        status: finalStatus,
        subStatus: finalSubStatus,
        updatedAt: serverTimestamp(),
        updatedBy: user?.name || user?.username || 'مدير النظام',
        ...additionalFields
      });

      // 2. Compute total cost and status for parent invoice
      const otherItems = items.filter(it => it.invoiceNumber === selectedInvoiceForAdmin.invoiceNumber && it.id !== selectedItemForEdit.id);
      const totalCostOfInvoice = otherItems.reduce((sum, it) => sum + (Number(it.cost) || 0), 0) + itemCost;
      
      const invoiceRef = doc(db, 'invoices', selectedInvoiceForAdmin.id!);
      const updateData: any = {
        totalCost: totalCostOfInvoice,
        updatedAt: serverTimestamp(),
        status: finalStatus // Align final overall status to represent the changed device state
      };
      
      batch.update(invoiceRef, updateData);

      await batch.commit();
      showToast('تمت معالجة وتعديل بيانات وحالة الأجهزة بنجاح، وتحديث الحسابات المرتبطة بالفاتورة.');
      
      setSelectedItemForEdit(null);
      setSubview('admin_correction');
    } catch (error) {
      console.error('Error saving admin device correction:', error);
      handleFirestoreError(error, OperationType.WRITE, 'invoice_items/' + selectedItemForEdit.id);
      alert('فشل حفظ التعديلات. الرجاء التحقق من صلاحيات قاعدة البيانات.');
    } finally {
      setAdminSaveLoading(false);
    }
  };

  // Render Sub-Forms or direct subviews
  if (subview === 'ready_exit') {
    return <DeviceExit user={user} onBack={() => setSubview('hub')} />;
  }

  if (subview === 'inspection_form') {
    return <Inspection user={user} onBack={() => setSubview('active_devices')} initialInvoice={selectedInvoice} />;
  }

  if (subview === 'approval_form') {
    return <ApprovalAndParts user={user} onBack={() => setSubview('active_devices')} initialInvoice={selectedInvoice} />;
  }

  if (subview === 'maintenance_form') {
    return <Maintenance user={user} onBack={() => setSubview('active_devices')} initialInvoice={selectedInvoice} />;
  }

  return (
    <div className="space-y-4 pb-12 text-right" dir="rtl">
      {/* Toast Alert Banner */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-5 left-5 right-5 md:left-auto md:w-96 z-[200] bg-emerald-950/90 text-emerald-300 border border-emerald-500/30 px-5 py-4 rounded-2xl shadow-2xl flex items-center gap-3 backdrop-blur-md"
          >
            <CheckCircle className="text-emerald-400 shrink-0" size={20} />
            <p className="text-xs font-bold leading-tight font-cairo">{toastMessage}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Unified Header */}
      <div className="flex items-center px-4 py-3 border-b border-white/10 bg-black/20">
        <div className="flex items-center gap-2">
          <button 
            type="button"
            onClick={() => {
              if (subview === 'hub') onBack();
              else if (subview === 'admin_correction_action') setSubview('admin_correction');
              else setSubview('hub');
            }}
            className="p-1.5 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-xl transition-all"
            title={subview === 'hub' ? 'الرجوع للرئيسية' : 'رجوع لإدارة الأجهزة'}
          >
            <ArrowLeft size={18} className="rtl:rotate-180" />
          </button>
          <div>
            <h1 className="text-lg font-black text-white m-0 p-0">إدارة وحوكمة الأجهزة</h1>
            <p className="text-[10px] text-gray-500 font-bold m-0 p-0 leading-none mt-1">
              {subview === 'active_devices' 
                ? 'مراقبة والتحكم بالأجهزة النشطة وعملياتها' 
                : subview === 'delivered' 
                  ? 'أرشيف وحصيلة الأجهزة المسلمة للزبائن' 
                  : subview === 'admin_correction' 
                    ? 'لوحة تحكم وتصحيح أخطاء مدخلي البيانات للتحكم بالحسابات والأسعار والمقادير والجهاز'
                    : subview === 'admin_correction_action'
                      ? 'إجراء وتعديل حالات الفاتورة والأجهزة المحددة وإعادة ضبط التكلفة والعدد'
                      : 'تصفح ومراقبة العمليات والتحكم بحالات الأجهزة النشطة والجاهزة مع تقارير التسليم'}
            </p>
          </div>
        </div>
      </div>

      {/* Hub View containing beautiful 3-grid controller */}
      {subview === 'hub' && (
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#121212] border border-white/5 rounded-[2rem] p-5 md:p-8 text-center flex flex-col items-center justify-center min-h-[300px] shadow-2xl relative overflow-hidden group"
        >
          <div className="absolute inset-0 bg-gradient-to-tr from-blue-600/5 via-transparent to-transparent opacity-50 pointer-events-none" />
          
          <div className="relative z-10 space-y-5 w-full max-w-2xl mx-auto">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-orange-600/10 text-orange-500 flex items-center justify-center mx-auto border border-orange-500/20 shadow-xl shadow-orange-600/5">
                <Cpu size={28} className="animate-pulse" />
              </div>
              <h2 className="text-2xl font-black font-cairo text-white">إشراف وإدارة الأجهزة المتقدمة</h2>
              <p className="text-gray-400 text-xs font-bold font-cairo max-w-lg mx-auto leading-relaxed">
                لوحة إشراف وتدقيق متقدمة مخصصة لمدراء النظام لتصحيح وتعديل أي أخطاء حصلت من قبل مدخلي البيانات، وضبط كميات وأسعار وحالات الأجهزة في الفواتير بشكل مرن.
              </p>
            </div>

            {/* Only Admin Corrections Button displayed beautifully in center */}
            <div className="max-w-md mx-auto pt-4">
              <motion.button
                whileHover={{ scale: 1.03, translateY: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  setAdminInvoiceSearch('');
                  setTimeFilter('day');
                  setSubview('admin_correction');
                }}
                className="w-full p-8 bg-[#181818] border border-orange-500/20 rounded-3xl text-center space-y-4 hover:border-orange-500/50 hover:bg-orange-500/5 transition-all group cursor-pointer shadow-2xl shadow-black/80"
              >
                <div className="w-16 h-16 rounded-2xl bg-orange-500/10 text-orange-400 flex items-center justify-center mx-auto group-hover:bg-orange-500 group-hover:text-white transition-all shadow-lg shadow-orange-500/10">
                  <AlertTriangle size={32} />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-black font-cairo text-white">تصحيح وتعديل الأخطاء (المشرف)</h3>
                  <p className="text-xs text-gray-400 font-bold font-cairo max-w-xs mx-auto pt-1">
                    تعديل حالات الأجهزة، أسعار الخدمات، والكميات للفواتير لتصحيح الإدخالات الخاطئة.
                  </p>
                  <span className="text-[10px] text-orange-500 font-bold tracking-widest block uppercase font-mono pt-2">Advanced Administration</span>
                </div>
              </motion.button>
            </div>
          </div>
        </motion.div>
      )}

      {/* SUBVIEW: Active Devices Pipeline Layout */}
      {subview === 'active_devices' && (
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          className="space-y-6"
        >
          {/* Subview Control / Filters */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#161616] border border-white/5 p-4 rounded-2xl">
            <div className="text-right">
              <h2 className="text-base font-bold font-cairo text-white">إدارة تدفقات الأجهزة النشطة</h2>
              <p className="text-[10px] text-slate-400 font-medium">التحكم في الأجهزة الجديدة والتشخيصية من الدخول وحتى التسليم</p>
            </div>
            
            <div className="relative w-full md:w-80">
              <input 
                type="text" 
                placeholder="ابحث برقم الفاتورة أو اسم العميل..."
                value={activeSearch}
                onChange={e => setActiveSearch(e.target.value)}
                className="w-full bg-black/40 text-xs border border-white/10 rounded-xl px-4 py-2.5 focus:border-blue-500 outline-none transition-all pr-10 text-right"
              />
              <SearchIcon className="absolute right-3 top-2.5 text-gray-500" size={16} />
            </div>
          </div>

          {/* Active Devices Table Container */}
          <div className="bg-[#121212] border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="border-b border-white/5 bg-white/[0.02]">
                    <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-wider font-cairo">رقم الفاتورة</th>
                    <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-wider font-cairo">العميل</th>
                    <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-wider font-cairo">عدد الأجهزة</th>
                    <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-wider font-cairo">الحالة الحالية</th>
                    <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-wider font-cairo text-center">الخيار الأول (المسار الرئيسي)</th>
                    <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-wider font-cairo text-center">الخيار الثاني (إلغاء العملية)</th>
                    <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-wider font-cairo text-center">تنفيذ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-cairo">
                  {activeInvoicesFiltered.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-gray-500 text-sm font-bold font-cairo bg-black/10">
                        لا توجد فواتير نشطة لمطابقة هذا البحث حالياً.
                      </td>
                    </tr>
                  ) : (
                    activeInvoicesFiltered.map((invoice) => {
                      const selectedChoice = selectedOptions[invoice.id!] || 'action1';
                      const devCount = getDevicesCount(invoice.invoiceNumber);
                      
                      // Label configurations dynamically
                      let action1Label = '';
                      const currentStatus = invoice.status;
                      if (currentStatus === '10' || currentStatus === 'new') action1Label = 'دخول فحص';
                      else if (currentStatus === '20' || currentStatus === 'inspected' || currentStatus === 'testing') action1Label = 'إجراء فحص';
                      else if (currentStatus === '30' || currentStatus === 'awaiting_approval' || currentStatus === '35' || currentStatus === 'awaiting_parts') action1Label = 'انتظار الموافقة والقطع';
                      else if (currentStatus === '40' || currentStatus === 'repairing') action1Label = 'إجراء صيانة';
                      else action1Label = 'عرض المتابعة';

                      return (
                        <tr key={invoice.id} className="hover:bg-white/[0.01] transition-colors">
                          {/* Invoice # */}
                          <td className="py-3 px-6 font-mono text-xs font-bold text-blue-400 whitespace-nowrap">
                            {invoice.invoiceNumber}
                          </td>
                          {/* Client Info */}
                          <td className="py-3 px-6 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-white truncate max-w-[150px]">{invoice.customerName}</span>
                              <span className="text-[10px] text-gray-500">
                                (كود: {getCustomerNum(invoice.customerId)} | <span className="font-mono">{getCustomerPhone(invoice.customerId)}</span>)
                              </span>
                            </div>
                          </td>
                          {/* Device Count */}
                          <td className="py-3 px-6 font-mono font-bold text-xs whitespace-nowrap">
                            {devCount} أجهزة
                          </td>
                          {/* Current Status Color */}
                          <td className="py-3 px-6 whitespace-nowrap">
                            <span className={`inline-block px-2.5 py-1 text-[10px] font-bold rounded-lg border ${getStatusStyle(invoice.status)}`}>
                              {getStatusTextArabic(invoice.status)}
                            </span>
                          </td>
                          
                          {/* Option 1: Main Action (Radio style) */}
                          <td className="py-3 px-6 text-center whitespace-nowrap">
                            <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                              <input 
                                type="radio" 
                                name={`choice_${invoice.id}`}
                                checked={selectedChoice === 'action1'}
                                onChange={() => setSelectedOptions(p => ({ ...p, [invoice.id!]: 'action1' }))}
                                className="w-4 h-4 text-blue-600 bg-black border-white/10 rounded-full focus:ring-blue-500 cursor-pointer"
                              />
                              <span className={`text-xs font-bold ${selectedChoice === 'action1' ? 'text-blue-400' : 'text-gray-500'}`}>
                                {action1Label}
                              </span>
                            </label>
                          </td>

                          {/* Option 2: Cancel/Withdrawn Action (Radio style) */}
                          <td className="py-3 px-6 text-center whitespace-nowrap">
                            <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                              <input 
                                type="radio" 
                                name={`choice_${invoice.id}`}
                                checked={selectedChoice === 'action2'}
                                onChange={() => setSelectedOptions(p => ({ ...p, [invoice.id!]: 'action2' }))}
                                className="w-4 h-4 text-rose-600 bg-black border-white/10 rounded-full focus:ring-rose-500 cursor-pointer"
                              />
                              <span className={`text-xs font-bold ${selectedChoice === 'action2' ? 'text-rose-400 font-black' : 'text-gray-500'}`}>
                                إلغاء العملية والانسحاب
                              </span>
                            </label>
                          </td>

                          {/* Action CTA Button */}
                          <td className="py-3 px-6 text-center whitespace-nowrap">
                            <button
                              onClick={() => handleExecuteAction(invoice)}
                              className={`px-4 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                                selectedChoice === 'action2' 
                                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500 hover:text-white'
                                  : 'bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500 hover:text-white'
                              }`}
                            >
                              إجراء
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}

      {/* SUBVIEW: Delivered Devices Archive list */}
      {subview === 'delivered' && (
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          className="space-y-6"
        >
          {/* Search and context details */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#161616] border border-white/5 p-4 rounded-2xl">
            <div className="text-right">
              <h2 className="text-base font-bold font-cairo text-white">سجلات الأجهزة التي تم تسليمها للعملاء</h2>
              <p className="text-[10px] text-slate-400 font-medium">أرشيف الفواتير المنتهية مع تفاصيل الدفع والمعاينة المالية والتقنية</p>
            </div>
            
            <div className="relative w-full md:w-80">
              <input 
                type="text" 
                placeholder="ابحث برقم الفاتورة أو اسم العميل..."
                value={activeSearch}
                onChange={e => setActiveSearch(e.target.value)}
                className="w-full bg-black/40 text-xs border border-white/10 rounded-xl px-4 py-2.5 focus:border-purple-500 outline-none transition-all pr-10 text-right"
              />
              <SearchIcon className="absolute right-3 top-2.5 text-gray-500" size={16} />
            </div>
          </div>

          {/* Delivered Table */}
          <div className="bg-[#121212] border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="border-b border-white/5 bg-white/[0.02]">
                    <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-wider font-cairo">رقم الفاتورة</th>
                    <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-wider font-cairo">اسم العميل</th>
                    <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-wider font-cairo">عدد الأجهزة</th>
                    <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-wider font-cairo">المبلغ الإجمالي</th>
                    <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-wider font-cairo">المدفوع</th>
                    <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-wider font-cairo">العملة</th>
                    <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-wider font-cairo text-center">أرشيف</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-cairo">
                  {deliveredInvoicesFiltered.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-gray-500 text-sm font-bold font-cairo bg-black/10">
                        لا توجد فواتير مسلمة لمطابقة هذا البحث.
                      </td>
                    </tr>
                  ) : (
                    deliveredInvoicesFiltered.map((invoice) => {
                      const devCount = getDevicesCount(invoice.invoiceNumber);
                      return (
                        <tr key={invoice.id} className="hover:bg-white/[0.01] transition-colors">
                          <td className="py-3 px-6 font-mono text-xs font-bold text-purple-400 whitespace-nowrap">
                            {invoice.invoiceNumber}
                          </td>
                          <td className="py-3 px-6 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-white truncate max-w-[150px]">{invoice.customerName}</span>
                              <span className="text-[10px] text-gray-500">(هاتف: {getCustomerPhone(invoice.customerId)})</span>
                            </div>
                          </td>
                          <td className="py-3 px-6 font-mono text-xs text-white whitespace-nowrap">
                            {devCount} جهاز
                          </td>
                          <td className="py-3 px-6 font-mono text-xs text-emerald-400 font-bold whitespace-nowrap">
                            {invoice.totalCost || 0}
                          </td>
                          <td className="py-3 px-6 font-mono text-xs text-slate-300 whitespace-nowrap">
                            {invoice.amountPaid || 0}
                          </td>
                          <td className="py-3 px-6 font-mono text-[10px] text-gray-500 whitespace-nowrap">
                            {invoice.currency}
                          </td>
                          <td className="py-3 px-6 text-center whitespace-nowrap">
                            <button
                              onClick={() => setActivePreviewInvoice(invoice)}
                              className="px-3.5 py-1.5 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-lg text-xs font-bold flex items-center gap-1.5 mx-auto hover:bg-purple-500 hover:text-white transition-all whitespace-nowrap"
                            >
                              <Eye size={14} />
                              <span>معاينة</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}

      {/* SUBVIEW: Admin Correction List */}
      {subview === 'admin_correction' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-6"
        >
          {/* Header Controls */}
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-[#161616] border border-white/5 p-5 rounded-3xl">
            <div className="space-y-1">
              <h2 className="text-base font-black font-cairo text-white">إجراءات تصحيح الأخطاء لمدراء النظام</h2>
              <p className="text-[10px] text-slate-400 font-bold">يرجى اختيار فلتر التاريخ أو البحث المباشر برقم الفاتورة للتعديل</p>
            </div>

            <div className="flex flex-col md:flex-row md:items-center gap-4">
              {/* Filter controls */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTimeFilter('day')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold font-cairo transition-all border ${
                    timeFilter === 'day'
                      ? 'bg-orange-600 text-white border-orange-600 shadow-lg shadow-orange-600/15'
                      : 'bg-black/20 text-slate-400 border-white/5 hover:bg-white/5'
                  }`}
                >
                  يومي
                </button>
                <button
                  type="button"
                  onClick={() => setTimeFilter('week')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold font-cairo transition-all border ${
                    timeFilter === 'week'
                      ? 'bg-orange-600 text-white border-orange-600 shadow-lg shadow-orange-600/15'
                      : 'bg-black/20 text-slate-400 border-white/5 hover:bg-white/5'
                  }`}
                >
                  أسبوع
                </button>
                <button
                  type="button"
                  onClick={() => setTimeFilter('month')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold font-cairo transition-all border ${
                    timeFilter === 'month'
                      ? 'bg-orange-600 text-white border-orange-600 shadow-lg shadow-orange-600/15'
                      : 'bg-black/20 text-slate-400 border-white/5 hover:bg-white/5'
                  }`}
                >
                  شهر
                </button>
                <button
                  type="button"
                  onClick={() => setTimeFilter('custom')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold font-cairo transition-all border ${
                    timeFilter === 'custom'
                      ? 'bg-orange-600 text-white border-orange-600 shadow-lg shadow-orange-600/15'
                      : 'bg-black/20 text-slate-400 border-white/5 hover:bg-white/5'
                  }`}
                >
                  مخصص
                </button>
              </div>

              {/* Custom date range fields */}
              {timeFilter === 'custom' && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-2 bg-black/40 p-2 rounded-xl border border-white/5"
                >
                  <div className="flex items-center gap-1 text-xs text-slate-400">
                    <span>من:</span>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={e => setCustomStartDate(e.target.value)}
                      className="bg-[#121212] border border-white/10 rounded-lg px-2 py-1 text-white text-xs outline-none focus:border-orange-500"
                    />
                  </div>
                  <div className="flex items-center gap-1 text-xs text-slate-400">
                    <span>إلى:</span>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={e => setCustomEndDate(e.target.value)}
                      className="bg-[#121212] border border-white/10 rounded-lg px-2 py-1 text-white text-xs outline-none focus:border-orange-500"
                    />
                  </div>
                </motion.div>
              )}

              {/* Search by Invoice Number */}
              <div className="relative w-full md:w-64">
                <input
                  type="text"
                  placeholder="بحث برقم الفاتورة..."
                  value={adminInvoiceSearch}
                  onChange={e => setAdminInvoiceSearch(e.target.value)}
                  className="w-full bg-black/40 text-xs border border-white/10 rounded-xl px-4 py-2.5 focus:border-orange-500 outline-none transition-all pr-10 text-right text-white font-bold"
                />
                <SearchIcon className="absolute right-3 top-3 text-gray-500" size={15} />
              </div>
            </div>
          </div>

          {/* Admin Invoice correction list */}
          <div className="bg-[#121212] border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="border-b border-white/5 bg-white/[0.02] text-slate-400 text-xs">
                    <th className="py-4 px-6 font-bold tracking-wider font-cairo">رقم الفاتورة</th>
                    <th className="py-4 px-6 font-bold tracking-wider font-cairo">رقم العميل</th>
                    <th className="py-4 px-6 font-bold tracking-wider font-cairo">إسم العميل</th>
                    <th className="py-4 px-6 font-bold tracking-wider font-cairo">عدد الأجهزة</th>
                    <th className="py-4 px-6 font-bold tracking-wider font-cairo">المبلغ الكلي</th>
                    <th className="py-4 px-6 font-bold tracking-wider font-cairo text-center">إجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-cairo text-slate-200">
                  {getFilteredInvoicesForAdmin().length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-gray-500 text-sm font-bold bg-black/10">
                        لا توجد فواتير مطابقة لخيارات التصفية حالياً.
                      </td>
                    </tr>
                  ) : (
                    getFilteredInvoicesForAdmin().map((invoice) => {
                      const devCount = getDevicesCount(invoice.invoiceNumber);
                      return (
                        <tr key={invoice.id} className="hover:bg-white/[0.01] transition-colors">
                          <td className="py-3 px-6 font-mono text-xs font-bold text-orange-400 whitespace-nowrap">
                            {invoice.invoiceNumber}
                          </td>
                          <td className="py-3 px-6 font-mono text-xs text-slate-400 whitespace-nowrap">
                            {getCustomerNum(invoice.customerId)}
                          </td>
                          <td className="py-3 px-6 font-bold text-sm text-white max-w-[200px] truncate whitespace-nowrap">
                            {invoice.customerName}
                          </td>
                          <td className="py-3 px-6 font-mono font-bold text-xs text-slate-300 whitespace-nowrap">
                            {devCount} جهاز/أجهزة
                          </td>
                          <td className="py-3 px-6 font-mono text-xs text-emerald-400 font-bold whitespace-nowrap">
                            {Number(invoice.totalCost || 0).toFixed(2)} <span className="text-[10px] text-gray-500">{invoice.currency || 'YER'}</span>
                          </td>
                          <td className="py-3 px-6 text-center whitespace-nowrap">
                            <button
                              onClick={() => {
                                setSelectedInvoiceForAdmin(invoice);
                                setSelectedItemForEdit(null);
                                setAdminNewStatus('');
                                setAdminNewQuantity(1);
                                setAdminNewPrice(0);
                                setSubview('admin_correction_action');
                              }}
                              className="px-4.5 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-orange-800/10 hover:shadow-orange-700/20 whitespace-nowrap"
                            >
                              إجراء
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}

      {/* SUBVIEW: Admin Correction Item Action Form */}
      {subview === 'admin_correction_action' && selectedInvoiceForAdmin && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6 animate-fade-in"
        >
          {/* Action view header */}
          <div className="bg-[#1a1a1a] rounded-3xl p-6 border border-white/5 shadow-2xl space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="text-[10px] bg-orange-500/20 text-orange-500 font-bold px-2.5 py-1 rounded-lg uppercase tracking-wider font-mono">
                  تصحيح بيانات أجهزة الفاتورة #{selectedInvoiceForAdmin.invoiceNumber}
                </span>
                <h2 className="text-2xl font-black text-white mt-1">العميل: {selectedInvoiceForAdmin.customerName}</h2>
              </div>

              <div className="text-right text-xs text-gray-400 space-y-1 bg-black/20 p-3 rounded-2xl border border-white/5">
                <div>مستخدم النظام المسؤول: <span className="text-white font-bold">{user?.name || user?.username || 'المشرف'}</span></div>
                <div>تاريخ ووقت الإجراء: <span className="text-white font-mono">{new Date().toLocaleString('ar-YE')}</span></div>
              </div>
            </div>

            <button
              onClick={() => setSubview('admin_correction')}
              className="px-4 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold text-gray-300 transition-colors inline-flex items-center gap-1.5 border border-white/5"
            >
              <ArrowLeft size={14} className="rtl:rotate-180" />
              <span>العودة لقائمة الفواتير</span>
            </button>
          </div>

          {/* Form container */}
          <div className="bg-[#121212] border border-white/5 rounded-3xl p-6 md:p-8 space-y-6">
            <div className="max-w-2xl mx-auto space-y-6">

              {/* Selector dropdown */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 block pb-1">اختر الجهاز المطلوب تصحيح بياناته:</label>
                <select
                  value={selectedItemForEdit?.id || ''}
                  onChange={(e) => {
                    const selectedId = e.target.value;
                    const found = items.find(it => it.id === selectedId);
                    if (found) {
                      setSelectedItemForEdit(found);
                      setAdminNewStatus(found.status);
                      setAdminNewQuantity(Number(found.quantity) || 1);
                      const uCost = (found.unitCost !== undefined && found.unitCost !== null) 
                        ? Number(found.unitCost) 
                        : (Number(found.quantity) > 0 ? (Number(found.cost || 0) / Number(found.quantity)) : Number(found.cost || 0));
                      setAdminNewPrice(isNaN(uCost) ? 0 : uCost);
                    } else {
                      setSelectedItemForEdit(null);
                      setAdminNewStatus('');
                      setAdminNewQuantity(1);
                      setAdminNewPrice(0);
                    }
                  }}
                  className="w-full bg-[#1a1a1a] border border-white/10 rounded-2xl px-4 py-3.5 text-sm focus:border-orange-500 outline-none transition-all text-white font-bold"
                >
                  <option value="">-- اختر الجهاز من القائمة --</option>
                  {items
                    .filter(it => it.invoiceNumber === selectedInvoiceForAdmin.invoiceNumber)
                    .map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.deviceType} {it.deviceName ? `- ${it.deviceName}` : ''} | الكمية: {it.quantity} | عطل: {it.faultType}
                      </option>
                    ))}
                </select>
              </div>

              {/* Editable form parameters */}
              {selectedItemForEdit && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="space-y-6 pt-2"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

                    {/* Quantity Block */}
                    <div className="space-y-4 bg-white/[0.02] border border-white/5 p-5 rounded-2xl">
                      <h4 className="text-xs font-black text-gray-400 border-b border-white/5 pb-2 flex items-center gap-1.5">
                        <Hash size={14} className="text-orange-500" />
                        <span>مربع التحكم بالأعداد والكميات</span>
                      </h4>

                      <div className="space-y-2">
                        <label className="text-xs text-gray-500 block">العدد الحالي للجهاز في الفاتورة:</label>
                        <div className="bg-black/40 border border-white/5 text-gray-400 font-mono font-bold text-sm px-4 py-2.5 rounded-xl">
                          {selectedItemForEdit.quantity} حبات/أجهزة
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs text-orange-500 font-bold block">العدد الجديد:</label>
                        <input
                          type="number"
                          min={1}
                          dir="ltr"
                          lang="en"
                          onFocus={e => e.target.select()}
                          value={adminNewQuantity}
                          onChange={(e) => setAdminNewQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl px-4 py-2.5 text-sm font-mono focus:border-orange-500 outline-none text-white font-bold text-center"
                        />
                      </div>

                      <div className="space-y-2 pt-2 border-t border-white/5">
                        <label className="text-xs text-gray-500 block">الحالة الحالية للجهاز:</label>
                        <div className="bg-black/60 border border-white/5 text-blue-400 font-bold text-xs px-4 py-3 rounded-xl">
                          {getStatusTextArabic(selectedItemForEdit.status)}
                        </div>
                      </div>
                    </div>

                    {/* Price Block */}
                    <div className="space-y-4 bg-white/[0.02] border border-white/5 p-5 rounded-2xl">
                      <h4 className="text-xs font-black text-gray-400 border-b border-white/5 pb-2 flex items-center gap-1.5">
                        <DollarSign size={14} className="text-orange-500" />
                        <span>مربع التحكم بالتكلفة والسعر</span>
                      </h4>

                      <div className="space-y-2">
                        <label className="text-xs text-gray-500 block">السعر الحالي المفرد (تكلفة الوحدة):</label>
                        <div className="bg-black/40 border border-white/5 text-gray-400 font-mono font-bold text-sm px-4 py-2.5 rounded-xl">
                          {((selectedItemForEdit.unitCost !== undefined && selectedItemForEdit.unitCost !== null) 
                            ? Number(selectedItemForEdit.unitCost) 
                            : (Number(selectedItemForEdit.quantity || 0) > 0 ? (Number(selectedItemForEdit.cost || 0) / Number(selectedItemForEdit.quantity || 0)) : Number(selectedItemForEdit.cost || 0))
                          ).toFixed(2)} <span className="text-xs font-sans text-gray-600">{selectedInvoiceForAdmin.currency || 'YER'}</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs text-orange-500 font-bold block">السعر الجديد المفرد:</label>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          dir="ltr"
                          lang="en"
                          onFocus={e => e.target.select()}
                          value={adminNewPrice}
                          onChange={(e) => setAdminNewPrice(Math.max(0, parseFloat(e.target.value) || 0))}
                          className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl px-4 py-2.5 text-sm font-mono focus:border-orange-500 outline-none text-white font-bold text-center border-dashed"
                        />
                      </div>

                      <div className="space-y-2 pt-2 border-t border-white/5">
                        <label className="text-xs text-gray-500 block">التكلفة الإجمالية المحسوبة:</label>
                        <div className="bg-[#141414] border border-white/5 p-2.5 text-emerald-400 font-mono uppercase text-sm font-black rounded-xl text-center">
                          {(adminNewQuantity * adminNewPrice).toFixed(2)} <span className="text-xs font-sans text-slate-500">{selectedInvoiceForAdmin.currency || 'YER'}</span>
                        </div>
                      </div>
                    </div>

                  </div>

                  {/* Status update block */}
                  <div className="space-y-2 bg-white/[0.01] border border-white/5 p-5 rounded-2xl">
                    <label className="text-xs font-bold text-orange-500 block">الحالة الجديدة المطلوبة للجهاز:</label>
                    <select
                      value={adminNewStatus}
                      onChange={(e) => setAdminNewStatus(e.target.value)}
                      className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-orange-500 outline-none transition-all text-white font-bold"
                    >
                      {EDIT_OPTIONS_STATUSES.map(st => (
                        <option key={st.value} value={st.value}>{st.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Save actions */}
                  <div className="pt-4 flex items-center justify-end gap-3 border-t border-white/5">
                    <button
                      type="button"
                      onClick={() => setSelectedItemForEdit(null)}
                      className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-gray-400 rounded-xl text-xs font-bold font-cairo border border-white/5"
                    >
                      إلغاء التغييرات
                    </button>

                    <button
                      type="button"
                      disabled={adminSaveLoading}
                      onClick={handleAdminSaveDevice}
                      className="px-8 py-3 bg-gradient-to-l from-orange-600 to-orange-700 hover:from-orange-500 text-white font-black font-cairo rounded-xl text-xs shadow-xl shadow-orange-900/10 hover:shadow-orange-600/30 transition-all flex items-center gap-2"
                    >
                      {adminSaveLoading ? 'جاري تحديث البيانات وسجل التعديل...' : 'اعتماد الإجراء وتعديل البيانات'}
                    </button>
                  </div>

                </motion.div>
              )}

            </div>
          </div>
        </motion.div>
      )}

      {/* MODAL: Procedure Action - Cancel Operation / إلغاء العملية والانسحاب */}
      <AnimatePresence>
        {showCancelModal && selectedInvoice && (
          <div className="fixed inset-0 z-[160] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/85 backdrop-blur-sm"
              onClick={() => setShowCancelModal(false)}
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative bg-[#1a1a1a] border border-white/10 p-6 w-full max-w-lg rounded-[2rem] shadow-2xl space-y-6 text-right"
              dir="rtl"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <div className="flex items-center gap-2 text-rose-500 font-black font-cairo">
                  <AlertTriangle size={20} />
                  <span>إجراء إلغاء العملية وسحب الأجهزة (كود 70)</span>
                </div>
                <button 
                  onClick={() => setShowCancelModal(false)}
                  className="w-8 h-8 flex items-center justify-center bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-lg transition-all border border-red-500/20 group"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Patient / Device Info Card */}
              <div className="bg-black/45 p-4 rounded-2xl border border-white/5 space-y-3 font-cairo text-xs text-gray-300">
                <div className="grid grid-cols-2 gap-y-2 gap-x-4">
                  <div>
                    <span className="text-gray-500 block mb-0.5">رقم الفاتورة</span>
                    <span className="text-sm font-bold text-white font-mono">#{selectedInvoice.invoiceNumber}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block mb-0.5">شفرة العميل</span>
                    <span className="text-sm font-bold text-white font-mono">{getCustomerNum(selectedInvoice.customerId)}</span>
                  </div>
                  <div className="col-span-2 pt-2 border-t border-white/5">
                    <span className="text-gray-500 block mb-0.5">اسم العميل ورابطه</span>
                    <span className="text-sm font-bold text-rose-400">{selectedInvoice.customerName}</span>
                  </div>
                  <div className="col-span-2 pt-2 border-t border-white/5 flex justify-between">
                    <div>
                      <span className="text-gray-500 block mb-0.5">هاتف العميل</span>
                      <span className="text-sm font-bold text-white font-mono">{getCustomerPhone(selectedInvoice.customerId)}</span>
                    </div>
                    <div className="text-left font-cairo">
                      <span className="text-gray-500 block mb-0.5">العدد الإجمالي للأجهزة</span>
                      <span className="text-sm font-black text-rose-400 font-mono">{getDevicesCount(selectedInvoice.invoiceNumber)} أجهزة</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Text Area for Cause notes */}
              <div className="space-y-2 font-cairo">
                <label className="text-xs font-bold text-gray-400 block">سبب إلغاء العملية والانسحاب من الصيانة:</label>
                <textarea
                  rows={4}
                  value={cancelNotes}
                  onChange={e => setCancelNotes(e.target.value)}
                  placeholder="اكتب بالتفصيل سبب إلغاء الفاتورة من قبل مدخل البيانات أو رغبة العميل في الانسحاب وسحب الأجهزة..."
                  className="w-full bg-black/50 border border-white/10 rounded-2xl p-4 text-xs font-bold focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-none text-right transition-all text-white placeholder-gray-600 leading-relaxed"
                />
              </div>

              {/* Actions Footer */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCancelModal(false)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-xl text-xs font-bold font-cairo border border-white/5"
                >
                  تراجع
                </button>
                <button
                  type="button"
                  disabled={loadingCancel}
                  onClick={handleConfirmCancel}
                  className="px-6 py-2 bg-gradient-to-l from-rose-600 to-rose-700 text-white rounded-xl text-xs font-black font-cairo shadow-lg shadow-rose-500/10 hover:from-rose-500 transition-all flex items-center gap-2"
                >
                  {loadingCancel ? 'جاري تنفيذ المسار...' : 'تنفيذ إجراء إلغاء الفاتورة وكود 70'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: Delivered Invoice Comprehensive Receipt Preview */}
      <AnimatePresence>
        {activePreviewInvoice && (
          <div className="fixed inset-0 z-[160] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/85 backdrop-blur-sm"
              onClick={() => setActivePreviewInvoice(null)}
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative bg-[#171717] border border-white/10 p-6 w-full max-w-2xl rounded-[2.5rem] shadow-2xl space-y-6 text-right max-h-[90vh] overflow-y-auto"
              dir="rtl"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-500/10 text-purple-400 rounded-xl border border-purple-500/20">
                    <PackageCheck size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-black font-cairo text-white">معاينة تفاصيل الفاتورة المستلمة</h3>
                    <p className="text-[9px] text-gray-500 font-bold tracking-widest font-mono">Invoice Archive Receipt Preview</p>
                  </div>
                </div>
                <button 
                  onClick={() => setActivePreviewInvoice(null)}
                  className="w-8 h-8 flex items-center justify-center bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-lg transition-all border border-red-500/20 group"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Receipt Body */}
              <div className="space-y-6 font-cairo">
                {/* section: Top meta split customer v invoice */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Customer Information detail */}
                  <div className="p-4 bg-black/30 border border-white/5 rounded-2xl space-y-2">
                    <h4 className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1 flex items-center gap-1.5 border-b border-white/5 pb-1.5">
                      <UserIcon size={12} className="text-purple-400" />
                      <span>بيانات العميل</span>
                    </h4>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-400">اسم العميل:</span>
                        <span className="text-white font-bold">{activePreviewInvoice.customerName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">كود العميل:</span>
                        <span className="text-white font-bold font-mono">#{getCustomerNum(activePreviewInvoice.customerId)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">رقم الاتصال:</span>
                        <span className="text-white font-bold font-mono">{getCustomerPhone(activePreviewInvoice.customerId)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Invoice Meta details */}
                  <div className="p-4 bg-black/30 border border-white/5 rounded-2xl space-y-2">
                    <h4 className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1 flex items-center gap-1.5 border-b border-white/5 pb-1.5">
                      <Hash size={12} className="text-purple-400" />
                      <span>بيانات الفاتورة</span>
                    </h4>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-400">رقم الفاتورة:</span>
                        <span className="text-purple-400 font-bold font-mono">#{activePreviewInvoice.invoiceNumber}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">تاريخ الدخول:</span>
                        <span className="text-white font-bold font-mono">
                          {activePreviewInvoice.createdAt 
                            ? new Date(activePreviewInvoice.createdAt?.toDate ? activePreviewInvoice.createdAt.toDate() : activePreviewInvoice.createdAt).toLocaleDateString('ar-YE', { year: 'numeric', month: 'long', day: 'numeric' })
                            : '---'
                          }
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">تاريخ الخروج والتسليم:</span>
                        <span className="text-white font-bold font-mono">
                          {activePreviewInvoice.updatedAt 
                            ? new Date(activePreviewInvoice.updatedAt?.toDate ? activePreviewInvoice.updatedAt.toDate() : activePreviewInvoice.updatedAt).toLocaleDateString('ar-YE', { year: 'numeric', month: 'long', day: 'numeric' })
                            : '---'
                          }
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* section: Financial block detailing cost paid outstanding */}
                <div className="p-4 bg-gradient-to-l from-purple-950/20 to-transparent border border-purple-500/10 rounded-2xl">
                  <h4 className="text-[10px] text-purple-400 uppercase tracking-wider font-bold mb-3 border-b border-purple-500/10 pb-1.5 flex items-center gap-1.5">
                    <DollarSign size={12} />
                    <span>الملخص المالي للفاتورة</span>
                  </h4>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="p-2 border-r border-white/5">
                      <span className="text-[10px] text-gray-500 block">التكلفة الإجمالية</span>
                      <span className="text-base font-black text-purple-400 font-mono mt-0.5 block">{activePreviewInvoice.totalCost || 0} {activePreviewInvoice.currency}</span>
                    </div>
                    <div className="p-2 border-r border-white/5">
                      <span className="text-[10px] text-gray-500 block">المبلغ المدفوع</span>
                      <span className="text-base font-black text-emerald-400 font-mono mt-0.5 block">{activePreviewInvoice.amountPaid || 0} {activePreviewInvoice.currency}</span>
                    </div>
                    <div className="p-2">
                      <span className="text-[10px] text-gray-500 block">المبلغ المتبقي</span>
                      <span className="text-base font-black text-rose-400 font-mono mt-0.5 block">
                        {Math.max(0, (activePreviewInvoice.totalCost || 0) - (activePreviewInvoice.amountPaid || 0))} {activePreviewInvoice.currency}
                      </span>
                    </div>
                  </div>
                </div>

                {/* section: Devices items list inside this invoice */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-gray-400 border-b border-white/5 pb-2">تفاصيل الأجهزة ({items.filter(it => it.invoiceNumber === activePreviewInvoice.invoiceNumber).length})</h4>
                  
                  <div className="space-y-3">
                    {items
                      .filter(it => it.invoiceNumber === activePreviewInvoice.invoiceNumber)
                      .map((item, idx) => {
                        return (
                          <div key={item.id || idx} className="p-4 bg-black/20 border border-white/5 rounded-xl space-y-2 text-xs">
                            <div className="flex items-center justify-between font-bold">
                              <span className="text-white text-sm">{item.deviceType} {item.deviceName ? `- ${item.deviceName}` : ''}</span>
                              <span className="text-[10px] font-mono text-gray-500 bg-white/5 px-2 py-0.5 rounded-md">الكمية: {item.quantity}</span>
                            </div>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-gray-400 text-xs pt-1 border-t border-white/[0.03]">
                              <div>
                                <span className="text-gray-500">العطل المذكور:</span> {item.customerProblem || 'غير محدد'}
                              </div>
                              <div>
                                <span className="text-gray-500">تقرير المهندس:</span> {item.engineerReport || item.technicalNotes || 'لا يوجد تقرير'}
                              </div>
                              {item.failureReason && (
                                <div className="col-span-2 text-red-400">
                                  <span className="text-gray-500">ملاحظة الفشل/الانسحاب:</span> {item.failureReason}
                                </div>
                              )}
                              <div className="col-span-2 flex justify-between pt-1 font-mono text-[10px] text-gray-500 border-t border-white/[0.02]">
                                <span>المهندس: {item.technician || '---'}</span>
                                <span className="text-purple-400 font-bold">تكلفة الصيانة: {item.cost || 0} {activePreviewInvoice.currency}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                <span className="text-[10px] text-gray-500 font-mono font-bold">رقم الفاتورة المرجعي: {activePreviewInvoice.id}</span>
                <button
                  type="button"
                  onClick={() => setActivePreviewInvoice(null)}
                  className="px-5 py-2 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white rounded-xl text-xs font-bold font-cairo border border-white/5"
                >
                  إغلاق المعاينة
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

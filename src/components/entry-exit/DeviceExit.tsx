import { sharePdfFile } from '../../lib/shareHelper';
import { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, writeBatch, getDoc } from '../../firebase';
import { db } from '../../firebase';
import { Invoice, InvoiceItem, User } from '../../types';
import { useTranslation } from 'react-i18next';
import { CheckCircle, Search, Save, X, Info, HardDrive, User as UserIcon, ArrowLeft, Phone, MapPin, Facebook, Smartphone, MessageCircle, Printer, Share2 } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import BankAccountsFooter from '../BankAccountsFooter';

function getItemSubStatus(item: InvoiceItem): string {
  if (item.subStatus) {
    if (item.subStatus === 'refused') {
      const reason = (item.failureReason || '').toLowerCase();
      const report = (item.engineerReport || '').toLowerCase();
      if (
        reason.includes('قطع') || report.includes('قطع') ||
        reason.includes('parts') || report.includes('parts') ||
        reason.includes('تتوفر') || report.includes('تتوفر') ||
        reason.includes('توفر') || report.includes('توفر')
      ) {
        return 'no_parts';
      }
    }
    return item.subStatus;
  }
  
  // For legacy items, fall back on their status field:
  if (item.status === 'ready') return 'ready';
  if (item.status === 'intact') return 'intact';
  if (item.status === 'unrepairable') return 'unrepairable';
  if (item.status === 'no_parts') return 'no_parts';
  if (item.status === 'refused') {
    const reason = (item.failureReason || '').toLowerCase();
    const report = (item.engineerReport || '').toLowerCase();
    if (
      reason.includes('قطع') || report.includes('قطع') ||
      reason.includes('parts') || report.includes('parts') ||
      reason.includes('تتوفر') || report.includes('تتوفر') ||
      reason.includes('توفر') || report.includes('توفر')
    ) {
      return 'no_parts';
    }
    return 'refused';
  }
  if (item.status === '70' || item.status === 'cancelled') return 'cancelled';
  
  // If it's the unified code '50' but lacks subStatus (e.g. newly created before our fix):
  if (item.status === '50') {
    const report = (item.engineerReport || '').toLowerCase();
    const reason = (item.failureReason || '').toLowerCase();
    
    if (
      reason.includes('قطع') || report.includes('قطع') ||
      reason.includes('parts') || report.includes('parts') ||
      reason.includes('تتوفر') || report.includes('تتوفر') ||
      reason.includes('توفر') || report.includes('توفر')
    ) {
      return 'no_parts';
    }
    if (reason.includes('لم يوافق') || report.includes('لم يوافق')) return 'refused';
    if (reason.includes('لا يصلح') || report.includes('لا يصلح') || reason.includes('unrepairable') || report.includes('unrepairable')) return 'unrepairable';
    if (report.includes('سليم') || report.includes('intact')) return 'intact';
    return 'ready';
  }
  
  return item.status || 'new';
}

const getStatusArabic = (status: string) => {
  switch (status) {
    case 'ready': return 'جاهز';
    case 'intact': return 'سليم';
    case 'unrepairable': return 'لا يصلح';
    case 'refused': return 'لم يوافق العميل';
    case 'no_parts': return 'عدم توفر قطع الغيار';
    default: return status || '-';
  }
};

export default function DeviceExit({ user, onBack }: { user: User, onBack: () => void }) {
  const { t } = useTranslation();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [search, setSearch] = useState('');
  
  // Selection
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [exitPaidAmount, setExitPaidAmount] = useState<number>(0);
  const [exitDiscountAmount, setExitDiscountAmount] = useState<number>(0);
  const [activePrintData, setActivePrintData] = useState<{
    invoice: Invoice;
    items: InvoiceItem[];
    paidAmount: number;
    discountAmount: number;
    remainingAmount: number;
    selectedCost: number;
  } | null>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [shopConfig, setShopConfig] = useState<any>(null);
  const [currentOutput, setCurrentOutput] = useState<any>(null);

  useEffect(() => {
    getDoc(doc(db, 'settings', 'shop')).then((snap) => {
      if (snap.exists()) setShopConfig(snap.data());
    });
    const unsubInvoices = onSnapshot(collection(db, 'invoices'), (s) => setInvoices(s.docs.map(d => ({ id: d.id, ...d.data() } as Invoice))));
    const unsubItems = onSnapshot(collection(db, 'invoice_items'), (s) => setItems(s.docs.map(d => ({ id: d.id, ...d.data() } as InvoiceItem))));
    return () => { unsubInvoices(); unsubItems(); };
  }, []);

  const EXIT_READY_STATUSES = ['ready', 'unrepairable', 'intact', 'refused', '50', '70', 'cancelled'];

  const readyInvoices = invoices.filter(inv => {
    // Has at least one ready item
    return items.some(item => item.invoiceNumber === inv.invoiceNumber && EXIT_READY_STATUSES.includes(item.status));
  }).filter(inv => 
    (inv.customerName || '').toLowerCase().includes(search.toLowerCase()) || 
    (inv.invoiceNumber || '').includes(search)
  ).sort((a, b) => Number(b.invoiceNumber) - Number(a.invoiceNumber));

  const openInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    const invoiceReadyItems = items.filter(i => i.invoiceNumber === invoice.invoiceNumber && EXIT_READY_STATUSES.includes(i.status));
    setInvoiceItems(invoiceReadyItems);
    
    // Select all ready items by default
    const allIds = new Set(invoiceReadyItems.map(i => i.id!));
    setSelectedItemIds(allIds);

    // Default paid amount to 0
    setExitPaidAmount(0);
    setExitDiscountAmount(0);
  };

  const handleToggleItem = (id: string) => {
    const newSet = new Set(selectedItemIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedItemIds(newSet);
  };

  const handlePrintDirect = () => {
    const originalStyle = document.createElement('style');
    originalStyle.innerHTML = `
      @media print {
        body * {
          visibility: hidden !important;
        }
        #print-report-area, #print-report-area * {
          visibility: visible !important;
        }
        #print-report-area {
          position: absolute;
          left: 0;
          top: 0;
          width: 100% !important;
          color: #000000 !important;
          background-color: #ffffff !important;
        }
      }
    `;
    document.head.appendChild(originalStyle);
    window.print();
    document.head.removeChild(originalStyle);
  };

  const handleExportPDFAndWhatsApp = async () => {
    if (!activePrintData) return;
    const { invoice, items: prItems, selectedCost } = activePrintData;
    const currency = invoice.currency || 'USD';

    setIsGeneratingPDF(true);

    const originalGetComputedStyle = window.getComputedStyle;
    let tempEl: HTMLDivElement | null = null;

    try {
      const element = document.getElementById('print-report-area');
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

          const clonedArea = clonedDoc.getElementById('print-report-area');
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
                if (classes.includes('text-emerald-')) el.style.color = '#059669';
                if (classes.includes('text-red-') || classes.includes('text-rose-')) el.style.color = '#e11d48';
                if (classes.includes('text-orange-')) el.style.color = '#ea580c';
                if (classes.includes('text-gray-900') || classes.includes('text-black')) el.style.color = '#111827';
                if (classes.includes('text-gray-500') || classes.includes('text-gray-600')) el.style.color = '#4b5563';
                if (classes.includes('bg-gray-50')) el.style.backgroundColor = '#f9fafb';
                if (classes.includes('bg-gray-100')) el.style.backgroundColor = '#f3f4f6';
                if (classes.includes('bg-gray-200')) el.style.backgroundColor = '#e5e7eb';
                if (classes.includes('bg-red-100') || classes.includes('bg-red-50') || classes.includes('bg-red-100/30')) {
                  el.style.backgroundColor = '#fee2e2';
                }
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
      const filename = `فاتورة تسليم أجهزة_${invoice.customerName}_${formattedDate}.pdf`;
      pdf.save(filename);

      let message = `*فاتورة صيانة أجهزة* 📄\n\n`;
      message += `عزيزي العميل *${invoice.customerName}* المحترم،\n`;
      message += `تجد أدناه الفاتورة الخاصة باستلام أجهزتكم رقم *${invoice.invoiceNumber}*:\n\n`;
      message += `- *رقم الفاتورة:* ${invoice.invoiceNumber}\n`;
      message += `- *القيمة الإجمالية:* ${selectedCost.toLocaleString('en-US')} ${currency}\n`;
      if (activePrintData && activePrintData.discountAmount > 0) {
        message += `- *مبلغ الخصم:* ${activePrintData.discountAmount.toLocaleString('en-US')} ${currency}\n`;
      }
      if (activePrintData) {
        message += `- *المبلغ المدفوع:* ${activePrintData.paidAmount.toLocaleString('en-US')} ${currency}\n`;
        message += `- *المبلغ المتبقي:* ${activePrintData.remainingAmount.toLocaleString('en-US')} ${currency}\n`;
      }
      message += `\n*الأجهزة المستلمة:*\n`;
      prItems.forEach((item, index) => {
        message += `\n_${index + 1}. *${item.deviceType} - ${item.deviceName || ''}*_\n`;
        message += `   • تقرير الصيانة: ${item.failureReason || item.engineerReport || '-'}\n`;
        message += `   • التكلفة: ${(item.cost || item.unitCost || 0).toLocaleString('en-US')} ${currency}\n`;
      });
      message += `\nيسعدنا خدمتكم دائمًا. شكرًا لتعاملكم معنا!`;

      let sharedNatively = false;
      try {
        const pdfBlob = pdf.output('blob');
        sharedNatively = await sharePdfFile(pdfBlob, filename, message);
      } catch (err) {
        console.warn('Native sharing failed or was cancelled', err);
      }

      if (!sharedNatively) {
        const encodedMessage = encodeURIComponent(message);
        window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
    } finally {
      window.getComputedStyle = originalGetComputedStyle;
      if (tempEl && tempEl.parentNode) {
        tempEl.parentNode.removeChild(tempEl);
      }
      setIsGeneratingPDF(false);
    }
  };

  const selectedCost = selectedInvoice
    ? invoiceItems.filter(i => selectedItemIds.has(i.id!)).reduce((sum, item) => sum + (getItemSubStatus(item) === 'ready' ? (Number(item.cost) || 0) : 0), 0)
    : 0;

  const remainingCostForSelection = Math.max(0, selectedCost - exitPaidAmount - exitDiscountAmount);
  
  const handleShowPreview = () => {
    if (!selectedInvoice || selectedItemIds.size === 0 || (exitPaidAmount + exitDiscountAmount) > selectedCost) return;
    
    const printItems = invoiceItems.filter(i => selectedItemIds.has(i.id!));
    setActivePrintData({
      invoice: selectedInvoice,
      items: printItems,
      paidAmount: exitPaidAmount,
      discountAmount: exitDiscountAmount,
      remainingAmount: remainingCostForSelection,
      selectedCost: selectedCost
    });
  };

  const finalizeExit = async () => {
    if (!activePrintData || !selectedInvoice) return;
    
    // Process delivery
    const batch = writeBatch(db);
    selectedItemIds.forEach(id => {
      const itemRef = doc(db, 'invoice_items', id);
      batch.update(itemRef, { status: '60', deliveredAt: new Date().getTime() });
    });

    // Update amountPaid on the Invoice
    const invoiceRef = doc(db, 'invoices', selectedInvoice.id!);
    const newAmountPaid = Number(selectedInvoice.amountPaid || 0) + Number(activePrintData.paidAmount);
    const newDiscount = Number(selectedInvoice.discount || 0) + Number(activePrintData.discountAmount);
    
    // Check if ALL items of the invoice are now delivered
    const allInvoiceItems = items.filter(i => i.invoiceNumber === selectedInvoice.invoiceNumber);
    const allDelivered = allInvoiceItems.every(i => i.status === '60' || selectedItemIds.has(i.id!));
    
    const invoiceUpdates: Partial<Invoice> = {
      amountPaid: newAmountPaid,
      discount: newDiscount,
      updatedAt: new Date().getTime()
    };
    
    if (allDelivered) {
      invoiceUpdates.status = '60'; // fully delivered
    }
    
    batch.update(invoiceRef, invoiceUpdates);

    // Save transaction in vault_transactions if paid amount is higher than 0
    if (Number(activePrintData.paidAmount) > 0) {
      const txRef = doc(collection(db, 'vault_transactions'));
      batch.set(txRef, {
        currency: selectedInvoice.currency || 'USD',
        amount: Number(activePrintData.paidAmount),
        customerName: selectedInvoice.customerName || 'عميل نقدي',
        invoiceNumber: String(selectedInvoice.invoiceNumber),
        userName: user?.name || user?.username || 'مدير النظام',
        userId: user?.id || 'admin',
        timestamp: new Date().getTime(),
        type: 'invoice_payment',
        notes: `دفعة خروج أجهزة من الفاتورة ${selectedInvoice.invoiceNumber}`
      });
    }

    await batch.commit();
  };

  const handlePrintAndFinalize = async () => {
    await finalizeExit();
    handlePrintDirect();
    setActivePrintData(null);
    setSelectedInvoice(null);
  };

  const handleExportAndFinalize = async () => {
    await finalizeExit();
    await handleExportPDFAndWhatsApp();
    setActivePrintData(null);
    setSelectedInvoice(null);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20">
      {activePrintData && (
        <div className="fixed inset-0 z-[120] bg-black/95 flex flex-col" dir="rtl">
          {/* Top Navbar */}
          <div className="flex justify-between items-center bg-black/50 p-4 border-b border-white/10 shrink-0 flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setActivePrintData(null)}
                className="px-4 py-2 bg-slate-200 border border-slate-300 rounded-xl text-slate-900 hover:bg-slate-300 font-bold transition-all flex items-center gap-2 text-sm shadow-md"
              >
                <ArrowLeft size={16} className="rtl:rotate-180" />
                العودة للتعديل
              </button>
              <h2 className="text-white font-bold hidden sm:block">فاتورة خروج أجهزه - #{activePrintData.invoice.invoiceNumber}</h2>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={handlePrintAndFinalize}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-white font-bold transition-all flex items-center gap-2 text-sm"
              >
                <Printer size={16} />
                ترحيل وطباعة مباشرة
              </button>
              <button 
                onClick={handleExportAndFinalize}
                disabled={isGeneratingPDF}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition-all flex items-center gap-2 text-sm shadow-[0_0_15px_rgba(5,150,105,0.3)] disabled:opacity-50"
              >
                {isGeneratingPDF ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                ) : (
                  <Share2 size={16} />
                )}
                ترحيل وتصدير للواتس
              </button>
            </div>
          </div>

          {/* Scalable Container for the A4 page */}
          <div className="flex-1 overflow-x-auto bg-black p-4 md:p-8 pb-24 text-right w-full">
            <div id="print-report-area" className="p-8 bg-white text-gray-900 print:p-0 print:bg-white print:text-black w-[794px] min-h-[1123px] mx-auto flex flex-col relative shrink-0">
              {/* Header Layout */}
              <div className="flex justify-between items-start border-b-2 border-gray-900 pb-4 mb-4">
                {/* Right Corner: Shop Name */}
                <div className="text-right flex-1 pt-1">
                  <h2 className="text-xl font-black text-gray-900 tracking-tight leading-tight font-cairo">{shopConfig?.shopName || 'عالم الصيانة والتجارة'}</h2>
                  <div className="text-sm font-black text-gray-900 tracking-tight leading-tight mt-1.5 font-cairo">قسم الصيانة</div>
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
                <div className="text-center flex-[1.2] flex flex-col items-center justify-center">
                  {shopConfig?.logoUrl ? (
                    <img src={shopConfig.logoUrl} alt="Logo" className="h-16 max-w-[150px] object-contain mb-1.5" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-12 h-12 border border-dashed border-gray-300 rounded-xl mb-1.5 flex items-center justify-center text-gray-400 text-[10px] font-bold">شعار المحل</div>
                  )}
                  <h1 className="text-lg font-black text-gray-900 tracking-tight border-2 border-gray-900 px-4 py-1.5 rounded-lg inline-block bg-gray-50/50">فاتورة صيانة أجهزة</h1>
                </div>

                {/* Left Corner: Invoice Info */}
                <div className="text-left flex-1 space-y-1 pt-1 bg-gray-50/50 p-3 rounded-lg border border-gray-200">
                  <div className="text-sm font-bold text-gray-700 flex justify-between gap-4">
                    <span>رقم التقرير:</span>
                    <span className="font-mono text-gray-900">{activePrintData.invoice.invoiceNumber}</span>
                  </div>
                  <div className="text-sm font-bold text-gray-700 flex justify-between gap-4">
                    <span>التاريخ:</span>
                    <span className="font-mono text-gray-900">{new Date().toISOString().slice(0,10).replace(/-/g, '/')}</span>
                  </div>
                  <div className="text-sm font-bold text-gray-700 flex justify-between gap-4">
                    <span>وقت الإصدار:</span>
                    <span className="font-mono text-gray-900">
                      {new Date().toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="text-sm font-bold text-gray-700 flex justify-between gap-4 border-t border-gray-200 pt-1 mt-1">
                    <span>المستخدم:</span>
                    <span className="font-mono text-gray-900">1</span>
                  </div>
                </div>
              </div>

              {/* Customer Info Single Line */}
              <div className="bg-gray-100 p-3 rounded-lg mb-4 border border-gray-300 flex justify-between items-center px-6">
                <div className="text-sm font-black text-gray-900">
                  <span className="text-xs text-gray-600 ml-2">إسم العميل:</span>
                  {activePrintData.invoice.customerName}
                </div>
              </div>

              {/* Device Detailed Items Table */}
              <div className="border border-gray-400 overflow-hidden mb-4 rounded-md">
                <table className="w-full text-right border-collapse text-sm">
                  <thead className="bg-gray-100 text-gray-800 font-bold border-b-2 border-gray-400">
                    <tr>
                      <th className="px-3 py-3 text-center w-12 border-l border-gray-400 bg-gray-200/50">مسلسل</th>
                      <th className="px-3 py-3 border-l border-gray-400">النوع / الجهاز</th>
                      <th className="px-3 py-3 border-l border-gray-400">الحالة</th>
                      <th className="px-3 py-3 text-center border-l border-gray-400 w-28">تكلفة الصيانة</th>
                      <th className="px-3 py-3 text-center border-l border-gray-400 w-24">العدد</th>
                      <th className="px-3 py-3 text-center w-32 font-black bg-gray-200/50">اجمالي التكلفة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-300">
                    {[...activePrintData.items].sort((a, b) => {
                      const typeA = a.deviceType || '';
                      const typeB = b.deviceType || '';
                      const typeCompare = typeA.localeCompare(typeB, 'ar');
                      if (typeCompare !== 0) return typeCompare;

                      const nameA = a.deviceName || '';
                      const nameB = b.deviceName || '';
                      const nameCompare = nameA.localeCompare(nameB, 'ar');
                      if (nameCompare !== 0) return nameCompare;

                      const getConditionRank = (item: any) => {
                        const subStatus = getItemSubStatus(item);
                        if (subStatus === 'ready') return 1;
                        if (subStatus === 'intact') return 2;
                        if (subStatus === 'unrepairable') return 3;
                        if (subStatus === 'refused') return 4;
                        return 5;
                      };
                      return getConditionRank(a) - getConditionRank(b);
                    }).map((item, idx) => {
                      const itemQty = Number(item.quantity || 1);
                      const totalItemCost = Number(getItemSubStatus(item) === 'ready' ? (item.cost || 0) : 0);
                      const unitItemCost = item.unitCost || (itemQty > 0 ? totalItemCost / itemQty : 0);
                      const subStatusArabic = getStatusArabic(getItemSubStatus(item));
                      
                      return (
                        <tr key={item.id} className="even:bg-gray-50/50">
                          <td className="px-3 py-3 text-center font-mono font-bold border-l border-gray-400 bg-gray-50">{idx + 1}</td>
                          <td className="px-3 py-3 font-bold text-gray-900 border-l border-gray-400 leading-relaxed whitespace-nowrap overflow-hidden max-w-[200px] text-ellipsis">
                            {item.deviceType || '-'} {item.deviceName ? `- ${item.deviceName}` : ''}
                          </td>
                          <td className="px-3 py-3 text-gray-900 font-bold leading-relaxed border-l border-gray-400 whitespace-nowrap">
                            {subStatusArabic}
                          </td>
                          <td className="px-3 py-3 text-center font-mono text-gray-900 border-l border-gray-400">
                            {unitItemCost.toLocaleString('en-US')}
                          </td>
                          <td className="px-3 py-3 text-center font-mono text-gray-900 border-l border-gray-400">
                            {itemQty}
                          </td>
                          <td className="px-3 py-3 text-center font-mono font-black text-gray-900 bg-gray-50">
                            {totalItemCost.toLocaleString('en-US')}
                          </td>
                        </tr>
                      );
                    })}
                    {/* Last rows for totals */}
                    <tr className="bg-gray-200/60 font-bold border-t-2 border-gray-400">
                      <td colSpan={4} className="px-3 py-4 text-left font-black border-l border-gray-400 text-base">إجمالى عدد الأجهزة ومبلغ الفاتورة</td>
                      <td className="px-3 py-4 text-center font-mono font-black border-l border-gray-400 text-lg">
                        {activePrintData.items.reduce((sum, item) => sum + Number(item.quantity || 1), 0)}
                      </td>
                      <td className="px-3 py-4 text-center font-mono font-black text-xl text-gray-900 border-l border-gray-400">
                        {activePrintData.selectedCost.toLocaleString('en-US')} <span className="text-sm font-sans mr-1">{activePrintData.invoice.currency || 'USD'}</span>
                      </td>
                    </tr>
                    {/* Combine discount, paid amount, and remaining amount in a single horizontal row */}
                    <tr className="bg-white font-bold border-t border-gray-400">
                      {activePrintData.discountAmount > 0 ? (
                        <>
                          {/* Discount Amount */}
                          <td colSpan={2} className="px-3 py-3 text-center border-l border-gray-400 bg-gray-50/20">
                            <div className="flex items-center justify-center gap-1.5 flex-wrap">
                              <span className="text-gray-500 font-extrabold text-xs">مبلغ الخصم:</span>
                              <span className="font-mono font-black text-amber-600 text-sm">
                                {activePrintData.discountAmount.toLocaleString('en-US')}
                              </span>
                              <span className="text-[10px] font-sans text-gray-400 font-bold">{activePrintData.invoice.currency || 'USD'}</span>
                            </div>
                          </td>

                          {/* Amount Paid */}
                          <td colSpan={2} className="px-3 py-3 text-center border-l border-gray-400 bg-gray-50/20">
                            <div className="flex items-center justify-center gap-1.5 flex-wrap">
                              <span className="text-gray-500 font-extrabold text-xs">المبلغ المدفوع:</span>
                              <span className="font-mono font-black text-emerald-700 text-sm">
                                {activePrintData.paidAmount.toLocaleString('en-US')}
                              </span>
                              <span className="text-[10px] font-sans text-gray-400 font-bold">{activePrintData.invoice.currency || 'USD'}</span>
                            </div>
                          </td>

                          {/* Remaining Amount */}
                          <td colSpan={2} className="px-3 py-3 text-center border-l border-gray-400 bg-red-100/30">
                            <div className="flex items-center justify-center gap-1.5 flex-wrap">
                              <span className="text-red-950 font-black text-sm">المبلغ المتبقي:</span>
                              <span className="font-mono font-black text-red-600 text-lg">
                                {activePrintData.remainingAmount.toLocaleString('en-US')}
                              </span>
                              <span className="text-xs font-sans text-red-800 font-black">{activePrintData.invoice.currency || 'USD'}</span>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          {/* Amount Paid */}
                          <td colSpan={3} className="px-3 py-3 text-center border-l border-gray-400 bg-gray-50/20">
                            <div className="flex items-center justify-center gap-1.5 flex-wrap">
                              <span className="text-gray-500 font-extrabold text-xs">المبلغ المدفوع:</span>
                              <span className="font-mono font-black text-emerald-700 text-sm">
                                {activePrintData.paidAmount.toLocaleString('en-US')}
                              </span>
                              <span className="text-[10px] font-sans text-gray-400 font-bold">{activePrintData.invoice.currency || 'USD'}</span>
                            </div>
                          </td>

                          {/* Remaining Amount */}
                          <td colSpan={3} className="px-3 py-3 text-center border-l border-gray-400 bg-red-100/30">
                            <div className="flex items-center justify-center gap-1.5 flex-wrap">
                              <span className="text-red-950 font-black text-sm">المبلغ المتبقي:</span>
                              <span className="font-mono font-black text-red-600 text-lg">
                                {activePrintData.remainingAmount.toLocaleString('en-US')}
                              </span>
                              <span className="text-xs font-sans text-red-800 font-black">{activePrintData.invoice.currency || 'USD'}</span>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Summary Devices Status */}
              {(() => {
                const counters = [
                  {
                    key: 'ready',
                    label: 'صيانة',
                    value: activePrintData.items.filter(i => getItemSubStatus(i) === 'ready').reduce((sum, i) => sum + Number(i.quantity || 1), 0),
                    textColor: 'text-gray-900',
                  },
                  {
                    key: 'unrepairable',
                    label: 'لايصلح',
                    value: activePrintData.items.filter(i => getItemSubStatus(i) === 'unrepairable').reduce((sum, i) => sum + Number(i.quantity || 1), 0),
                    textColor: 'text-rose-600',
                  },
                  {
                    key: 'intact',
                    label: 'سليم',
                    value: activePrintData.items.filter(i => getItemSubStatus(i) === 'intact').reduce((sum, i) => sum + Number(i.quantity || 1), 0),
                    textColor: 'text-emerald-600',
                  },
                  {
                    key: 'refused',
                    label: 'لم يوافق العميل',
                    value: activePrintData.items.filter(i => getItemSubStatus(i) === 'refused').reduce((sum, i) => sum + Number(i.quantity || 1), 0),
                    textColor: 'text-orange-600',
                  },
                  {
                    key: 'no_parts',
                    label: 'عدم توفر قطع',
                    value: activePrintData.items.filter(i => getItemSubStatus(i) === 'no_parts').reduce((sum, i) => sum + Number(i.quantity || 1), 0),
                    textColor: 'text-red-700',
                  }
                ];

                const activeCounters = counters.filter(c => c.value > 0);

                if (activeCounters.length === 0) return null;

                return (
                  <div className="flex items-center gap-4 mb-4 text-sm font-bold text-gray-900 mt-6 flex-wrap">
                    {activeCounters.map((counter, index) => (
                      <span key={counter.key} className="flex items-center gap-4">
                        {index > 0 && <span className="text-gray-400 font-normal">|</span>}
                        <div className="flex items-center gap-2">
                          <div className={`w-12 h-8 border-2 border-gray-400 bg-gray-50 rounded flex items-center justify-center font-mono font-black text-base ${counter.textColor}`}>
                            {counter.value}
                          </div>
                          <span>{counter.label}</span>
                        </div>
                      </span>
                    ))}
                  </div>
                );
              })()}

              <div className="mt-8">
                <div className="border-t-2 border-gray-900 my-8"></div>

                {/* Footer Notes & Signatures */}
                <div className="flex justify-between items-start text-xs font-bold text-gray-900 leading-loose mb-6 px-4">
                   {/* Right Side */}
                   <div className="text-right space-y-1">
                      <p>تم استلام الأجهزة المذكورة أعلاه في حالة جيدة</p>
                      <p className="pt-6 font-black">توقيع العميل / ........................................</p>
                   </div>

                   {/* Left Side */}
                   <div className="text-left space-y-1">
                      <p>نتمنى أن تكون خدمتنا قد نالت رضاكم</p>
                      <p className="pt-8">اسم المختص / ....................... التوقيع / .......................</p>
                   </div>
                </div>

                <div className="border-t-[3px] border-black mt-2 mb-1 border-solid"></div>
                
                {/* Footer Address and Facebook */}
                {(shopConfig?.address || shopConfig?.facebookUrl) && (
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
                )}

                <BankAccountsFooter shopConfig={shopConfig} currentOutput={currentOutput || { output_datetime: new Date() }} />
              </div>
            </div>
          </div>
        </div>
      )}
      
      {selectedInvoice && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 pointer-events-auto text-right" dir="rtl">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setSelectedInvoice(null)}></div>
          <div className="relative bg-[#1a1a1a] p-6 w-full max-w-5xl rounded-[2rem] border border-white/10 shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/5">
              <h3 className="text-xl font-black text-white flex items-center gap-2">
                <Info size={20} className="text-orange-500" /> مراجعة الفاتورة
              </h3>
              <button onClick={() => setSelectedInvoice(null)} className="w-10 h-10 flex items-center justify-center bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-2xl transition-all border border-red-500/20 group">
                 <X size={20} />
              </button>
            </div>

            <div className="overflow-y-auto pr-2 space-y-6 flex-1 text-right">
              {/* بيانات العميل في الأعلى */}
              <div className="space-y-3 bg-black/20 p-4 rounded-2xl border border-white/5 relative">
                 <h4 className="text-sm font-bold text-gray-400 flex items-center gap-2 mb-3">
                   <UserIcon size={16} /> العميل
                 </h4>
                 <div className="grid grid-cols-2 gap-4 text-sm font-bold text-white">
                   <div>{selectedInvoice.customerName}</div>
                   <div dir="ltr" className="text-left font-mono text-orange-500">#{selectedInvoice.invoiceNumber}</div>
                 </div>
              </div>

              {/* جدول الأجهزة المعروض أفقيا */}
              <div className="space-y-3 bg-black/20 p-4 rounded-2xl border border-white/5 relative overflow-hidden">
                <h4 className="text-sm font-bold text-gray-400 flex items-center gap-2 mb-3">
                  <HardDrive size={16} /> الأجهزة جاهزة للخروج ({invoiceItems.length})
                </h4>
                <div className="overflow-x-auto w-full">
                  <table className="w-full text-right border-collapse text-sm">
                    <thead className="bg-[#111] text-gray-300 font-bold border-b border-white/10 whitespace-nowrap">
                      <tr>
                        <th className="px-3 py-3 text-center text-xs w-20">
                          <div className="flex items-center justify-center gap-1">
                            <span>م</span>
                            <span className="text-gray-600">/</span>
                            <input 
                              type="checkbox"
                              checked={invoiceItems.length > 0 && selectedItemIds.size === invoiceItems.length}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedItemIds(new Set(invoiceItems.map(i => i.id!)));
                                } else {
                                  setSelectedItemIds(new Set());
                                }
                              }}
                              className="rounded border-white/10 bg-black/40 text-orange-600 focus:ring-orange-500 focus:ring-offset-[#1a1a1a] w-3.5 h-3.5 cursor-pointer"
                            />
                          </div>
                        </th>
                        <th className="px-3 py-3 text-right text-xs">النوع/الجهاز</th>
                        <th className="px-3 py-3 text-center text-xs w-16">العدد</th>
                        <th className="px-3 py-3 text-center text-xs w-24">المبلغ</th>
                        <th className="px-3 py-3 text-center text-xs w-28">اجمالي المبلغ</th>
                        <th className="px-3 py-3 text-right text-xs">التقرير</th>
                        <th className="px-3 py-3 text-center text-xs w-28">نوع التقرير</th>
                        <th className="px-3 py-3 text-right text-xs">شكوى العميل</th>
                        <th className="px-3 py-3 text-right text-xs">تفاصيل الاستلام</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-gray-300">
                      {[...invoiceItems].sort((a, b) => {
                        const getConditionRank = (item: any) => {
                          const subStatus = getItemSubStatus(item);
                          if (subStatus === 'ready') return 1;
                          if (subStatus === 'intact') return 2;
                          if (subStatus === 'unrepairable') return 3;
                          if (subStatus === 'refused') return 4;
                          return 5;
                        };
                        return getConditionRank(a) - getConditionRank(b);
                      }).map((item, idx) => {
                        const subStatus = getItemSubStatus(item);
                        const isSelected = selectedItemIds.has(item.id!);
                        
                        const itemQty = Number(item.quantity || 1);
                        const totalItemCost = Number(subStatus === 'ready' ? (item.cost || 0) : 0);
                        const unitItemCost = item.unitCost || (itemQty > 0 ? totalItemCost / itemQty : 0);
                        
                        const getReportTypeArabic = (itemData: typeof item, statusStr: string) => {
                          if (statusStr === 'intact') return 'تقرير الفحص';
                          if (statusStr === 'unrepairable') {
                            return itemData.source === 'inspection' ? 'تقرير الفحص' : 'تقرير الصيانة';
                          }
                          if (statusStr === 'ready') return 'تقرير الصيانة';
                          if (statusStr === 'refused' || statusStr === 'cancelled') return 'تقرير رد العميل';
                          return 'تقرير الصيانة';
                        };

                        const reportTypeArabic = getReportTypeArabic(item, subStatus);
                        
                        const reportText = (subStatus === 'unrepairable' && item.source === 'inspection') 
                          ? (item.engineerReport || 'لا يوجد') 
                          : (item.failureReason || item.engineerReport || 'لا يوجد');

                        const reportTypeBadgeClass = 
                          reportTypeArabic === 'تقرير الفحص' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' :
                          reportTypeArabic === 'تقرير الصيانة' ? 'bg-orange-500/10 text-orange-500 border border-orange-500/20' :
                          'bg-purple-500/10 text-purple-400 border border-purple-500/20';

                        return (
                          <tr 
                            key={item.id} 
                            onClick={() => handleToggleItem(item.id!)}
                            className={`hover:bg-white/5 transition-colors cursor-pointer whitespace-nowrap ${
                              isSelected ? 'bg-orange-500/5' : ''
                            }`}
                          >
                            {/* 1. مسلسل / مربع اختيار */}
                            <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-center gap-2">
                                <span className="font-mono text-gray-400 text-xs">{idx + 1}</span>
                                <input 
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => handleToggleItem(item.id!)}
                                  className="rounded border-white/10 bg-black/40 text-orange-600 focus:ring-orange-500 focus:ring-offset-[#1a1a1a] w-4 h-4 cursor-pointer"
                                />
                              </div>
                            </td>

                            {/* 2. النوع/الجهاز */}
                            <td className="px-3 py-2 text-right text-white font-bold text-xs whitespace-nowrap">
                              {item.deviceType || '-'} {item.deviceName ? ` / ${item.deviceName}` : ''}
                            </td>

                            {/* 3. العدد */}
                            <td className="px-3 py-2 text-center font-mono text-white text-xs">
                              {itemQty}
                            </td>

                            {/* 4. المبلغ */}
                            <td className="px-3 py-2 text-center font-mono text-white text-xs">
                              {unitItemCost.toLocaleString('en-US')}
                            </td>

                            {/* 5. اجمالي المبلغ */}
                            <td className="px-3 py-2 text-center font-mono text-orange-400 font-bold text-xs">
                              {totalItemCost.toLocaleString('en-US')}
                            </td>

                            {/* 6. التقرير */}
                            <td className="px-3 py-2 text-right text-xs text-gray-300 max-w-[150px] truncate" title={reportText}>
                              {reportText}
                            </td>

                            {/* 7. نوع التقرير */}
                            <td className="px-3 py-2 text-center">
                              <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${reportTypeBadgeClass}`}>
                                {reportTypeArabic}
                              </span>
                            </td>

                            {/* 8. شكوى العميل */}
                            <td className="px-3 py-2 text-right text-xs text-gray-300 max-w-[150px] truncate" title={item.customerProblem || 'لا يوجد'}>
                              {item.customerProblem || 'لا يوجد'}
                            </td>

                            {/* 9. تفاصيل الاستلام */}
                            <td className="px-3 py-2 text-right text-xs text-gray-400 max-w-[150px] truncate" title={item.deviceNotes || 'لا يوجد'}>
                              {item.deviceNotes || 'لا يوجد'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Interactive calculations block adjacent to exit action */}
              <div className="pt-6 mt-6 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
                {/* Financial panel on the right (RTL) */}
                <div className="flex flex-wrap items-center gap-6 justify-between w-full md:w-auto md:justify-start">
                  
                  {/* 1. Output devices total cost */}
                  <div className="text-right">
                    <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest block mb-1">إجمالي الخروج</p>
                    <p className="text-lg font-black font-mono text-white text-right w-full">
                      {selectedCost.toFixed(2)} <span className="text-xs text-gray-400 font-sans">{selectedInvoice.currency || 'USD'}</span>
                    </p>
                  </div>

                  {/* Vertical Separator */}
                  <div className="hidden sm:block w-px h-8 bg-white/10" />

                  {/* 2. Amount received / paid (المبلغ الواصل) */}
                  <div className="text-right">
                    <p className="text-[10px] text-orange-400 uppercase font-black tracking-widest block mb-1">المبلغ الواصل</p>
                    <div className="relative">
                      <input
                        type="number"
                        min={0}
                        step="any"
                        dir="ltr"
                        lang="en"
                        value={exitPaidAmount || ''}
                        onFocus={e => e.target.select()}
                        onChange={(e) => {
                          let val = parseFloat(e.target.value);
                          if (isNaN(val)) val = 0;
                          setExitPaidAmount(val);
                        }}
                        className={`w-24 bg-black/40 border rounded-xl px-2.5 py-1.5 text-xs font-bold focus:outline-none transition-all pl-8 font-mono text-center ${
                          (exitPaidAmount + exitDiscountAmount) > selectedCost ? "border-rose-500 text-rose-400 focus:border-rose-500 bg-rose-500/5" : "border-white/10 text-emerald-400 focus:border-emerald-500"
                        }`}
                        placeholder="0"
                      />
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[9px] text-gray-500 font-bold font-mono">
                        {selectedInvoice.currency || 'USD'}
                      </span>
                    </div>
                  </div>

                  {/* Vertical Separator */}
                  <div className="hidden sm:block w-px h-8 bg-white/10" />

                  {/* 2.5 Discount Amount (مبلغ الخصم) */}
                  <div className="text-right">
                    <p className="text-[10px] text-amber-500 uppercase font-black tracking-widest block mb-1">مبلغ الخصم</p>
                    <div className="relative">
                      <input
                        type="number"
                        min={0}
                        step="any"
                        dir="ltr"
                        lang="en"
                        value={exitDiscountAmount || ''}
                        onFocus={e => e.target.select()}
                        onChange={(e) => {
                          let val = parseFloat(e.target.value);
                          if (isNaN(val)) val = 0;
                          setExitDiscountAmount(val);
                        }}
                        className={`w-24 bg-black/40 border rounded-xl px-2.5 py-1.5 text-xs font-bold focus:outline-none transition-all pl-8 font-mono text-center ${
                          (exitPaidAmount + exitDiscountAmount) > selectedCost ? "border-rose-500 text-rose-400 focus:border-rose-500 bg-rose-500/5" : "border-white/10 text-amber-400 focus:border-amber-500"
                        }`}
                        placeholder="0"
                      />
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[9px] text-gray-500 font-bold font-mono">
                        {selectedInvoice.currency || 'USD'}
                      </span>
                    </div>
                  </div>

                  {/* Vertical Separator */}
                  <div className="hidden sm:block w-px h-8 bg-white/10" />

                  {/* 3. New Remaining Balance (المبلغ المتبقي) */}
                  <div className="text-right">
                    <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest block mb-1">المبلغ المتبقي</p>
                    <p className={`text-lg font-black font-mono ${remainingCostForSelection > 0 ? 'text-rose-500' : 'text-emerald-400'}`}>
                      {remainingCostForSelection.toFixed(2)} <span className="text-xs text-gray-500 font-sans">{selectedInvoice.currency || 'USD'}</span>
                    </p>
                  </div>

                </div>

                {/* Action Button & Metadata */}
                <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto justify-end">
                  <div className="text-right text-[11px] text-slate-500 leading-tight hidden lg:block">
                    <div>الواصل سابقاً: <span className="font-mono text-gray-300 font-bold">{Number(selectedInvoice.amountPaid || 0).toFixed(2)}</span> {selectedInvoice.currency}</div>
                    <div>إجمالي الفاتورة: <span className="font-mono text-gray-300 font-bold">{Number(selectedInvoice.totalCost || 0).toFixed(2)}</span> {selectedInvoice.currency}</div>
                  </div>

                  <div className="flex flex-col items-end gap-2 w-full md:w-auto mt-2 sm:mt-0">
                    {(exitPaidAmount + exitDiscountAmount) > selectedCost && (
                      <span className="text-[10px] text-rose-400 font-bold font-cairo text-right">
                        ⚠️ مجموع الواصل والخصم أكبر من قيمة الفاتورة المحددة!
                      </span>
                    )}
                    <button 
                      onClick={handleShowPreview}
                      disabled={selectedItemIds.size === 0 || (exitPaidAmount + exitDiscountAmount) > selectedCost}
                      className="w-full md:w-auto bg-orange-600 hover:bg-orange-700 text-white font-black px-8 py-3 rounded-xl transition-all shadow-lg shadow-orange-600/20 active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 text-sm font-cairo"
                    >
                      <Save size={16} />
                      <span>عرض الفاتورة للمراجعة</span>
                    </button>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    )}

      {/* Unified Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-3 border-b border-white/10 bg-black/20 gap-4" dir="rtl">
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {onBack && (
            <button onClick={onBack} className="p-1.5 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-xl transition-all">
              <ArrowLeft size={18} className="rtl:rotate-180" />
            </button>
          )}
          <h1 className="text-lg font-black text-white m-0 p-0 flex items-center gap-2">
            {t('entryExit.deviceExit', 'Device Exit')}
          </h1>
        </div>
        <div className="relative w-full sm:w-80 font-bold">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
          <input 
            dir="rtl"
            type="text" 
            placeholder={t('common.search', 'بحث...')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#1a1a1a] border border-white/5 rounded-2xl pr-12 pl-4 py-2 focus:border-orange-500 outline-none transition-all text-sm text-right text-white placeholder-gray-500"
          />
        </div>
      </div>

      <div className="bg-[#1a1a1a] rounded-[2rem] border border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse rtl:text-right text-sm">
            <thead className="bg-black/40 text-gray-400 text-xs tracking-widest font-black uppercase border-b border-white/5">
              <tr>
                <th className="px-6 py-5">رقم الفاتورة</th>
                <th className="px-6 py-5">العميل</th>
                <th className="px-3 py-5 text-center">أجهزة الفاتورة</th>
                <th className="px-3 py-5 text-center text-orange-500 font-bold">المعنية بالإخراج</th>
                <th className="px-3 py-5 text-center text-red-500/80">لا يصلح</th>
                <th className="px-3 py-5 text-center text-emerald-500/80">سليم</th>
                <th className="px-3 py-5 text-center text-red-400/80">لم يوافق</th>
                <th className="px-3 py-5 text-center text-orange-500/80">جاهز</th>
                <th className="px-6 py-5 text-center">الإجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-gray-300">
              {readyInvoices.map(invoice => {
                const invItems = items.filter(i => i.invoiceNumber === invoice.invoiceNumber);
                const totalDevices = invItems.reduce((acc, i) => acc + (Number(i.quantity) || 0), 0);
                
                // Devices in the ready states (still inside DeviceExit waiting to be delivered)
                const exitReadyItems = invItems.filter(i => EXIT_READY_STATUSES.includes(i.status));
                const exitReadyCount = exitReadyItems.reduce((acc, i) => acc + (Number(i.quantity) || 0), 0);
                
                let unrepairableCount = 0;
                let intactCount = 0;
                let refusedCount = 0;
                let readyCount = 0;

                exitReadyItems.forEach(item => {
                  const sub = getItemSubStatus(item);
                  const qty = Number(item.quantity) || 0;
                  if (sub === 'unrepairable') unrepairableCount += qty;
                  else if (sub === 'intact') intactCount += qty;
                  else if (sub === 'refused') refusedCount += qty;
                  else if (sub === 'ready') readyCount += qty;
                });

                return (
                  <tr key={invoice.id} className="hover:bg-white/5 transition-colors cursor-pointer group whitespace-nowrap" onClick={() => openInvoice(invoice)}>
                    <td className="px-6 py-3 font-mono font-bold text-orange-500 whitespace-nowrap">{invoice.invoiceNumber}</td>
                    <td className="px-6 py-3 font-bold text-white max-w-[200px] truncate whitespace-nowrap">{invoice.customerName}</td>
                    <td className="px-3 py-3 font-mono text-center font-bold text-gray-500 whitespace-nowrap">{totalDevices}</td>
                    <td className="px-3 py-3 font-mono text-center font-bold text-orange-400 whitespace-nowrap">{exitReadyCount}</td>
                    <td className="px-3 py-3 font-mono text-center text-red-500 font-bold whitespace-nowrap">{unrepairableCount > 0 ? unrepairableCount : '-'}</td>
                    <td className="px-3 py-3 font-mono text-center text-emerald-500 font-bold whitespace-nowrap">{intactCount > 0 ? intactCount : '-'}</td>
                    <td className="px-3 py-3 font-mono text-center text-red-400 font-bold whitespace-nowrap">{refusedCount > 0 ? refusedCount : '-'}</td>
                    <td className="px-3 py-3 font-mono text-center text-orange-500 font-bold whitespace-nowrap">{readyCount > 0 ? readyCount : '-'}</td>
                    <td className="px-6 py-3 text-center whitespace-nowrap">
                      <button 
                        onClick={(e) => { e.stopPropagation(); openInvoice(invoice); }}
                        className="bg-white/5 group-hover:bg-orange-600 text-white px-4 py-1.5 rounded-xl text-xs font-bold transition-all border border-white/5 group-hover:border-orange-500 whitespace-nowrap"
                      >
                        معاينة الفاتورة
                      </button>
                    </td>
                  </tr>
                );
              })}
              {readyInvoices.length === 0 && (
                <tr>
                   <td colSpan={9} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center justify-center opacity-50 space-y-4">
                         <div className="p-4 bg-white/5 rounded-full border border-white/10">
                           <Info size={32} />
                         </div>
                         <p className="text-sm font-bold text-gray-400">لا توجد أجهزة جاهزة حالياً</p>
                      </div>
                   </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

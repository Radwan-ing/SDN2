import React, { useState, useEffect } from 'react';
import { ArrowLeft, Printer, Share2, Smartphone, MessageCircle, Phone, Loader2, FileText, Settings2, MapPin, Facebook } from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

type PrintTemplateType = 'entry' | 'exit' | 'inspection' | 'quotation' | 'assignment' | 'maintenance';

export default function PrintPreviewOverlay({ 
  type, 
  data, 
  onClose,
  shopConfig
}: { 
  type: 'invoice' | 'voucher';
  data: any;
  onClose: () => void;
  shopConfig: any;
}) {
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [shareFile, setShareFile] = useState<{ file: File; msg: string; fileName: string; blob: Blob } | null>(null);
  const [templateType, setTemplateType] = useState<PrintTemplateType>(data.templateType || 'entry');

  const invoice = type === 'invoice' ? data.invoice : null;
  const items = type === 'invoice' ? data.items || [] : [];
  const voucher = type === 'voucher' ? data.voucher : null;

  // Auto-detect default template based on invoice status if possible
  useEffect(() => {
    if (data.templateType) {
      setTemplateType(data.templateType);
    } else if (type === 'invoice' && invoice) {
      if (invoice.status === 'delivered') setTemplateType('exit');
      else if (invoice.status === 'inspection') setTemplateType('inspection');
      else setTemplateType('entry');
    }
  }, [type, invoice, data.templateType]);

  const handlePrint = () => {
    const originalStyle = document.createElement('style');
    originalStyle.innerHTML = `
      @media print {
        body * { visibility: hidden !important; }
        #print-preview-area, #print-preview-area * { visibility: visible !important; }
        #print-preview-area {
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

  const handleWhatsApp = async () => {
    setIsGeneratingPDF(true);
    const originalGetComputedStyle = window.getComputedStyle;
    let tempEl: HTMLDivElement | null = null;
    try {
      const printArea = document.getElementById('print-preview-area');
      if (printArea) {
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

        window.getComputedStyle = customGetComputedStyle;

        // Apply background overrides for html2canvas to the printArea
        const originalStyles = new Map<HTMLElement, string>();
        const elements = printArea.querySelectorAll('*');
        elements.forEach((el) => {
          if (!(el instanceof HTMLElement)) return;
          const classes = el.className;
          if (typeof classes === 'string') {
            if (classes.includes('bg-gray-50') || classes.includes('bg-gray-50/50') || classes.includes('bg-gray-50/10') || classes.includes('bg-gray-50/20')) {
              originalStyles.set(el, el.style.backgroundColor);
              el.style.backgroundColor = '#f9fafb';
            } else if (classes.includes('bg-gray-100') || classes.includes('bg-gray-100/80') || classes.includes('bg-gray-100/50')) {
              originalStyles.set(el, el.style.backgroundColor);
              el.style.backgroundColor = '#f3f4f6';
            } else if (classes.includes('bg-gray-200') || classes.includes('bg-gray-200/60') || classes.includes('bg-gray-200/50')) {
              originalStyles.set(el, el.style.backgroundColor);
              el.style.backgroundColor = '#e5e7eb';
            } else if (classes.includes('bg-gray-300')) {
              originalStyles.set(el, el.style.backgroundColor);
              el.style.backgroundColor = '#d1d5db';
            } else if (classes.includes('bg-gray-900') || classes.includes('bg-slate-900') || classes.includes('bg-[#1c1c1c]') || classes.includes('bg-[#181818]') || classes.includes('bg-black/20')) {
              originalStyles.set(el, el.style.backgroundColor);
              el.style.backgroundColor = '#ffffff';
            } else if (classes.includes('bg-white') || classes.includes('bg-white/5') || classes.includes('bg-white/10')) {
              originalStyles.set(el, el.style.backgroundColor);
              el.style.backgroundColor = '#ffffff';
            } else if (classes.includes('bg-emerald-500/10')) {
              originalStyles.set(el, el.style.backgroundColor);
              el.style.backgroundColor = '#ecfdf5';
            } else if (classes.includes('bg-blue-500/10')) {
              originalStyles.set(el, el.style.backgroundColor);
              el.style.backgroundColor = '#eff6ff';
            } else if (classes.includes('bg-rose-500/10')) {
              originalStyles.set(el, el.style.backgroundColor);
              el.style.backgroundColor = '#fff1f2';
            } else if (classes.includes('bg-orange-500/10')) {
              originalStyles.set(el, el.style.backgroundColor);
              el.style.backgroundColor = '#fff7ed';
            }
          }
        });

        const canvas = await html2canvas(printArea, { scale: 2, useCORS: true });
        
        // Restore styles
        originalStyles.forEach((val, el) => {
          el.style.backgroundColor = val;
        });

        const imgData = canvas.toDataURL('image/jpeg', 1.0);
        
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4'
        });
      
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
        let heightLeft = pdfHeight;
        let position = 0;
      
        pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pdf.internal.pageSize.getHeight();
      
        while (heightLeft >= 0) {
          position = heightLeft - pdfHeight;
          pdf.addPage();
          pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);
          heightLeft -= pdf.internal.pageSize.getHeight();
        }
      
        const blob = pdf.output('blob');
        if (!blob) {
          setIsGeneratingPDF(false);
          return;
        }
        const fileName = type === 'invoice' ? `invoice_${invoice.invoiceNumber}.pdf` : `voucher_${voucher.reference}.pdf`;
        const file = new File([blob], fileName, { type: 'application/pdf' });
        const msg = type === 'invoice' ? `مرفق ${getTemplateName(templateType)}` : 'مرفق سند مالي';
        
        setShareFile({ file, msg, fileName, blob });
        setIsGeneratingPDF(false);
      } else {
        setIsGeneratingPDF(false);
      }
    } catch (err) {
      console.error(err);
      setIsGeneratingPDF(false);
    } finally {
      window.getComputedStyle = originalGetComputedStyle;
      if (tempEl && tempEl.parentNode) {
        tempEl.parentNode.removeChild(tempEl);
      }
    }
  };

  const executeShare = async () => {
    if (!shareFile) return;
    try {
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [shareFile.file] })) {
        await navigator.share({
          text: shareFile.msg,
          files: [shareFile.file],
          title: 'مشاركة المرفق',
        });
      } else {
         fallbackShare(shareFile.blob, shareFile.fileName, shareFile.msg);
      }
    } catch (err) {
      console.error('Share failed:', err);
      // Only fallback if the user didn't abort it
      if (err instanceof Error && err.name !== 'AbortError') {
        fallbackShare(shareFile.blob, shareFile.fileName, shareFile.msg);
      }
    }
    setShareFile(null); // Reset after sharing
  };

  const fallbackShare = (blob: Blob, fileName: string, msg: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
    setTimeout(() => {
      window.open(`https://wa.me/?text=${encodeURIComponent(msg + '\nيرجى إرفاق ملف PDF الذي تم تحميله.')}`, '_blank');
    }, 500);
  };

  const getTemplateName = (tmpl: PrintTemplateType) => {
    switch(tmpl) {
      case 'entry': return 'فاتورة دخول أجهزة';
      case 'exit': return 'فاتورة خروج وملخص مالي';
      case 'inspection': return 'تقرير فحص فني';
      case 'quotation': return 'عرض سعر صيانة';
      case 'assignment': return 'تقرير حالة وإسناد';
      case 'maintenance': return 'تقرير صيانة داخلي';
      default: return 'فاتورة صيانة';
    }
  };

  const getStatusText = (status: string) => {
    const map: any = {
      '10': 'مستلم', '20': 'قيد الفحص', '30': 'بانتظار الموافقة',
      '40': 'قيد الصيانة', '50': 'جاهز للتسليم', '55': 'لا يمكن إصلاحه',
      '60': 'تم التسليم'
    };
    return map[status] || status;
  };

  const formatDate = (dateObj: any) => {
    if (!dateObj) return '---';
    try {
      if (dateObj.toDate) return dateObj.toDate().toLocaleDateString('ar-YE');
      if (dateObj.seconds) return new Date(dateObj.seconds * 1000).toLocaleDateString('ar-YE');
      return new Date(dateObj).toLocaleDateString('ar-YE');
    } catch (e) {
      return '---';
    }
  };

  const formatTime = (dateObj: any) => {
    if (!dateObj) return '---';
    try {
      if (dateObj.toDate) return dateObj.toDate().toLocaleTimeString('ar-YE', { hour12: true, hour: '2-digit', minute: '2-digit' });
      if (dateObj.seconds) return new Date(dateObj.seconds * 1000).toLocaleTimeString('ar-YE', { hour12: true, hour: '2-digit', minute: '2-digit' });
      return new Date(dateObj).toLocaleTimeString('ar-YE', { hour12: true, hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '---';
    }
  };

  return (
    <div className="fixed inset-0 z-[120] bg-black/95 flex flex-col" dir="rtl">
      {/* Top Navbar */}
      <div className="flex justify-between items-center bg-black/50 p-4 border-b border-white/10 shrink-0 flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 border border-slate-300 rounded-xl text-slate-900 hover:bg-slate-300 font-bold transition-all flex items-center gap-2 text-sm shadow-md"
          >
            <ArrowLeft size={16} className="rtl:rotate-180" />
            العودة
          </button>
          
          {type === 'invoice' && (
            <div className="flex items-center gap-2 mr-4 bg-white/10 p-1 rounded-xl pr-3">
              <Settings2 size={16} className="text-white" />
              <span className="text-white text-sm font-bold">نموذج الطباعة:</span>
              <select 
                value={templateType}
                onChange={(e) => setTemplateType(e.target.value as PrintTemplateType)}
                className="bg-black text-white border border-white/20 rounded-lg px-3 py-1.5 text-sm font-bold focus:outline-none focus:border-emerald-500"
              >
                <option value="entry">فاتورة دخول أجهزة</option>
                <option value="exit">فاتورة خروج (ملخص مالي)</option>
                <option value="inspection">تقرير فحص فني</option>
                <option value="quotation">عرض سعر صيانة</option>
                <option value="assignment">تقرير حالة وإسناد</option>
                <option value="maintenance">تقرير صيانة داخلي</option>
              </select>
            </div>
          )}
          
          <h2 className="text-white font-bold hidden sm:block mr-4 border-r border-white/20 pr-4">
            {type === 'invoice' ? `مستند الفاتورة - #${invoice.invoiceNumber}` : `استعراض السند - #${voucher.reference}`}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={handlePrint}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-white font-bold transition-all flex items-center gap-2 text-sm"
          >
            <Printer size={16} />
            طباعة مباشرة
          </button>
          {shareFile ? (
            <button
              onClick={executeShare}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl font-bold transition-all flex items-center gap-2 text-sm shadow-[0_0_15px_rgba(16,185,129,0.3)] animate-pulse"
            >
              <Share2 size={16} />
              تأكيد المشاركة الآن
            </button>
          ) : (
            <button 
              onClick={handleWhatsApp}
              disabled={isGeneratingPDF}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition-all flex items-center gap-2 text-sm shadow-[0_0_15px_rgba(5,150,105,0.3)] disabled:opacity-50"
            >
              {isGeneratingPDF ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Share2 size={16} />
              )}
              {isGeneratingPDF ? 'جاري التجهيز...' : 'تجهيز للمشاركة'}
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-black p-4 md:p-8 pb-24 text-right w-full">
        <div id="print-preview-area" className="p-8 bg-white text-gray-900 print:p-0 print:bg-white print:text-black w-[794px] mx-auto flex flex-col relative shrink-0 font-cairo shadow-2xl min-h-[1123px]" dir="rtl">
          
          {/* Universal Header Layout */}
          <div className="flex justify-between items-start border-b-2 border-gray-900 pb-4 mb-4">
            {/* Right Corner: Shop Name */}
            <div className="text-right flex-1 pt-1">
              <h2 className="text-xl font-black text-gray-900 tracking-tight leading-tight font-cairo cursor-default">{shopConfig?.shopName || 'عالم الصيانة والتجارة'}</h2>
              <div className="text-sm font-black text-gray-900 tracking-tight leading-tight mt-1.5 font-cairo cursor-default">
                {type === 'invoice' ? 'قسم الصيانة الفنية' : 'قسم الحسابات والمالية'}
              </div>
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
                <img 
                  src={shopConfig.logoUrl} 
                  alt="Logo" 
                  className="h-16 max-w-[150px] object-contain mb-1.5" 
                  referrerPolicy="no-referrer"
                  crossOrigin="anonymous"
                />
              ) : (
                <div className="w-12 h-12 border border-dashed border-gray-300 rounded-xl mb-1.5 flex items-center justify-center text-gray-400 text-[10px] font-bold">شعار المحل</div>
              )}
              <h1 className="text-lg font-black text-gray-900 tracking-tight border-2 border-gray-900 px-4 py-1.5 rounded-lg inline-block bg-gray-50/50">
                {type === 'invoice' ? getTemplateName(templateType) : (voucher.type === 'receipt' ? 'سند قبض' : 'سند صرف')}
              </h1>
            </div>

            {/* Left Corner: Info */}
            <div className="text-left flex-1 space-y-1 pt-1 bg-gray-50/50 p-3 rounded-lg border border-gray-200">
              <div className="text-sm font-bold text-gray-700 flex justify-between gap-4">
                <span>{type === 'invoice' ? (templateType === 'quotation' ? 'رقم العرض:' : 'رقم المستند:') : 'رقم المرجع:'}</span>
                <span className="font-mono text-gray-900">{type === 'invoice' ? invoice.invoiceNumber : voucher.reference}</span>
              </div>
              <div className="text-sm font-bold text-gray-700 flex justify-between gap-4">
                <span>التاريخ:</span>
                <span className="font-mono text-gray-900">
                  {type === 'invoice' 
                    ? formatDate(invoice.createdAt)
                    : formatDate(voucher.date)}
                </span>
              </div>
              <div className="text-sm font-bold text-gray-700 flex justify-between gap-4 border-t border-gray-200 pt-1 mt-1">
                <span>وقت الإصدار:</span>
                <span className="font-mono text-gray-900" dir="ltr">
                  {type === 'invoice' 
                    ? formatTime(invoice.createdAt)
                    : formatTime(voucher.date)}
                </span>
              </div>
            </div>
          </div>

          {/* Customer Info Box */}
          <div className="bg-gray-100 p-3 rounded-lg mb-4 border border-gray-300 flex justify-between items-center px-6">
            <div className="text-sm font-black text-gray-900">
              <span className="text-xs text-gray-600 ml-2">{type === 'voucher' ? 'الاسم:' : 'العميل:'}</span>
              {type === 'invoice' ? invoice.customerName : voucher.customerName}
            </div>
            {type === 'invoice' && invoice.customerPhone && (
              <div className="text-sm font-black text-gray-900 border-r border-gray-300 pr-6">
                <span className="text-xs text-gray-600 ml-2">الجوال:</span>
                <span className="font-mono" dir="ltr">{invoice.customerPhone}</span>
              </div>
            )}
          </div>

          {/* Dynamic Bodies based on Type & Template */}
          <div className="flex-1">
            {type === 'voucher' && (
              <div className="mt-8 border-2 border-gray-900 rounded-lg overflow-hidden">
                 <div className="flex border-b-2 border-gray-900">
                    <div className="w-1/4 bg-gray-100 p-4 font-black text-gray-700 border-l-2 border-gray-900 text-center flex items-center justify-center">نوع السند</div>
                    <div className="w-3/4 p-4 font-black text-xl text-center bg-white">{voucher.type === 'receipt' ? 'سند قبض مالي' : 'سند صرف فني'}</div>
                 </div>
                 <div className="flex border-b-2 border-gray-900">
                    <div className="w-1/4 bg-gray-100 p-4 font-black text-gray-700 border-l-2 border-gray-900 text-center flex items-center justify-center">المبلغ</div>
                    <div className="w-3/4 p-4 font-mono font-black text-2xl text-center bg-white">
                      {Number(voucher.amount).toLocaleString()} <span className="text-base font-sans mr-1">{voucher.currency || 'USD'}</span>
                    </div>
                 </div>
                 <div className="flex border-b-2 border-gray-900">
                    <div className="w-1/4 bg-gray-100 p-4 font-black text-gray-700 border-l-2 border-gray-900 text-center flex items-center justify-center text-sm">البيان والتفاصيل</div>
                    <div className="w-3/4 p-4 font-bold text-base leading-relaxed bg-white">
                      {voucher.details || 'لا توجد تفاصيل.'}
                    </div>
                 </div>
                 <div className="flex">
                    <div className="w-1/4 bg-gray-100 p-4 font-black text-gray-700 border-l-2 border-gray-900 text-center flex items-center justify-center text-sm">التصنيف المحاسبي</div>
                    <div className="w-3/4 p-4 font-bold text-sm bg-white">
                      {voucher.category || 'عام'}
                    </div>
                 </div>
                 {voucher.notes && (
                   <div className="flex border-t-2 border-gray-900">
                      <div className="w-1/4 bg-gray-100 p-4 font-black text-gray-700 border-l-2 border-gray-900 text-center flex items-center justify-center text-sm">ملاحظات</div>
                      <div className="w-3/4 p-4 font-bold text-sm text-gray-600 bg-white leading-relaxed">
                        {voucher.notes}
                      </div>
                   </div>
                 )}
              </div>
            )}

            {type === 'invoice' && templateType === 'entry' && (
              <>
                <table className="w-full text-center border-2 border-black mb-6">
                  <thead className="bg-gray-100 text-black border-b-2 border-black">
                    <tr>
                      <th className="py-2 px-3 border border-black text-sm font-bold w-12 text-center">م</th>
                      <th className="py-2 px-3 border border-black text-sm font-bold text-right w-48">النوع / الجهاز</th>
                      <th className="py-2 px-3 border border-black text-sm font-bold text-right w-1/3">المشكلة (من وجهة نظر العميل)</th>
                      <th className="py-2 px-3 border border-black text-sm font-bold text-right w-1/4">ملاحظات الاستلام</th>
                      <th className="py-2 px-3 border border-black text-sm font-bold w-16">العدد</th>
                    </tr>
                  </thead>
                  <tbody className="text-black font-bold">
                    {items.map((it:any, idx:number) => (
                      <tr key={idx} className="border-b border-black">
                        <td className="py-3 px-3 border-l border-black text-xs font-mono">{idx + 1}</td>
                        <td className="py-3 px-3 border-l border-black text-right whitespace-nowrap text-sm">
                          {it.deviceType || '-'} - <span className="text-gray-600 text-[10px]">{it.deviceName || '-'}</span>
                        </td>
                        <td className="py-3 px-3 border-l border-black text-xs text-right whitespace-nowrap overflow-hidden max-w-[150px] text-ellipsis">{it.faultType || it.customerProblem || '-'}</td>
                        <td className="py-3 px-3 border-l border-black text-xs text-right whitespace-nowrap overflow-hidden max-w-[150px] text-ellipsis">{it.deviceNotes || '-'}</td>
                        <td className="py-3 px-3 text-sm font-bold font-mono">{it.quantity || 1}</td>
                      </tr>
                    ))}
                    <tr className="bg-gray-100 border-t-2 border-black">
                      <td colSpan={4} className="py-3 px-4 border-l border-black text-left font-black text-sm">اجمالي الأجهزة المستلمة</td>
                      <td className="py-3 px-3 text-lg font-black text-center font-mono">{items.reduce((sum:number, it:any) => sum + (Number(it.quantity) || 1), 0)}</td>
                    </tr>
                  </tbody>
                </table>
                <div className="text-[10px] text-gray-500 font-bold mb-6 text-center">
                  سيتم موافاتكم بتقرير الفحص الفني والتكاليف المبدئية في أقرب وقت.
                </div>
              </>
            )}

            {type === 'invoice' && templateType === 'exit' && (
              <>
                <table className="w-full text-center border-2 border-black mb-6">
                  <thead className="bg-gray-100 text-black border-b-2 border-black">
                    <tr>
                      <th className="py-2 px-3 border border-black text-sm font-bold w-12 text-center">م</th>
                      <th className="py-2 px-3 border border-black text-sm font-bold text-right w-48">النوع / الموديل</th>
                      <th className="py-2 px-3 border border-black text-sm font-bold text-center">تكلفة الإصلاح</th>
                      <th className="py-2 px-3 border border-black text-sm font-bold text-center">حالة الجهاز</th>
                      <th className="py-2 px-3 border border-black text-sm font-bold text-center">الضمان</th>
                      <th className="py-2 px-3 border border-black text-sm font-bold text-right">ملاحظات</th>
                    </tr>
                  </thead>
                  <tbody className="text-black font-bold">
                    {items.map((it:any, idx:number) => (
                      <tr key={idx} className="border-b border-black">
                        <td className="py-3 px-3 border-l border-black text-xs font-mono">{idx + 1}</td>
                        <td className="py-3 px-3 border-l border-black text-right whitespace-nowrap text-sm">
                          {it.deviceType} - {it.deviceName}
                        </td>
                        <td className="py-3 px-3 border-l border-black text-center font-mono text-sm group">
                          {Number(it.cost || 0).toLocaleString()}
                        </td>
                        <td className="py-3 px-3 border-l border-black text-xs text-center text-emerald-700 font-bold">
                          {getStatusText(it.status || '50')}
                        </td>
                        <td className="py-3 px-3 border-l border-black text-xs text-center">
                          {it.warrantyId ? 'مشمول' : 'لا يوجد'}
                        </td>
                        <td className="py-3 px-3 text-xs text-right text-gray-600 max-w-[150px] truncate">{it.technicalNotes || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                {/* Financial Summary Box */}
                <div className="flex border-2 border-black rounded-lg overflow-hidden bg-gray-50 mb-6 font-mono font-black w-2/3 mr-auto">
                    <div className="flex-1 p-3 text-center border-l-2 border-black bg-white">
                      <div className="text-[10px] text-gray-500 font-sans mb-1">الإجمالي المستحق</div>
                      <div className="text-lg text-gray-900">{Number(invoice.totalCost || 0).toLocaleString()} <span className="text-xs font-sans">ر.ي</span></div>
                    </div>
                    <div className="flex-1 p-3 text-center border-l-2 border-black bg-emerald-50 text-emerald-700">
                      <div className="text-[10px] opacity-70 font-sans mb-1">المدفوع</div>
                      <div className="text-lg">{Number(invoice.amountPaid || 0).toLocaleString()} <span className="text-xs font-sans">ر.ي</span></div>
                    </div>
                    <div className="flex-1 p-3 text-center bg-rose-50 text-rose-700">
                      <div className="text-[10px] opacity-70 font-sans mb-1">المتبقي</div>
                      <div className="text-lg">{(Number(invoice.totalCost || 0) - Number(invoice.amountPaid || 0)).toLocaleString()} <span className="text-xs font-sans">ر.ي</span></div>
                    </div>
                 </div>
              </>
            )}

            {type === 'invoice' && templateType === 'inspection' && (
              <table className="w-full text-center border-2 border-black mb-6">
                <thead className="bg-gray-100 text-black border-b-2 border-black">
                  <tr>
                    <th className="py-2 px-2 border border-black text-sm font-bold w-10 text-center">م</th>
                    <th className="py-2 px-2 border border-black text-sm font-bold text-right w-40">الجهاز</th>
                    <th className="py-2 px-2 border border-black text-sm font-bold text-right w-1/4">المشكلة</th>
                    <th className="py-2 px-2 border border-black text-sm font-bold text-right w-1/4">التقرير الفني</th>
                    <th className="py-2 px-2 border border-black text-sm font-bold text-center">القرار</th>
                    <th className="py-2 px-2 border border-black text-sm font-bold text-center w-24">التكلفة المتوقعة</th>
                  </tr>
                </thead>
                <tbody className="text-black font-bold">
                  {items.map((it:any, idx:number) => (
                    <tr key={idx} className="border-b border-black">
                      <td className="py-3 px-2 border-l border-black text-[10px] font-mono">{idx + 1}</td>
                      <td className="py-3 px-2 border-l border-black text-right whitespace-nowrap text-xs">
                        {it.deviceType} <span className="text-gray-500 text-[10px]">- {it.deviceName}</span>
                      </td>
                      <td className="py-3 px-2 border-l border-black text-[11px] text-right whitespace-nowrap overflow-hidden max-w-[150px] text-ellipsis">{it.faultType || it.customerProblem || '-'}</td>
                      <td className="py-3 px-2 border-l border-black text-[11px] text-right text-emerald-800 whitespace-nowrap overflow-hidden max-w-[150px] text-ellipsis">{it.technicalNotes || '-'}</td>
                      <td className="py-3 px-2 border-l border-black text-xs text-center text-blue-700">
                         {['40','50'].includes(it.status) ? 'موافق' : 'بانتظار الرد'}
                      </td>
                      <td className="py-3 px-2 text-center font-mono text-sm">
                        {Number(it.cost || 0).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-gray-100 border-t-2 border-black">
                    <td colSpan={5} className="py-3 px-4 border-l border-black text-left font-black text-sm">إجمالي التكلفة المتوقعة لعملية الصيانة</td>
                    <td className="py-3 px-2 text-base font-black text-center font-mono">{items.reduce((sum:number, it:any) => sum + Number(it.cost || 0), 0).toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>
            )}

            {type === 'invoice' && templateType === 'quotation' && (
              <>
                <table className="w-full text-right border-collapse text-sm mb-6 border-2 border-black">
                  <thead className="bg-gray-100 text-gray-900 font-black border-b-2 border-black">
                    <tr>
                      <th className="px-3 py-3 text-center border-l-2 border-black w-12 text-xs">م</th>
                      <th className="px-3 py-3 border-l-2 border-black text-xs">البيان ומواصفات الإصلاح</th>
                      <th className="px-3 py-3 text-center border-l-2 border-black text-xs">الكمية</th>
                      <th className="px-3 py-3 text-center border-l-2 border-black text-xs">سعر الوحدة</th>
                      <th className="px-3 py-3 text-center font-bold text-xs">الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-300 font-bold align-top">
                    {items.map((it:any, idx:number) => {
                      const qty = Number(it.quantity || 1);
                      const tCost = Number(it.cost || 0);
                      const unit = qty > 0 ? tCost / qty : 0;
                      return (
                        <tr key={idx} className="border-b border-black">
                          <td className="px-3 py-4 text-center font-mono border-l-2 border-black">{idx+1}</td>
                          <td className="px-3 py-4 border-l-2 border-black text-sm whitespace-nowrap overflow-hidden max-w-[200px] text-ellipsis">
                            {it.deviceType || '-'} - {it.deviceName || '-'}
                            {it.technicalNotes && <span className="text-gray-600 text-[10px] mr-2">- {it.technicalNotes}</span>}
                          </td>
                          <td className="px-3 py-4 text-center font-mono border-l-2 border-black">{qty}</td>
                          <td className="px-3 py-4 text-center font-mono border-l-2 border-black">{unit.toLocaleString()}</td>
                          <td className="px-3 py-4 text-center font-mono text-gray-900">{tCost.toLocaleString()}</td>
                        </tr>
                      );
                    })}
                    <tr className="bg-gray-100 font-bold border-t-2 border-black">
                      <td colSpan={4} className="px-3 py-4 text-left font-black border-l-2 border-black text-base">إجمالي العرض (المبلغ المستحق)</td>
                      <td className="px-3 py-4 text-center font-mono font-black text-xl text-gray-900">
                        {Number(invoice.totalCost || 0).toLocaleString()} <span className="text-xs font-sans mr-1">{invoice.currency || 'USD'}</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
                <div className="text-xs text-gray-600 font-bold mb-6 italic">
                  * هذا العرض صالح لمدة 14 يوماً من تاريخ إصداره وتظل الأسعار قابلة للتغير بناءً على توفر قطع الغيار.
                </div>
              </>
            )}

            {type === 'invoice' && templateType === 'assignment' && (
              <table className="w-full text-center border-2 border-black mb-6">
                <thead className="bg-gray-100 text-black border-b-2 border-black">
                  <tr>
                    <th className="py-2 px-2 border border-black text-sm font-bold w-10">م</th>
                    <th className="py-2 px-2 border border-black text-sm font-bold text-right">الجهاز</th>
                    <th className="py-2 px-2 border border-black text-sm font-bold text-right">المشكلة / العطل</th>
                    <th className="py-2 px-2 border border-black text-sm font-bold text-center">المهندس المسند إليه</th>
                    <th className="py-2 px-2 border border-black text-sm font-bold text-center w-24">ملاحظات</th>
                  </tr>
                </thead>
                <tbody className="text-black font-bold">
                  {items.map((it:any, idx:number) => (
                    <tr key={idx} className="border-b border-black">
                      <td className="py-3 px-2 border-l border-black text-xs font-mono">{idx + 1}</td>
                      <td className="py-3 px-2 border-l border-black text-right whitespace-nowrap text-sm">
                        {it.deviceType} <span className="text-gray-500 text-xs">- {it.deviceName}</span>
                      </td>
                      <td className="py-3 px-2 border-l border-black text-xs text-right whitespace-nowrap overflow-hidden max-w-[150px] text-ellipsis">{it.faultType || it.customerProblem || '-'}</td>
                      <td className="py-3 px-2 border-l border-black text-sm text-center text-blue-700">
                        {it.technician || '-'}
                      </td>
                      <td className="py-3 px-2 text-center text-[10px] text-gray-600 truncate max-w-[150px]">
                        {it.deviceNotes || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {type === 'invoice' && templateType === 'maintenance' && (
              <table className="w-full text-center border-2 border-black mb-6">
                <thead className="bg-gray-100 text-black border-b-2 border-black">
                  <tr>
                    <th className="py-2 px-2 border border-black text-sm font-bold w-10">م</th>
                    <th className="py-2 px-2 border border-black text-sm font-bold text-right">الجهاز</th>
                    <th className="py-2 px-2 border border-black text-sm font-bold text-right w-1/4">الشكوى</th>
                    <th className="py-2 px-2 border border-black text-sm font-bold text-right w-1/4">تقرير الإصلاح الفني</th>
                    <th className="py-2 px-2 border border-black text-sm font-bold text-center">النتيجة</th>
                    <th className="py-2 px-2 border border-black text-sm font-bold text-center">قطع غيار</th>
                  </tr>
                </thead>
                <tbody className="text-black font-bold">
                  {items.map((it:any, idx:number) => (
                    <tr key={idx} className="border-b border-black">
                      <td className="py-3 px-2 border-l border-black text-xs font-mono">{idx + 1}</td>
                      <td className="py-3 px-2 border-l border-black text-right whitespace-nowrap text-xs">
                        {it.deviceType} - {it.deviceName}
                      </td>
                      <td className="py-3 px-2 border-l border-black text-[11px] text-right whitespace-nowrap overflow-hidden max-w-[120px] text-ellipsis">{it.faultType || it.customerProblem || '-'}</td>
                      <td className="py-3 px-2 border-l border-black text-[11px] text-right whitespace-nowrap overflow-hidden max-w-[120px] text-ellipsis">{it.technicalNotes || '-'}</td>
                      <td className={`py-3 px-2 border-l border-black text-xs text-center font-black ${['50','60'].includes(it.status) ? 'text-emerald-600' : 'text-orange-600'}`}>
                        {getStatusText(it.status)}
                      </td>
                      <td className="py-3 px-2 text-center text-[11px] text-gray-700">
                        {it.partsUsed ? it.partsUsed.length + ' قطع' : 'لا يوجد'}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-gray-100 border-t-2 border-black">
                    <td colSpan={6} className="py-3 px-4 font-black text-sm text-center tracking-widest text-gray-700">
                      تم استكمال صيانة الأجهزة بناءً على التشخيص الفني الموضح أعلاه.
                      <div className="flex justify-center gap-6 mt-3 text-sm font-bold text-gray-900 border-t border-gray-300 pt-3">
                        <div className="flex items-center gap-2">
                          <span>إجمالي الأجهزة:</span>
                          <span className="font-mono text-lg">{items.length}</span>
                        </div>
                        <div className="flex items-center gap-2 text-emerald-700">
                          <span>جاهز:</span>
                          <span className="font-mono text-lg">{items.filter((i:any) => ['50','60'].includes(i.status)).length}</span>
                        </div>
                        <div className="flex items-center gap-2 text-rose-700">
                          <span>لا يصلح:</span>
                          <span className="font-mono text-lg">{items.filter((i:any) => i.status === '55').length}</span>
                        </div>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>

          {/* Footer Section */}
          <div className="mt-auto shrink-0 pt-8">
            <div className="border-t border-black/20 my-2"></div>
            
            <div className="flex justify-between items-start text-xs font-bold text-gray-900 leading-loose mb-2 px-4">
              {type === 'voucher' ? (
                <>
                  <div className="text-right space-y-1">
                      <p>الموظف المختص</p>
                      <p className="pt-2 font-black">التوقيع / ........................................</p>
                  </div>
                  <div className="text-left space-y-1">
                      <p className="pt-4">المستلم المقر بما فيه /.............. التوقيع /.............</p>
                  </div>
                </>
              ) : (
                <>
                   {/* Right Side */}
                   <div className="text-right space-y-1">
                     {templateType === 'entry' && <p>يرجى الاحتفاظ بهذا السند وإحضاره لاستلام الاجهزة</p>}
                     {templateType === 'exit' && <p>نأمل منكم الاحتفاظ بالفاتورة كضمان لحقوقكم</p>}
                     {templateType === 'quotation' && <p>توقيع مقدم العرض والمختص الفني</p>}
                     {(templateType === 'inspection' || templateType === 'maintenance' || templateType === 'assignment') && <p>المسؤول المباشر / المشرف</p>}
                     
                     {['entry','exit'].includes(templateType) && <p>المحل غير مسؤول عن الأجهزة بعد مرور 30 يوم</p>}
                     
                     <p className="pt-2 font-black">التوقيع / ........................................</p>
                   </div>

                   {/* Left Side */}
                   <div className="text-left space-y-1 flex flex-col items-end">
                     {templateType === 'entry' && <p>سوف يتم موافاتكم بتكاليف الصيانة بعد الفحص</p>}
                     {['exit', 'inspection', 'quotation'].includes(templateType) && <p>توقيع العميل / المقر بالموافقة</p>}
                     {(templateType === 'maintenance' || templateType === 'assignment') && <p>تصدير واعتماد الإدارة الفنية</p>}
                     
                     <p className="pt-4">الاسم /..................... التوقيع /.....................</p>
                   </div>
                </>
              )}
            </div>

            <div className="border-t-[3px] border-black mt-3 mb-1 border-solid"></div>
            
            {/* Address and Facebook */}
            <div className="flex flex-row items-center justify-between text-[10px] font-bold text-black font-cairo py-1 mt-0">
              {shopConfig?.address && (
                <div className="flex items-center gap-1.5 justify-center flex-row-reverse text-center w-max">
                   <MapPin size={12} className="text-gray-600" />
                   <span className="text-gray-900">{shopConfig.address}</span>
                </div>
              )}
              
              <div className="text-gray-500 font-mono text-center flex-1">
                 طبع في: {new Date().toLocaleDateString('ar-YE')} {new Date().toLocaleTimeString('ar-YE', { hour12: true, hour: '2-digit', minute: '2-digit' })}
              </div>

              {shopConfig?.facebookUrl && (
                <div className="flex items-center gap-1.5 justify-center flex-row-reverse text-center w-max">
                  <Facebook size={12} className="text-blue-600" />
                  <span dir="ltr" className="text-gray-900">{shopConfig.facebookUrl}</span>
                </div>
              )}
            </div>
            
          </div>

        </div>
      </div>
    </div>
  );
}

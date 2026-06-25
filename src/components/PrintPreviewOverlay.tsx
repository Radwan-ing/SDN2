import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Printer, Share2, Smartphone, MessageCircle, Phone, Loader2, FileText, Settings2, MapPin, Facebook } from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { sharePdfFile } from '../lib/shareHelper';
import { sanitizeDocumentStyles, sanitizeElementInlineStyles, cleanOklchInStyleText, restoreDocumentStyles } from '../lib/html2canvasHelper';

type PrintTemplateType = 'entry' | 'exit' | 'inspection' | 'quotation' | 'assignment' | 'maintenance';

export default function PrintPreviewOverlay({ 
  type, 
  data, 
  onClose,
  shopConfig
}: { 
  type: 'invoice' | 'voucher' | 'statement';
  data: any;
  onClose: () => void;
  shopConfig: any;
}) {
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [shareFile, setShareFile] = useState<{ file: File; msg: string; fileName: string; blob: Blob } | null>(null);
  const [templateType, setTemplateType] = useState<PrintTemplateType>(data?.templateType || 'entry');
  const [scale, setScale] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const printAreaRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(1123);

  useEffect(() => {
    if (printAreaRef.current) {
      const resizeObserver = new ResizeObserver((entries) => {
        for (let entry of entries) {
          setContentHeight(entry.contentRect.height);
        }
      });
      resizeObserver.observe(printAreaRef.current);
      return () => resizeObserver.disconnect();
    }
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.clientWidth - 32;
        if (containerWidth < 794) {
          setScale(containerWidth / 794);
        } else {
          setScale(1);
        }
      }
    };
    handleResize();
    const timer = setTimeout(handleResize, 150);
    window.addEventListener('resize', handleResize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const invoice = type === 'invoice' ? data.invoice : null;
  const items = type === 'invoice' ? data.items || [] : [];
  const voucher = type === 'voucher' ? data.voucher : null;
  const statement = type === 'statement' ? data.statement : null;

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
        @page { size: auto; margin: 0; }
        body * { visibility: hidden !important; }
        .scale-wrapper { height: auto !important; margin: 0 !important; transform: none !important; }
        #print-preview-area, #print-preview-area * { visibility: visible !important; }
        #print-preview-area {
          position: absolute;
          left: 0;
          top: 0;
          width: 100% !important;
          margin: 0 !important;
          padding: 10mm !important;
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
    let restoreStyles: (() => void) | null = null;
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

        // Sanitize document styles and element inline styles first, capturing restore function
        restoreStyles = await sanitizeDocumentStyles();
        sanitizeElementInlineStyles(printArea);

        const canvas = await html2canvas(printArea, { 
          scale: 2, 
          useCORS: true,
          onclone: (clonedDoc) => {
            const styles = clonedDoc.querySelectorAll('style');
            styles.forEach((style) => {
              if (style.textContent && (style.textContent.includes('oklch') || style.textContent.includes('oklab'))) {
                style.textContent = cleanOklchInStyleText(style.textContent);
              }
            });
            const clonedPrintArea = clonedDoc.getElementById('print-preview-area');
            if (clonedPrintArea instanceof HTMLElement) {
              sanitizeElementInlineStyles(clonedPrintArea);
            }
          }
        });
        
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
      
        while (heightLeft > 0.5) {
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
        const fileName = type === 'invoice' 
          ? `invoice_${invoice.invoiceNumber}.pdf` 
          : (type === 'statement' 
              ? `كشف_حساب_${statement?.customerName || 'عميل'}.pdf` 
              : `voucher_${voucher.reference}.pdf`);
        const file = new File([blob], fileName, { type: 'application/pdf' });
        const msg = type === 'invoice' 
          ? `مرفق ${getTemplateName(templateType)}` 
          : (type === 'statement' 
              ? `مرفق كشف حساب مالي للعميل: ${statement?.customerName}` 
              : 'مرفق سند مالي');
        
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
      if (restoreStyles) {
        restoreStyles();
      } else {
        restoreDocumentStyles();
      }
      if (tempEl && tempEl.parentNode) {
        tempEl.parentNode.removeChild(tempEl);
      }
    }
  };

  const executeShare = async () => {
    if (!shareFile) return;
    try {
      const success = await sharePdfFile(shareFile.blob, shareFile.fileName, shareFile.msg);
      if (!success) {
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
            {type === 'invoice' ? `مستند الفاتورة - #${invoice.invoiceNumber}` : (type === 'statement' ? `كشف حساب - ${statement?.customerName}` : `استعراض السند - #${voucher.reference}`)}
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

      <div 
        ref={containerRef} 
        className="flex-1 overflow-y-auto bg-black p-4 md:p-8 pb-24 text-right w-full flex flex-col items-center justify-start overflow-x-hidden"
      >
        <div 
          className="relative origin-top transition-transform duration-150 shrink-0 scale-wrapper"
          style={{ 
            width: '794px', 
            height: `${contentHeight * scale}px`, 
            transform: `scale(${scale})`,
            marginBottom: scale < 1 ? `${(scale - 1) * contentHeight}px` : '0px'
          }}
        >
          <div ref={printAreaRef} id="print-preview-area" className="p-8 bg-white text-gray-900 print:p-0 print:bg-white print:text-black w-[794px] mx-auto flex flex-col relative shrink-0 font-cairo shadow-2xl min-h-fit" dir="rtl">
            {/* Faint print date and time watermark */}
            <div className="absolute left-8 top-3 text-[8px] text-gray-400 font-normal select-none opacity-45 font-mono pointer-events-none" dir="rtl">
              تاريخ ووقت الطباعة: {new Date().toLocaleDateString('ar-YE')} {new Date().toLocaleTimeString('ar-YE', { hour12: true, hour: '2-digit', minute: '2-digit' })}
            </div>
          
          {/* Universal Header Layout */}
          <div className="flex justify-between items-start border-b-2 border-gray-900 pb-4 mb-4">
            {/* Right Corner: Shop Name */}
            <div className="text-right flex-1 pt-1">
              <h2 className="text-xl font-black text-gray-900 tracking-tight leading-tight font-cairo whitespace-nowrap cursor-default">{shopConfig?.shopName || 'عالم الصيانة والتجارة'}</h2>
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
              <h1 className="text-sm md:text-base font-black text-gray-900 tracking-tight border-2 border-gray-900 px-6 h-10 inline-flex items-center justify-center rounded-lg bg-gray-50/50 leading-none whitespace-nowrap">
                {type === 'invoice' ? getTemplateName(templateType) : (type === 'statement' ? 'كشف حساب مالي' : (voucher.type === 'receipt' ? 'سند قبض مالي' : 'سند صرف مالي'))}
              </h1>
            </div>

            {/* Left Corner: Info */}
            <div className="text-left flex-1 space-y-1 pt-1 bg-gray-50/50 p-3 rounded-lg border border-gray-200">
              <div className="text-sm font-bold text-gray-700 flex justify-between gap-4">
                <span>{type === 'invoice' ? (templateType === 'quotation' ? 'رقم العرض:' : 'رقم المستند:') : (type === 'statement' ? 'رقم الحساب:' : 'رقم المرجع:')}</span>
                <span className="font-mono text-gray-900">
                  {type === 'invoice' 
                    ? invoice.invoiceNumber 
                    : (type === 'statement' 
                        ? (statement?.customerNumber || statement?.id?.substring(0, 5)) 
                        : voucher.reference)}
                </span>
              </div>
              <div className="text-sm font-bold text-gray-700 flex justify-between gap-4">
                <span>التاريخ:</span>
                <span className="font-mono text-gray-900">
                  {type === 'invoice' 
                    ? formatDate(invoice.createdAt)
                    : (type === 'statement'
                        ? formatDate(statement?.date)
                        : formatDate(voucher.date))}
                </span>
              </div>
              <div className="text-sm font-bold text-gray-700 flex justify-between gap-4 border-t border-gray-200 pt-1 mt-1">
                <span>وقت الإصدار:</span>
                <span className="font-mono text-gray-900" dir="ltr">
                  {type === 'invoice' 
                    ? formatTime(invoice.createdAt)
                    : (type === 'statement'
                        ? formatTime(statement?.date)
                        : formatTime(voucher.date))}
                </span>
              </div>
            </div>
          </div>

          {/* Customer Info Box */}
          <div className="bg-gray-100 p-3 rounded-lg mb-4 border border-gray-300 flex justify-between items-center px-6">
            <div className="text-sm font-black text-gray-900">
              <span className="text-xs text-gray-600 ml-2">إسم العميل:</span>
              {type === 'invoice' 
                ? invoice.customerName 
                : (type === 'statement' 
                    ? statement?.customerName 
                    : voucher.customerName)}
            </div>
            {type === 'statement' && statement?.companyName && (
              <div className="text-sm font-black text-gray-900 border-r border-gray-300 pr-6">
                <span className="text-xs text-gray-600 ml-2">الجهة:</span>
                <span>{statement?.companyName}</span>
              </div>
            )}
            {(type === 'invoice' && invoice.customerPhone) && (
              <div className="text-sm font-black text-gray-900 border-r border-gray-300 pr-6">
                <span className="text-xs text-gray-600 ml-2">الجوال:</span>
                <span className="font-mono" dir="ltr">{invoice.customerPhone}</span>
              </div>
            )}
            {(type === 'statement' && statement?.customerPhone) && (
              <div className="text-sm font-black text-gray-900 border-r border-gray-300 pr-6">
                <span className="text-xs text-gray-600 ml-2">الجوال:</span>
                <span className="font-mono" dir="ltr">{statement?.customerPhone}</span>
              </div>
            )}
          </div>

          {/* Dynamic Bodies based on Type & Template */}
          <div className="flex-1">
            {type === 'voucher' && (
              <div className="mt-8 border-2 border-gray-900 rounded-lg overflow-hidden">
                 <div className="flex border-b-2 border-gray-900">
                    <div className="w-1/4 bg-gray-100 p-4 font-black text-gray-700 border-l-2 border-gray-900 text-center flex items-center justify-center">نوع السند</div>
                    <div className="w-3/4 p-4 font-black text-xl text-center bg-white">{voucher.type === 'receipt' ? 'سند قبض مالي' : 'سند صرف مالي'}</div>
                 </div>
                 <div className="flex border-b-2 border-gray-900">
                    <div className="w-1/4 bg-gray-100 p-4 font-black text-gray-700 border-l-2 border-gray-900 text-center flex items-center justify-center">المبلغ</div>
                    <div className="w-3/4 p-4 font-mono font-black text-2xl text-center bg-white">
                      {Number(voucher.amount).toLocaleString('en-US')} <span className="text-base font-sans mr-1">{voucher.currency || 'USD'}</span>
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

            {type === 'statement' && (
              <div className="space-y-4">
                {/* Distinctive Net Balance Box */}
                <div className="border border-gray-400 p-4 rounded-xl text-center font-cairo bg-white">
                  <div className="text-[11px] font-black text-gray-500 uppercase tracking-wider mb-0.5">صافي الحساب المالي الجاري</div>
                  <div className="text-2xl font-black font-mono text-gray-950 tracking-tight my-1">
                    {Math.abs(statement?.balance || 0).toLocaleString('en-US')} <span className="text-sm font-cairo font-bold">{statement?.currency}</span>
                  </div>
                  <div className="text-xs font-black text-gray-900">
                    حالة الحساب: {statement?.balanceStatus}
                  </div>
                </div>

                {/* operations table */}
                <div className="space-y-2">
                  <span className="text-xs font-black text-gray-800 font-cairo block">العمليات والتحركات المالية (القيود مرتبة بتسلسل تاريخي):</span>
                  <div className="border border-gray-400 rounded-xl overflow-hidden bg-white text-xs">
                    <div className="w-full text-right select-none border border-gray-400 rounded-xl overflow-hidden">
                      {/* Header Row */}
                      <div className="bg-white border-b-2 border-gray-400 text-gray-950 font-cairo font-black flex items-stretch text-xs">
                        <div className="py-2.5 px-3 text-center w-12 border-l border-gray-400 flex items-center justify-center shrink-0">مـ</div>
                        <div className="py-2.5 px-3 border-l border-gray-400 text-right flex-1 flex items-center justify-start">نوع الحركة</div>
                        <div className="py-2.5 px-3 text-center border-l border-gray-400 w-24 flex items-center justify-center shrink-0" dir="ltr">رقم المرجع</div>
                        <div className="py-2.5 px-3 text-center border-l border-gray-400 w-36 flex items-center justify-center shrink-0" dir="ltr">تاريخ ووقت القيد</div>
                        <div className="py-2.5 px-4 border-l border-gray-400 text-right w-48 flex items-center justify-start shrink-0">البيان والتفاصيل</div>
                        <div className="py-2.5 px-4 text-rose-800 text-center border-l border-gray-400 bg-rose-50/10 w-28 flex items-center justify-center shrink-0">المستحق (مدين)</div>
                        <div className="py-2.5 px-4 text-emerald-800 text-center border-l border-gray-400 bg-emerald-50/10 w-28 flex items-center justify-center shrink-0">المقبوض (دائن)</div>
                        <div className="py-2.5 px-4 text-center font-black bg-gray-50 w-32 flex items-center justify-center shrink-0">الرصيد الجاري</div>
                      </div>
                      {/* Body List */}
                      <div className="divide-y divide-gray-400 font-bold">
                        {(statement?.entries || []).length === 0 ? (
                          <div className="py-8 text-center text-gray-500 font-cairo font-bold bg-white w-full">
                            لا يوجد أي قيود أو عمليات محاسبية مسجلة لهذا العميل حتى الآن.
                          </div>
                        ) : (
                          statement.entries.map((entry: any, index: number) => (
                            <div key={entry.id || index} className="hover:bg-gray-50 transition-all text-gray-950 bg-white flex items-stretch text-[11px]">
                              <div className="py-2.5 px-3 font-mono text-center text-gray-600 border-l border-gray-400 bg-gray-50/50 w-12 flex items-center justify-center shrink-0">
                                {index + 1}
                              </div>
                              <div className="py-2.5 px-3 font-cairo font-bold text-gray-900 border-l border-gray-400 text-right flex-1 flex items-center justify-start">
                                {entry.type}
                              </div>
                              <div className="py-2.5 px-3 font-mono font-bold text-gray-800 text-center border-l border-gray-400 w-24 flex items-center justify-center shrink-0" dir="ltr">
                                {entry.reference}
                              </div>
                              <div className="py-2.5 px-3 font-mono text-[11px] text-gray-700 text-center border-l border-gray-400 w-36 flex items-center justify-center shrink-0" dir="ltr">
                                {entry.formattedDate}
                              </div>
                              <div className="py-2.5 px-4 font-cairo text-gray-900 w-48 border-l border-gray-400 leading-relaxed text-right flex flex-col justify-center shrink-0 overflow-hidden">
                                <div className="font-bold truncate w-full">{entry.label}</div>
                                {entry.notes && <div className="text-[10px] text-gray-600 truncate mt-0.5 w-full">{entry.notes}</div>}
                              </div>
                              <div className="py-2.5 px-4 font-mono font-black text-rose-800 text-center border-l border-gray-400 bg-rose-50/5 w-28 flex items-center justify-center shrink-0" dir="ltr">
                                {entry.debit > 0 ? entry.debit.toLocaleString('en-US') : '---'}
                              </div>
                              <div className="py-2.5 px-4 font-mono font-black text-emerald-800 text-center border-l border-gray-400 bg-emerald-50/5 w-28 flex items-center justify-center shrink-0" dir="ltr">
                                {entry.credit > 0 ? entry.credit.toLocaleString('en-US') : '---'}
                              </div>
                              <div className={`py-2.5 px-4 font-mono font-black text-center w-32 flex items-center justify-center shrink-0 ${entry.runningBalance > 0.01 ? 'text-rose-800' : entry.runningBalance < -0.01 ? 'text-emerald-800' : 'text-gray-600'}`} dir="ltr">
                                {entry.runningBalance.toLocaleString('en-US')} {statement?.currency}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {type === 'invoice' && templateType === 'entry' && (
              <>
                <div className="w-full text-center border-2 border-black mb-6 text-black font-bold">
                  {/* Header Row */}
                  <div className="bg-gray-100 border-b-2 border-black flex items-stretch text-sm font-bold">
                    <div className="py-2 px-3 border-l border-black w-12 flex items-center justify-center shrink-0">م</div>
                    <div className="py-2 px-3 border-l border-black w-48 flex items-center justify-start shrink-0">النوع / الجهاز</div>
                    <div className="py-2 px-3 border-l border-black flex-1 flex items-center justify-start">المشكلة (من وجهة نظر العميل)</div>
                    <div className="py-2 px-3 border-l border-black w-1/4 flex items-center justify-start shrink-0">ملاحظات الاستلام</div>
                    <div className="py-2 px-3 w-16 flex items-center justify-center shrink-0">العدد</div>
                  </div>
                  {/* Body List */}
                  <div className="divide-y divide-black">
                    {items.map((it:any, idx:number) => (
                      <div key={idx} className="flex items-stretch min-h-[40px]">
                        <div className="py-3 px-3 border-l border-black text-xs font-mono w-12 flex items-center justify-center shrink-0">{idx + 1}</div>
                        <div className="py-3 px-3 border-l border-black text-right w-48 flex items-center justify-start shrink-0" dir="ltr">
                          <span className="break-words w-full text-right" dir="rtl">
                            {it.deviceType || '-'} - <span className="text-gray-500 text-[10px]">{it.deviceName || '-'}</span>
                          </span>
                        </div>
                        <div className="py-3 px-3 border-l border-black text-xs text-right flex-1 flex items-center justify-start">
                          <span className="break-words w-full">{it.faultType || it.customerProblem || '-'}</span>
                        </div>
                        <div className="py-3 px-3 border-l border-black text-xs text-right w-1/4 flex items-center justify-start shrink-0">
                          <span className="break-words w-full">{it.deviceNotes || '-'}</span>
                        </div>
                        <div className="py-3 px-3 text-sm font-bold font-mono w-16 flex items-center justify-center shrink-0">{it.quantity || 1}</div>
                      </div>
                    ))}
                    {/* Total Row */}
                    <div className="bg-gray-100 border-t-2 border-black flex items-stretch min-h-[40px]">
                      <div className="py-3 px-4 border-l border-black text-left font-black text-sm flex-1 flex items-center justify-start">اجمالي الأجهزة المستلمة</div>
                      <div className="py-3 px-3 text-lg font-black text-center font-mono w-16 flex items-center justify-center shrink-0">{items.reduce((sum:number, it:any) => sum + (Number(it.quantity) || 1), 0)}</div>
                    </div>
                  </div>
                </div>
                <div className="text-[10px] text-gray-500 font-bold mb-6 text-center">
                  سيتم موافاتكم بتقرير الفحص الفني والتكاليف المبدئية في أقرب وقت.
                </div>
              </>
            )}

            {type === 'invoice' && templateType === 'exit' && (
              <>
                <div className="w-full text-center border-2 border-black mb-6 text-black font-bold">
                  {/* Header Row */}
                  <div className="bg-gray-100 border-b-2 border-black flex items-stretch text-sm font-bold">
                    <div className="py-2 px-3 border-l border-black w-12 flex items-center justify-center shrink-0">م</div>
                    <div className="py-2 px-3 border-l border-black w-48 flex items-center justify-start shrink-0">النوع / الموديل</div>
                    <div className="py-2 px-3 border-l border-black w-28 flex items-center justify-center shrink-0">تكلفة الإصلاح</div>
                    <div className="py-2 px-3 border-l border-black w-24 flex items-center justify-center shrink-0">حالة الجهاز</div>
                    <div className="py-2 px-3 border-l border-black w-20 flex items-center justify-center shrink-0">الضمان</div>
                    <div className="py-2 px-3 flex-1 flex items-center justify-start">ملاحظات</div>
                  </div>
                  {/* Body List */}
                  <div className="divide-y divide-black">
                    {items.map((it:any, idx:number) => (
                      <div key={idx} className="flex items-stretch min-h-[40px]">
                        <div className="py-3 px-3 border-l border-black text-xs font-mono w-12 flex items-center justify-center shrink-0">{idx + 1}</div>
                        <div className="py-3 px-3 border-l border-black text-sm text-right w-48 flex items-center justify-start shrink-0" dir="ltr">
                          <span className="break-words w-full text-right" dir="rtl">{it.deviceType} - {it.deviceName}</span>
                        </div>
                        <div className="py-3 px-3 border-l border-black text-center font-mono text-sm w-28 flex items-center justify-center shrink-0" dir="ltr">
                          {Number(it.cost || 0).toLocaleString('en-US')}
                        </div>
                        <div className="py-3 px-3 border-l border-black text-xs text-center text-emerald-700 font-bold w-24 flex items-center justify-center shrink-0">
                          {getStatusText(it.status || '50')}
                        </div>
                        <div className="py-3 px-3 border-l border-black text-xs text-center w-20 flex items-center justify-center shrink-0">
                          {it.warrantyId ? 'مشمول' : 'لا يوجد'}
                        </div>
                        <div className="py-3 px-3 text-xs text-right text-gray-600 flex-1 flex items-center justify-start">
                          <span className="break-words w-full">{it.technicalNotes || '-'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Financial Summary Box */}
                <div className="flex border-2 border-black rounded-lg overflow-hidden bg-gray-50 mb-6 font-cairo w-2/3 mr-auto">
                  <div className="flex-1 p-3 text-center border-l-2 border-black bg-white">
                    <div className="text-[10px] text-gray-500 font-bold mb-1">الإجمالي المستحق</div>
                    <div className="text-base font-black text-gray-900"><span className="font-mono text-lg">{Number(invoice.totalCost || 0).toLocaleString('en-US')}</span> <span className="text-xs font-bold">ر.ي</span></div>
                  </div>
                  <div className="flex-1 p-3 text-center border-l-2 border-black bg-emerald-50 text-emerald-700">
                    <div className="text-[10px] opacity-75 font-bold mb-1">المدفوع</div>
                    <div className="text-base font-black"><span className="font-mono text-lg">{Number(invoice.amountPaid || 0).toLocaleString('en-US')}</span> <span className="text-xs font-bold">ر.ي</span></div>
                  </div>
                  <div className="flex-1 p-3 text-center bg-rose-50 text-rose-700">
                    <div className="text-[10px] opacity-75 font-bold mb-1">المتبقي</div>
                    <div className="text-base font-black"><span className="font-mono text-lg">{(Number(invoice.totalCost || 0) - Number(invoice.amountPaid || 0)).toLocaleString('en-US')}</span> <span className="text-xs font-bold">ر.ي</span></div>
                  </div>
                </div>
              </>
            )}

            {type === 'invoice' && templateType === 'inspection' && (
              <div className="w-full text-center border-2 border-black mb-6 text-black font-bold">
                {/* Header Row */}
                <div className="bg-gray-100 border-b-2 border-black flex items-stretch text-sm font-bold">
                  <div className="py-2 px-2 border-l border-black w-10 flex items-center justify-center shrink-0">م</div>
                  <div className="py-2 px-2 border-l border-black w-40 flex items-center justify-start shrink-0">الجهاز</div>
                  <div className="py-2 px-2 border-l border-black w-1/4 flex items-center justify-start shrink-0">المشكلة</div>
                  <div className="py-2 px-2 border-l border-black flex-1 flex items-center justify-start">التقرير الفني</div>
                  <div className="py-2 px-2 border-l border-black w-24 flex items-center justify-center shrink-0">القرار</div>
                  <div className="py-2 px-2 w-28 flex items-center justify-center shrink-0">التكلفة المتوقعة</div>
                </div>
                {/* Body List */}
                <div className="divide-y divide-black">
                  {items.map((it:any, idx:number) => (
                    <div key={idx} className="flex items-stretch min-h-[40px]">
                      <div className="py-3 px-2 border-l border-black text-[10px] font-mono w-10 flex items-center justify-center shrink-0">{idx + 1}</div>
                      <div className="py-3 px-2 border-l border-black text-right text-xs w-40 flex items-center justify-start shrink-0" dir="ltr">
                        <span className="break-words w-full text-right" dir="rtl">{it.deviceType} <span className="text-gray-500 text-[10px]">- {it.deviceName}</span></span>
                      </div>
                      <div className="py-3 px-2 border-l border-black text-[11px] text-right w-1/4 flex items-center justify-start shrink-0">
                        <span className="break-words w-full">{it.faultType || it.customerProblem || '-'}</span>
                      </div>
                      <div className="py-3 px-2 border-l border-black text-[11px] text-right text-emerald-800 flex-1 flex items-center justify-start">
                        <span className="break-words w-full">{it.technicalNotes || '-'}</span>
                      </div>
                      <div className="py-3 px-2 border-l border-black text-xs text-center text-blue-700 w-24 flex items-center justify-center shrink-0">
                         {['40','50'].includes(it.status) ? 'موافق' : 'بانتظار الرد'}
                      </div>
                      <div className="py-3 px-2 text-center font-mono text-sm w-28 flex items-center justify-center shrink-0" dir="ltr">
                        {Number(it.cost || 0).toLocaleString('en-US')}
                      </div>
                    </div>
                  ))}
                  {/* Total Row */}
                  <div className="bg-gray-100 border-t-2 border-black flex items-stretch min-h-[40px]">
                    <div className="py-3 px-4 border-l border-black text-left font-black text-sm flex-1 flex items-center justify-start">إجمالي التكلفة المتوقعة لعملية الصيانة</div>
                    <div className="py-3 px-2 text-base font-black text-center font-mono w-28 flex items-center justify-center shrink-0" dir="ltr">{items.reduce((sum:number, it:any) => sum + Number(it.cost || 0), 0).toLocaleString('en-US')}</div>
                  </div>
                </div>
              </div>
            )}

            {type === 'invoice' && templateType === 'quotation' && (
              <>
                <div className="w-full text-right text-sm mb-6 border-2 border-black text-gray-900 font-bold">
                  {/* Header Row */}
                  <div className="bg-gray-100 border-b-2 border-black font-black flex items-stretch text-xs">
                    <div className="px-3 py-3 text-center border-l-2 border-black w-12 flex items-center justify-center shrink-0">م</div>
                    <div className="px-3 py-3 border-l-2 border-black flex-1 flex items-center justify-start">البيان ومواصفات الإصلاح</div>
                    <div className="px-3 py-3 text-center border-l-2 border-black w-20 flex items-center justify-center shrink-0">الكمية</div>
                    <div className="px-3 py-3 text-center border-l-2 border-black w-28 flex items-center justify-center shrink-0">سعر الوحدة</div>
                    <div className="px-3 py-3 text-center font-bold w-28 flex items-center justify-center shrink-0">الإجمالي</div>
                  </div>
                  {/* Body List */}
                  <div className="divide-y divide-black">
                    {items.map((it:any, idx:number) => {
                      const qty = Number(it.quantity || 1);
                      const tCost = Number(it.cost || 0);
                      const unit = qty > 0 ? tCost / qty : 0;
                      return (
                        <div key={idx} className="flex items-stretch min-h-[44px]">
                          <div className="px-3 py-4 text-center font-mono border-l-2 border-black w-12 flex items-center justify-center shrink-0">{idx+1}</div>
                          <div className="px-3 py-4 border-l-2 border-black text-sm flex-1 flex items-center justify-start" dir="ltr">
                            <span className="break-words w-full text-right" dir="rtl">
                              {it.deviceType || '-'} - <span className="text-gray-500 text-xs">{it.deviceName || '-'}</span>
                              {it.technicalNotes && <span className="text-gray-600 text-[10px] mr-2 block mt-1">- {it.technicalNotes}</span>}
                            </span>
                          </div>
                          <div className="px-3 py-4 text-center font-mono border-l-2 border-black w-20 flex items-center justify-center shrink-0" dir="ltr">{qty}</div>
                          <div className="px-3 py-4 text-center font-mono border-l-2 border-black w-28 flex items-center justify-center shrink-0" dir="ltr">{unit.toLocaleString('en-US')}</div>
                          <div className="px-3 py-4 text-center font-mono text-gray-900 w-28 flex items-center justify-center shrink-0" dir="ltr">{tCost.toLocaleString('en-US')}</div>
                        </div>
                      );
                    })}
                    {/* Total Row */}
                    <div className="bg-gray-100 font-bold border-t-2 border-black flex items-stretch min-h-[44px]">
                      <div className="px-3 py-4 text-left font-black border-l-2 border-black text-base flex-1 flex items-center justify-start">إجمالي العرض (المبلغ المستحق)</div>
                      <div className="px-3 py-4 text-center font-mono font-black text-xl text-gray-900 w-28 flex items-center justify-center shrink-0" dir="ltr">
                        {Number(invoice.totalCost || 0).toLocaleString('en-US')} <span className="text-xs font-sans mr-1" dir="rtl">{invoice.currency || 'USD'}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="text-xs text-gray-600 font-bold mb-6 italic">
                  * هذا العرض صالح لمدة 14 يوماً من تاريخ إصدارها وتظل الأسعار قابلة للتغير بناءً على توفر قطع الغيار.
                </div>
              </>
            )}

            {type === 'invoice' && templateType === 'assignment' && (
              <div className="w-full text-center border-2 border-black mb-6 text-black font-bold">
                {/* Header Row */}
                <div className="bg-gray-100 border-b-2 border-black flex items-stretch text-sm font-bold">
                  <div className="py-2 px-2 border-l border-black w-10 flex items-center justify-center shrink-0">م</div>
                  <div className="py-2 px-2 border-l border-black w-48 flex items-center justify-start shrink-0">الجهاز</div>
                  <div className="py-2 px-2 border-l border-black flex-1 flex items-center justify-start">المشكلة / العطل</div>
                  <div className="py-2 px-2 border-l border-black w-40 flex items-center justify-center shrink-0">المهندس المسند إليه</div>
                  <div className="py-2 px-2 w-32 flex items-center justify-center shrink-0">ملاحظات</div>
                </div>
                {/* Body List */}
                <div className="divide-y divide-black">
                  {items.map((it:any, idx:number) => (
                    <div key={idx} className="flex items-stretch min-h-[40px]">
                      <div className="py-3 px-2 border-l border-black text-xs font-mono w-10 flex items-center justify-center shrink-0">{idx + 1}</div>
                      <div className="py-3 px-2 border-l border-black text-right text-sm w-48 flex items-center justify-start shrink-0" dir="ltr">
                        <span className="break-words w-full text-right" dir="rtl">{it.deviceType} <span className="text-gray-500 text-xs">- {it.deviceName}</span></span>
                      </div>
                      <div className="py-3 px-2 border-l border-black text-xs text-right flex-1 flex items-center justify-start">
                        <span className="break-words w-full">{it.faultType || it.customerProblem || '-'}</span>
                      </div>
                      <div className="py-3 px-2 border-l border-black text-sm text-center text-blue-700 w-40 flex items-center justify-center shrink-0">
                        <span className="break-words w-full">{it.technician || '-'}</span>
                      </div>
                      <div className="py-3 px-2 text-center text-[10px] text-gray-600 w-32 flex items-center justify-center shrink-0">
                        <span className="break-words w-full">{it.deviceNotes || '-'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {type === 'invoice' && templateType === 'maintenance' && (
              <div className="w-full text-center border-2 border-black mb-6 text-black font-bold">
                {/* Header Row */}
                <div className="bg-gray-100 border-b-2 border-black flex items-stretch text-sm font-bold">
                  <div className="py-2 px-2 border-l border-black w-10 flex items-center justify-center shrink-0">م</div>
                  <div className="py-2 px-2 border-l border-black w-40 flex items-center justify-start shrink-0">الجهاز</div>
                  <div className="py-2 px-2 border-l border-black w-1/4 flex items-center justify-start shrink-0">الشكوى</div>
                  <div className="py-2 px-2 border-l border-black flex-1 flex items-center justify-start">تقرير الإصلاح الفني</div>
                  <div className="py-2 px-2 border-l border-black w-24 flex items-center justify-center shrink-0">النتيجة</div>
                  <div className="py-2 px-2 w-24 flex items-center justify-center shrink-0">قطع غيار</div>
                </div>
                {/* Body List */}
                <div className="divide-y divide-black">
                  {items.map((it:any, idx:number) => (
                    <div key={idx} className="flex items-stretch min-h-[40px]">
                      <div className="py-3 px-2 border-l border-black text-xs font-mono w-10 flex items-center justify-center shrink-0">{idx + 1}</div>
                      <div className="py-3 px-2 border-l border-black text-right text-xs w-40 flex items-center justify-start shrink-0" dir="ltr">
                        <span className="break-words w-full text-right" dir="rtl">{it.deviceType} - {it.deviceName}</span>
                      </div>
                      <div className="py-3 px-2 border-l border-black text-[11px] text-right w-1/4 flex items-center justify-start shrink-0">
                        <span className="break-words w-full">{it.faultType || it.customerProblem || '-'}</span>
                      </div>
                      <div className="py-3 px-2 border-l border-black text-[11px] text-right flex-1 flex items-center justify-start">
                        <span className="break-words w-full">{it.technicalNotes || '-'}</span>
                      </div>
                      <div className={`py-3 px-2 border-l border-black text-xs text-center font-black w-24 flex items-center justify-center shrink-0 ${['50','60'].includes(it.status) ? 'text-emerald-600' : 'text-orange-600'}`}>
                        {getStatusText(it.status)}
                      </div>
                      <div className="py-3 px-2 text-center text-[11px] text-gray-700 w-24 flex items-center justify-center shrink-0">
                        <span className="break-words w-full">{it.partsUsed ? it.partsUsed.length + ' قطع' : 'لا يوجد'}</span>
                      </div>
                    </div>
                  ))}
                  {/* Total summary info */}
                  <div className="bg-gray-100 border-t-2 border-black p-4 font-black text-sm text-center tracking-widest text-gray-700 w-full">
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
                  </div>
                </div>
              </div>
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
              ) : type === 'statement' ? (
                <>
                  <div className="text-right space-y-1">
                    <div>اسم مستلم الكشف: ........................................</div>
                    <div className="pt-2">التوقيع والختم: ........................................</div>
                  </div>
                  <div className="text-left space-y-1 col-span-1">
                    <div>اسم المختص المعتمد: ........................................</div>
                    <div className="pt-2">التوقيع والختم: ........................................</div>
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
              
              <div className="flex-1"></div>

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
    </div>
  );
}

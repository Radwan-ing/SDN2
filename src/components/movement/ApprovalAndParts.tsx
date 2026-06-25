import { sharePdfFile } from '../../lib/shareHelper';
import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, writeBatch, serverTimestamp, getDoc } from '../../firebase';
import { db } from '../../firebase';
import { Invoice, InvoiceItem, User, Customer } from '../../types';
import { useTranslation } from 'react-i18next';
import { Search, Loader2, X, Clock, Check, RefreshCw, ArrowUpRight, Save, Plus, Printer, Share2, FileText, Phone, Smartphone, Building, ArrowLeft, MessageCircle, MapPin, Facebook, Edit2, Trash2 } from 'lucide-react';
import BankAccountsFooter from '../BankAccountsFooter';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { sanitizeDocumentStyles, sanitizeElementInlineStyles, cleanOklchInStyleText } from '../../lib/html2canvasHelper';

const WhatsAppIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" {...props}>
    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.513 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.501-5.734-1.451L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.42 9.864-9.858.002-2.634-1.018-5.11-2.871-6.968C16.592 1.96 14.118.94 11.482.94c-5.438 0-9.863 4.42-9.866 9.861-.001 1.761.468 3.481 1.357 5.02L1.97 21.03l5.311-1.392c.312.163.626.326.96.48zm11.365-7.6c-.302-.151-1.78-.879-2.057-.98-.277-.101-.48-.151-.68.151-.2.3-.777.979-.952 1.18-.176.201-.351.226-.654.076-.302-.151-1.277-.47-2.434-1.502-.9-.803-1.507-1.795-1.683-2.096-.176-.301-.019-.464.132-.614.136-.135.302-.35.453-.526.151-.176.201-.301.302-.503.101-.201.05-.377-.025-.527-.076-.151-.68-1.637-.932-2.247-.246-.59-.497-.51-.68-.52-.176-.01-.377-.01-.579-.01-.201 0-.528.075-.804.377-.277.301-1.057 1.031-1.057 2.515 0 1.485 1.082 2.918 1.232 3.119.15.2 2.13 3.25 5.16 4.561.721.311 1.284.498 1.72.639.724.23 1.382.197 1.902.12.58-.088 1.78-.728 2.031-.1.431.25.1.48.1.68.01.2.148z"/>
  </svg>
);

export default function ApprovalAndParts({ user, onBack, initialInvoice }: { user: User, onBack: () => void, initialInvoice?: Invoice | null }) {
  const { t } = useTranslation();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [engineersList, setEngineersList] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  
  // Outer double tabs state: 'approval' (انتظار الموافقة من العميل) vs 'parts' (انتظار قطع الغيار)
  const [subTab, setSubTab] = useState<'approval' | 'parts'>('approval');

  // Selection for detailed form (صفحة إجراء انتظار الموافقة والقطع)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);
  const [engineerName, setEngineerName] = useState('');
  const [actionItems, setActionItems] = useState<{ id: string, count: number, outcome: 'approved' | 'waiting_parts' | 'refused', reason: string }[]>([]);
  const [currentFormRow, setCurrentFormRow] = useState<{ id: string, count: number | '', outcome: 'approved' | 'waiting_parts' | 'refused', reason: string }>({ id: '', count: 1, outcome: 'approved', reason: 'تمت الموافقة' });
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  
  // List-page state for cumulative row choices: record of invoiceId -> 'approved' or 'refused' or null
  const [decisions, setDecisions] = useState<Record<string, 'approved' | 'refused' | null>>({});
  const [rowLoading, setRowLoading] = useState<Record<string, boolean>>({});
  const [loadingForm, setLoadingForm] = useState(false);

  // Print-Report states and helpers
  const [showPreviewReport, setShowPreviewReport] = useState(false);
  const [activePrintReportInvoice, setActivePrintReportInvoice] = useState<Invoice | null>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [shopConfig, setShopConfig] = useState<any>(null);
  const [currentOutput, setCurrentOutput] = useState<any>(null);

  // Fetch shop config
  useEffect(() => {
    getDoc(doc(db, 'settings', 'shop')).then((snap) => {
      if (snap.exists()) {
        setShopConfig(snap.data());
      }
    }).catch(err => {
      console.warn("Could not fetch shop settings:", err);
    });
  }, []);

  const getCustomerPhone = (customerId: string) => {
    const c = customers.find(c => c.id === customerId);
    return c ? (c.phone1 || '---') : '---';
  };

  const getCustomerCompany = (customerId: string) => {
    const c = customers.find(c => c.id === customerId);
    return c ? (c.companyName || '---') : '---';
  };

  const handlePrintDirect = () => {
    const originalStyle = document.createElement('style');
    originalStyle.innerHTML = `
      @media print {
        @page { size: auto; margin: 0; }
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

  const handleExportPDFAndWhatsApp = async (invoice: Invoice) => {
    const getConditionRank = (item: any) => {
      const report = (item.engineerReport || '').toLowerCase();
      const subStatus = (item.subStatus || '').toLowerCase();
      if (subStatus === 'intact' || report.includes('سليم') || report.includes('intact')) return 1;
      if (subStatus === 'unrepairable' || report.includes('لا يصلح') || report.includes('لايصلح') || report.includes('unrepairable')) return 2;
      return 0; // Maintenance
    };
    const invoiceSpecItems = items
      .filter(it => it.invoiceNumber === invoice.invoiceNumber)
      .sort((a, b) => {
        const typeA = a.deviceType || '';
        const typeB = b.deviceType || '';
        const typeCompare = typeA.localeCompare(typeB, 'ar');
        if (typeCompare !== 0) return typeCompare;

        const nameA = a.deviceName || '';
        const nameB = b.deviceName || '';
        const nameCompare = nameA.localeCompare(nameB, 'ar');
        if (nameCompare !== 0) return nameCompare;

        return getConditionRank(a) - getConditionRank(b);
      });
    const totalInvoiceCost = invoiceSpecItems.reduce((sum, item) => sum + (Number(item.unitCost || item.cost || 0) * (item.quantity || 1)), 0);
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

      await sanitizeDocumentStyles();
      sanitizeElementInlineStyles(element);

      let clonedAreaHeight = 800; // fallback

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        onclone: (clonedDoc) => {
          const styles = clonedDoc.querySelectorAll('style');
          styles.forEach((style) => {
            if (style.textContent && (style.textContent.includes('oklch') || style.textContent.includes('oklab'))) {
              style.textContent = cleanOklchInStyleText(style.textContent);
            }
          });

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

      const formattedDate = new Date().toISOString().split('T')[0];
      const filename = `عرض سعر أجهزة_${invoice.customerName}_${formattedDate}.pdf`;

      pdf.save(filename);

      // WhatsApp text composition
      let message = `*عرض سعر صيانة أجهزة فني* 📄\n\n`;
      message += `عزيزي العميل *${invoice.customerName}* المحترم،\n`;
      message += `تجد أدناه ملخص تقرير الفحص وعرض الأسعار صيانة أجهزتكم في الفاتورة رقم *${invoice.invoiceNumber}*:\n\n`;
      message += `- *رقم التقرير:* ${invoice.invoiceNumber}\n`;
      message += `- *القيمة الإجمالية المقدرة:* ${totalInvoiceCost.toLocaleString('en-US')} ${currency}\n\n`;
      message += `*جدول الأجهزة المسجلة بالفحص:*\n`;
      invoiceSpecItems.forEach((item, index) => {
        message += `\n_${index + 1}. *${item.deviceType} - ${item.deviceName || ''}*_\n`;
        message += `   • تقرير المعاينة: ${item.engineerReport || item.faultType || 'قيد المعاينة والفحص'}\n`;
        message += `   • التكلفة: ${(item.cost || item.unitCost || 0).toLocaleString('en-US')} ${currency}\n`;
      });
      message += `\nيسعدنا مراجعتكم وبانتظار الموافقة لبدء الصيانة فورًا. شكرًا لتعاملكم الراقي معنا!`;

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

  useEffect(() => {
    if (initialInvoice && items.length > 0 && !selectedInvoice) {
      const APPROVAL_STATUSES = ['30', 'awaiting_approval'];
      const PARTS_STATUSES = ['35', 'awaiting_parts'];
      const isParts = initialInvoice.status === '35' || items.some(item => item.invoiceNumber === initialInvoice.invoiceNumber && item.status === '35');
      
      if (isParts) {
        setSubTab('parts');
        const invoiceSpecItems = items.filter(i => i.invoiceNumber === initialInvoice.invoiceNumber && PARTS_STATUSES.includes(i.status));
        setInvoiceItems(invoiceSpecItems);
        const existingTech = invoiceSpecItems.find(i => i.technician)?.technician || '';
        setEngineerName(existingTech);
        if (invoiceSpecItems.length > 0) {
          setActionItems([{ id: invoiceSpecItems[0].id!, count: 1, outcome: 'approved', reason: '' }]);
        }
        setSelectedInvoice(initialInvoice);
      } else {
        setSubTab('approval');
        const invoiceSpecItems = items.filter(i => i.invoiceNumber === initialInvoice.invoiceNumber && APPROVAL_STATUSES.includes(i.status));
        setInvoiceItems(invoiceSpecItems);
        const existingTech = invoiceSpecItems.find(i => i.technician)?.technician || '';
        setEngineerName(existingTech);
        if (invoiceSpecItems.length > 0) {
          setActionItems([{ id: invoiceSpecItems[0].id!, count: 1, outcome: 'approved', reason: '' }]);
        }
        setSelectedInvoice(initialInvoice);
      }
    }
  }, [initialInvoice, items, selectedInvoice]);

  useEffect(() => {
    const unsubInvoices = onSnapshot(collection(db, 'invoices'), (s) => setInvoices(s.docs.map(d => ({ id: d.id, ...d.data() } as Invoice))));
    const unsubItems = onSnapshot(collection(db, 'invoice_items'), (s) => setItems(s.docs.map(d => ({ id: d.id, ...d.data() } as InvoiceItem))));
    const unsubCustomers = onSnapshot(collection(db, 'customers'), (s) => setCustomers(s.docs.map(d => ({ id: d.id, ...d.data() } as Customer))));
    const unsubEngineers = onSnapshot(collection(db, 'engineers'), (s) => setEngineersList(s.docs.map(d => d.data().name).filter(Boolean)));
    return () => { unsubInvoices(); unsubItems(); unsubCustomers(); unsubEngineers(); };
  }, []);

  const getCustomerNumber = (customerId: string) => {
    const c = customers.find(c => c.id === customerId);
    return c ? c.customerNumber : '---';
  };

  // Separate current active statuses based on the sub-tab selected
  const APPROVAL_STATUSES = ['30', 'awaiting_approval'];
  const PARTS_STATUSES = ['35', 'awaiting_parts'];
  const activeStatuses = subTab === 'approval' ? APPROVAL_STATUSES : PARTS_STATUSES;

  const pendingInvoices = invoices.filter(inv => {
    return items.some(item => item.invoiceNumber === inv.invoiceNumber && activeStatuses.includes(item.status) && item.quantity > 0);
  }).filter(inv => {
    const customer = customers.find(c => c.id === inv.customerId);
    const customerName = (inv.customerName || '').toLowerCase();
    const customerPhone = customer ? (customer.phone1 || customer.phone2 || '') : '';
    const searchTerm = search.toLowerCase();
    
    return customerName.includes(searchTerm) || 
           customerPhone.includes(search) || // search term can be part of phone as well, search is just a string
           inv.invoiceNumber.includes(search);
  }).sort((a, b) => Number(b.invoiceNumber) - Number(a.invoiceNumber));

  const totalAwaitingDevices = items.filter(i => activeStatuses.includes(i.status)).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);

  const countEligibleDevices = (invoiceNumber: string) => {
    return items.filter(i => i.invoiceNumber === invoiceNumber && activeStatuses.includes(i.status) && i.quantity > 0).reduce((sum, i) => sum + (Number(i.quantity) || 0), 0);
  };

  // Handles toggling a decision on the list page
  const handleToggleDecision = (invoiceId: string, choice: 'approved' | 'refused') => {
    setDecisions(prev => {
      const current = prev[invoiceId];
      return {
        ...prev,
        [invoiceId]: current === choice ? null : choice
      };
    });
  };

  // Click on the action button on the list row (Approval SubTab)
  const handleProcessActionBtn = async (invoice: Invoice) => {
    const listDecision = decisions[invoice.id || ''];
    if (listDecision) {
      // Direct fast action path (either approved or fused completely)
      setRowLoading(prev => ({ ...prev, [invoice.id || '']: true }));
      try {
        const batch = writeBatch(db);
        const invoiceItemsToUpdate = items.filter(i => i.invoiceNumber === invoice.invoiceNumber && APPROVAL_STATUSES.includes(i.status));
        
        invoiceItemsToUpdate.forEach(item => {
          const itemRef = doc(db, 'invoice_items', item.id!);
          if (listDecision === 'approved') {
            // Move device fully to maintenance status '40'
            batch.update(itemRef, {
              status: '40',
              subStatus: 'repairing',
              source: 'approval_approved_bulk',
              updatedAt: serverTimestamp()
            });
          } else if (listDecision === 'refused') {
            // Move device directly to exit status '50'
            batch.update(itemRef, {
              status: '50',
              subStatus: 'refused',
              failureReason: 'لم يوافق العميل',
              source: 'approval_refused_bulk',
              updatedAt: serverTimestamp()
            });
          }
        });

        // Calculate final statuses of all items in this invoice for bulk updates
        let finalBulkInvoiceStatus = '50';
        const finalStatuses: string[] = [];
        items.filter(it => it.invoiceNumber === invoice.invoiceNumber).forEach(it => {
          if (APPROVAL_STATUSES.includes(it.status)) {
            finalStatuses.push(listDecision === 'approved' ? '40' : '50');
          } else {
            finalStatuses.push(it.status);
          }
        });
        
        if (finalStatuses.some(s => s === '70' || s === 'cancelled')) finalBulkInvoiceStatus = '70';
        else if (finalStatuses.some(s => s === '10' || s === 'new')) finalBulkInvoiceStatus = '10';
        else if (finalStatuses.some(s => s === '20')) finalBulkInvoiceStatus = '20';
        else if (finalStatuses.some(s => s === '30' || s === '35' || s === 'awaiting_approval' || s === 'awaiting_parts')) finalBulkInvoiceStatus = '30';
        else if (finalStatuses.some(s => s === '40' || s === 'repairing')) finalBulkInvoiceStatus = '40';

        batch.update(doc(db, 'invoices', invoice.id!), {
          status: finalBulkInvoiceStatus,
          updatedAt: serverTimestamp()
        });

        // Register the activity
        const actionRef = doc(collection(db, 'approval_actions'));
        batch.set(actionRef, {
          invoiceNumber: invoice.invoiceNumber,
          customerName: invoice.customerName,
          decision: listDecision,
          date: new Date().getTime(),
          userId: user.id || 'unknown',
          userName: user.name || 'System',
          createdAt: serverTimestamp()
        });

        await batch.commit();

        setDecisions(prev => {
          const copy = { ...prev };
          delete copy[invoice.id || ''];
          return copy;
        });
      } catch (err) {
        console.error("Error committing bulk approval decision:", err);
      } finally {
        setRowLoading(prev => ({ ...prev, [invoice.id || '']: false }));
      }
    } else {
      // The Third Way: Open detailed cloning page because no option is chosen
      setSelectedInvoice(invoice);
      const invoiceSpecItems = items.filter(i => i.invoiceNumber === invoice.invoiceNumber && APPROVAL_STATUSES.includes(i.status));
      setInvoiceItems(invoiceSpecItems);
      // Try to pre-fill the name of first items technician if any
      const existingTech = invoiceSpecItems.find(i => i.technician)?.technician || '';
      setEngineerName(existingTech);

      // Initialize actionItems as an empty table and prefill the form
      setActionItems([]);
      setEditingIndex(null);
      if (invoiceSpecItems.length > 0) {
        setCurrentFormRow({ id: invoiceSpecItems[0].id!, count: invoiceSpecItems[0].quantity, outcome: 'approved', reason: 'تمت الموافقة' });
      }
    }
  };

  // Click on the action button on the list row (Parts SubTab)
  const handleProcessPartsAction = async (invoice: Invoice) => {
    const listDecision = decisions[invoice.id || ''];
    if (!listDecision) {
      // Detailed action form for Parts tab
      setSelectedInvoice(invoice);
      const invoiceSpecItems = items.filter(i => i.invoiceNumber === invoice.invoiceNumber && PARTS_STATUSES.includes(i.status));
      setInvoiceItems(invoiceSpecItems);
      // Try to pre-fill the name of first items technician if any
      const existingTech = invoiceSpecItems.find(i => i.technician)?.technician || '';
      setEngineerName(existingTech);

      // Initialize actionItems as an empty table and prefill the form
      setActionItems([]);
      setEditingIndex(null);
      if (invoiceSpecItems.length > 0) {
        setCurrentFormRow({ id: invoiceSpecItems[0].id!, count: invoiceSpecItems[0].quantity, outcome: 'approved', reason: 'توفرت قطع الغيار' });
      }
      return;
    }

    setRowLoading(prev => ({ ...prev, [invoice.id || '']: true }));
    try {
      const batch = writeBatch(db);
      const invoiceItemsToUpdate = items.filter(
        i => i.invoiceNumber === invoice.invoiceNumber && PARTS_STATUSES.includes(i.status)
      );

      invoiceItemsToUpdate.forEach(item => {
        const itemRef = doc(db, 'invoice_items', item.id!);
        if (listDecision === 'approved') {
          // Parts arrived -> Move to maintenance status '40', subStatus 'repairing'
          batch.update(itemRef, {
            status: '40',
            subStatus: 'repairing',
            source: 'parts_available',
            updatedAt: serverTimestamp()
          });
        } else if (listDecision === 'refused') {
          // Parts did not arrive -> Move to exit status '50' with failureReason
          batch.update(itemRef, {
            status: '50',
            subStatus: 'no_parts',
            failureReason: 'لم تتوفر قطع الغيار',
            source: 'parts_not_available',
            updatedAt: serverTimestamp()
          });
        }
      });

      // Calculate final statuses of all items in this invoice for bulk updates
      let finalBulkInvoiceStatus = '50';
      const finalStatuses: string[] = [];
      items.filter(it => it.invoiceNumber === invoice.invoiceNumber).forEach(it => {
        if (PARTS_STATUSES.includes(it.status)) {
          finalStatuses.push(listDecision === 'approved' ? '40' : '50');
        } else {
          finalStatuses.push(it.status);
        }
      });
      
      if (finalStatuses.some(s => s === '70' || s === 'cancelled')) finalBulkInvoiceStatus = '70';
      else if (finalStatuses.some(s => s === '10' || s === 'new')) finalBulkInvoiceStatus = '10';
      else if (finalStatuses.some(s => s === '20')) finalBulkInvoiceStatus = '20';
      else if (finalStatuses.some(s => s === '30' || s === '35' || s === 'awaiting_approval' || s === 'awaiting_parts')) finalBulkInvoiceStatus = '30';
      else if (finalStatuses.some(s => s === '40' || s === 'repairing')) finalBulkInvoiceStatus = '40';

      batch.update(doc(db, 'invoices', invoice.id!), {
        status: finalBulkInvoiceStatus,
        updatedAt: serverTimestamp()
      });

      // Register the activity
      const actionRef = doc(collection(db, 'approval_actions'));
      batch.set(actionRef, {
        invoiceNumber: invoice.invoiceNumber,
        customerName: invoice.customerName,
        decision: listDecision === 'approved' ? 'parts_available' : 'parts_unavailable',
        date: new Date().getTime(),
        userId: user.id || 'unknown',
        userName: user.name || 'System',
        createdAt: serverTimestamp()
      });

      await batch.commit();

      setDecisions(prev => {
        const copy = { ...prev };
        delete copy[invoice.id || ''];
        return copy;
      });
    } catch (err) {
      console.error("Error committing bulk parts decision:", err);
    } finally {
      setRowLoading(prev => ({ ...prev, [invoice.id || '']: false }));
    }
  };

  // Cloned Details Form Navigation helpers (Only applicable for Approval Tab)
  const getAvailableQuantity = (itemId: string, excludeIndex: number = -1) => {
    const originalItem = invoiceItems.find(i => i.id === itemId);
    if (!originalItem) return 0;
    
    // Check how many have been applied to the table
    let usedQuantity = actionItems.reduce((acc, row, idx) => {
      if (idx !== excludeIndex && row.id === itemId) return acc + row.count;
      return acc;
    }, 0);
    
    // Also consider what's currently in the form (if we are NOT editing a row)
    if (excludeIndex === -1 && currentFormRow.id === itemId) {
       // We don't deduct it from available quantity so the user sees proper Max when adding
    }

    return originalItem.quantity - usedQuantity;
  };

  const handleUpdateCurrentForm = (field: string, value: any) => {
    const row = { ...currentFormRow, [field]: value };
    if (field === 'id') {
      const maxCount = getAvailableQuantity(value, -1);
      row.count = maxCount;
    }
    if (field === 'outcome') {
      if (value === 'approved') {
        row.reason = subTab === 'parts' ? 'توفرت قطع الغيار' : 'تمت الموافقة';
      } else if (value === 'waiting_parts') {
        row.reason = subTab === 'parts' ? 'ما زال ينتظر قطع الغيار' : 'انتظار قطع الغيار';
      } else if (value === 'refused') {
        row.reason = subTab === 'parts' ? 'لم تتوفر قطع الغيار' : 'لم يوافق العميل';
      }
    }
    setCurrentFormRow(row);
  };

  const handleApplyFormToTable = () => {
    if (!currentFormRow.id || !currentFormRow.count || isNaN(Number(currentFormRow.count)) || Number(currentFormRow.count) < 1) return;
    const maxAllowed = getAvailableQuantity(currentFormRow.id, editingIndex !== null ? editingIndex : -1);
    if (Number(currentFormRow.count) > maxAllowed) return; // Disallow going over available count

    if (editingIndex !== null) {
      const newItems = [...actionItems];
      newItems[editingIndex] = currentFormRow as any;
      setActionItems(newItems);
      setEditingIndex(null);
    } else {
      setActionItems([...actionItems, currentFormRow as any]);
    }
    
    const newActionItems = editingIndex !== null 
        ? actionItems.map((r, i) => i === editingIndex ? currentFormRow : r)
        : [...actionItems, currentFormRow as any];
        
    // reset form to next available item if any
    const availableItem = invoiceItems.find(it => {
        const used = newActionItems.reduce((acc, row) => row.id === it.id ? acc + row.count : acc, 0);
        return (it.quantity - used) > 0;
    });

    if (availableItem) {
        const used = newActionItems.reduce((acc, row) => row.id === availableItem.id ? acc + row.count : acc, 0);
        const remQty = Math.max(0, availableItem.quantity - used);
        setCurrentFormRow({ id: availableItem.id!, count: remQty, outcome: 'approved', reason: subTab === 'parts' ? 'توفرت قطع الغيار' : 'تمت الموافقة' });
    } else {
        setCurrentFormRow({ id: '', count: '', outcome: 'approved', reason: subTab === 'parts' ? 'توفرت قطع الغيار' : 'تمت الموافقة' });
    }
  };

  const handleCancelForm = () => {
      setEditingIndex(null);
      const availableItem = invoiceItems.find(it => getAvailableQuantity(it.id!, -1) > 0);
      if (availableItem) {
        const remQty = getAvailableQuantity(availableItem.id!, -1);
        setCurrentFormRow({ id: availableItem.id!, count: remQty, outcome: 'approved', reason: subTab === 'parts' ? 'توفرت قطع الغيار' : 'تمت الموافقة' });
      } else {
        setCurrentFormRow({ id: '', count: '', outcome: 'approved', reason: subTab === 'parts' ? 'توفرت قطع الغيار' : 'تمت الموافقة' });
      }
  };

  const handleEditTableRow = (index: number) => {
      setCurrentFormRow(actionItems[index]);
      setEditingIndex(index);
  };

  const handleRemoveFormRow = (index: number) => {
      const updated = actionItems.filter((_, i) => i !== index);
      setActionItems(updated);
      if (editingIndex === index) {
          handleCancelForm();
      }
  };

  // Cloned Form Submission Logic
  const saveApprovalData = async (actionType: 'none' | 'print' | 'whatsapp') => {
    if (!selectedInvoice || actionItems.length === 0 || !engineerName.trim()) return;
    setLoadingForm(true);

    try {
      const batch = writeBatch(db);
      let deductedCost = 0;

      // Track remaining quantities
      const itemRemaining = new Map<string, number>();
      for (const row of actionItems) {
        if (!row.id || Number(row.count) <= 0) continue;
        const oItem = invoiceItems.find(i => i.id === row.id);
        if (!oItem) continue;
        if (!itemRemaining.has(oItem.id!)) {
          itemRemaining.set(oItem.id!, Number(oItem.quantity) || 0);
        }
      }

      for (const row of actionItems) {
        if (!row.id || Number(row.count) <= 0) continue;
        const originalItem = invoiceItems.find(i => i.id === row.id);
        if (!originalItem) continue;

        const rowCount = Number(row.count) || 1;
        let rem = itemRemaining.get(originalItem.id!) || 0;
        let unitCost = originalItem.quantity > 0 ? (Number(originalItem.cost || 0) / originalItem.quantity) : 0;

        let updatedStatus = '40'; // approved -> maintenance
        let subStatus = 'repairing';
        let failureReason: string | null = null;
        let finalEngineerReport = originalItem.engineerReport || '';

        if (row.outcome === 'approved') {
          updatedStatus = '40';
          subStatus = 'repairing';
          // Keep existing inspection engineer report intact
          finalEngineerReport = originalItem.engineerReport || '';
        } else if (row.outcome === 'waiting_parts') {
          updatedStatus = '35'; // remains on this page
          subStatus = 'awaiting_parts';
          // Keep the original diagnostic report intact so it's not lost when parts arrive!
          finalEngineerReport = originalItem.engineerReport || '';
          failureReason = row.reason || 'انتظار قطع الغيار';
        } else if (row.outcome === 'refused') {
          updatedStatus = '50'; // goes directly to exit
          subStatus = subTab === 'parts' ? 'no_parts' : 'refused';
          failureReason = row.reason || (subTab === 'parts' ? 'لم تتوفر قطع الغيار' : 'لم يوافق العميل');
          finalEngineerReport = null;
        }

        let splitItemCost = unitCost * rowCount;
        // Keep the cost field intact so accounts can calculate full list, whilst Customer filters on refused status.
        let deductedCostVal = 0; // do not deduct from base invoice

        if (rem > rowCount) {
          // split quantity
          const splitItemRef = doc(collection(db, 'invoice_items'));
          batch.set(splitItemRef, {
            ...originalItem,
            id: splitItemRef.id,
            quantity: rowCount,
            status: updatedStatus,
            subStatus,
            source: 'approval_details_split',
            cost: splitItemCost,
            failureReason,
            engineerReport: finalEngineerReport,
            technician: engineerName,
            updatedAt: serverTimestamp()
          });

          rem -= rowCount;
          itemRemaining.set(originalItem.id!, rem);

          batch.update(doc(db, 'invoice_items', originalItem.id!), {
            quantity: rem,
            cost: (unitCost * rem)
          });
        } else {
          // update fully
          batch.update(doc(db, 'invoice_items', originalItem.id!), {
            status: updatedStatus,
            subStatus,
            source: 'approval_details_update',
            quantity: rem,
            cost: splitItemCost,
            failureReason,
            engineerReport: finalEngineerReport,
            technician: engineerName,
            updatedAt: serverTimestamp()
          });
          itemRemaining.set(originalItem.id!, 0);
        }
      }

      // Calculate final statuses of all items in this invoice
      const finalItemStatuses: string[] = [];
      for (const row of actionItems) {
        if (!row.id || Number(row.count) <= 0) continue;
        const originalItem = invoiceItems.find(i => i.id === row.id);
        if (!originalItem) continue;

        let updatedStatus = '40';
        if (row.outcome === 'approved') {
          updatedStatus = '40';
        } else if (row.outcome === 'waiting_parts') {
          updatedStatus = '35';
        } else if (row.outcome === 'refused') {
          updatedStatus = '50';
        }
        finalItemStatuses.push(updatedStatus);
      }

      const processedItemIds = new Set(actionItems.map(row => row.id));
      const unmodifiedItems = items.filter(it => it.invoiceNumber === selectedInvoice.invoiceNumber && !processedItemIds.has(it.id!));
      unmodifiedItems.forEach(it => {
        finalItemStatuses.push(it.status);
      });

      // Determine overall invoice status
      let finalInvoiceStatus = '50';
      if (finalItemStatuses.some(s => s === '70' || s === 'cancelled')) {
        finalInvoiceStatus = '70';
      } else if (finalItemStatuses.some(s => s === '10' || s === 'new')) {
        finalInvoiceStatus = '10';
      } else if (finalItemStatuses.some(s => s === '20')) {
        finalInvoiceStatus = '20';
      } else if (finalItemStatuses.some(s => s === '30' || s === '35' || s === 'awaiting_approval' || s === 'awaiting_parts')) {
        finalInvoiceStatus = '30';
      } else if (finalItemStatuses.some(s => s === '40' || s === 'repairing')) {
        finalInvoiceStatus = '40';
      }

      batch.update(doc(db, 'invoices', selectedInvoice.id!), {
        status: finalInvoiceStatus,
        totalCost: Math.max(0, (selectedInvoice.totalCost || 0) - deductedCost),
        updatedAt: serverTimestamp()
      });

      // Record detailed approval action
      const actionRef = doc(collection(db, 'approval_actions'));
      batch.set(actionRef, {
        engineerName,
        actionDate: new Date().getTime(),
        type: subTab === 'parts' ? 'parts_details_form' : 'approval_details_form',
        invoiceNumber: selectedInvoice.invoiceNumber,
        customerName: selectedInvoice.customerName,
        updates: actionItems.map(r => ({
          itemId: r.id,
          count: r.count,
          outcome: r.outcome,
          reason: r.reason
        })),
        userId: user.id || 'unknown',
        userName: user.name || 'System',
        createdAt: serverTimestamp()
      });

      // Save user as engineer/technician if we want to save them to the engineers list
      const sanitizedEngName = engineerName.trim().replace(/[\/]/g, '_');
      const engineerRef = doc(db, 'engineers', sanitizedEngName);
      batch.set(engineerRef, { name: engineerName.trim(), updatedAt: serverTimestamp() }, { merge: true });

      await batch.commit();
      
      if (actionType === 'print') {
        setTimeout(handlePrintDirect, 500);
      } else if (actionType === 'whatsapp') {
        await handleExportPDFAndWhatsApp(selectedInvoice);
      }

      setShowPreviewReport(false);
      setSelectedInvoice(null);
    } catch (err) {
      console.error("Error processing customized approval form save:", err);
    } finally {
      setLoadingForm(false);
    }
  };

  // SHOW CLONED DETAILED FORM VIEW
  if (selectedInvoice) {
    if (showPreviewReport) {
      // Build a preview of the items that would result from applying the actionItems
      const previewItems = invoiceItems.map(item => {
        // Did we modify this item? We might have modified it multiple times or split it?
        // Wait, ApprovalAndParts is primarily a split system (you can approve 1 and refuse 1). 
        // But for preview, we just gather what will happen.
        return item; 
      }); // For brevity we just pass invoiceItems untouched or modified, the activePrintReportInvoice expects normal items

      const inv = selectedInvoice;
      return (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[999] overflow-y-auto flex items-start justify-center p-2 sm:p-6 md:p-8 font-sans print:p-0 print:bg-white print:relative" dir="rtl">
          <div className="bg-[#141414] border border-white/10 w-full max-w-4xl rounded-3xl overflow-hidden shadow-2xl flex flex-col my-4 print:border-0 print:my-0 print:shadow-none print:bg-white">
            <div className="flex items-center justify-between p-4 bg-black/50 border-b border-white/5 print:hidden flex-wrap gap-4 select-none col-span-full">
              <div className="flex items-center gap-2">
                <button 
                  type="button"
                  onClick={() => setShowPreviewReport(false)}
                  className="px-4 py-2 rounded-xl text-xs font-black bg-slate-200 border border-slate-300 hover:bg-slate-300 text-slate-900 flex items-center gap-2 transition-all cursor-pointer shadow-md"
                >
                  <ArrowLeft size={16} className="rtl:rotate-180" />
                  <span>العودة للخلف للمراجعة</span>
                </button>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button 
                  type="button"
                  disabled={loadingForm}
                  onClick={() => saveApprovalData('none')}
                  className="px-4 py-2.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-2 shadow-[0_0_15px_rgba(5,150,105,0.3)] transition-all cursor-pointer disabled:opacity-50"
                >
                  {loadingForm ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                  <span>حفظ وترحيل</span>
                </button>

                <button 
                  type="button"
                  disabled={loadingForm}
                  onClick={() => saveApprovalData('print')}
                  className="px-4 py-2.5 rounded-xl text-xs font-black bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 shadow-md transition-all cursor-pointer disabled:opacity-50"
                >
                  {loadingForm ? <Loader2 className="animate-spin" size={16} /> : <Printer size={16} />}
                  <span>حفظ وطباعة مباشرة</span>
                </button>

                <button 
                  type="button"
                  disabled={loadingForm || isGeneratingPDF}
                  onClick={() => saveApprovalData('whatsapp')}
                  className="px-4 py-2.5 rounded-xl text-xs font-black bg-emerald-500 hover:bg-emerald-600 text-white flex items-center gap-2 shadow-md transition-all cursor-pointer disabled:opacity-50"
                >
                  {isGeneratingPDF ? (
                    <>
                      <Loader2 className="animate-spin" size={16} />
                      جاري التصدير...
                    </>
                  ) : (
                    <>
                      <Smartphone className="w-5 h-5 text-white" />
                      <span>حفظ وارسال واتس</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Content to print is simply the active print element or logic for it */}
            <div className="overflow-x-auto w-full pb-4 bg-white">
              <div id="print-report-area" className="p-8 bg-white text-gray-900 print:p-0 print:bg-white print:text-black w-[794px] min-h-fit mx-auto">
                  {/* Header Layout */}
                  <div className="flex justify-between items-start border-b-2 border-gray-900 pb-4 mb-4">
                    {/* Right Corner: Shop Name */}
                    <div className="text-right flex-1 pt-1">
                      <h2 className="text-xl font-black text-gray-900 tracking-tight leading-tight font-cairo whitespace-nowrap">{shopConfig?.shopName || 'عالم الصيانة والتجارة'}</h2>
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
                      <h1 className="text-lg font-black text-gray-900 tracking-tight border-2 border-gray-900 px-4 py-1.5 rounded-lg inline-block bg-gray-50/50">تقرير الحالة والإسناد</h1>
                    </div>

                    {/* Left Corner: Invoice Info */}
                    <div className="text-left flex-1 space-y-1 pt-1 bg-gray-50/50 p-3 rounded-lg border border-gray-200">
                      <div className="text-sm font-bold text-gray-700 flex justify-between gap-4">
                        <span>رقم التقرير:</span>
                        <span className="font-mono text-gray-900">{inv.invoiceNumber}</span>
                      </div>
                      <div className="text-sm font-bold text-gray-700 flex justify-between gap-4">
                        <span>التاريخ:</span>
                        <span className="font-mono text-gray-900">{inv.createdAt ? (function(){ const d = new Date(inv.createdAt.seconds ? inv.createdAt.seconds * 1000 : (inv.createdAt?.toDate ? inv.createdAt.toDate() : inv.createdAt)); return isNaN(d.getTime()) ? '---' : d.toISOString().slice(0,10).replace(/-/g, '/'); })() : '---'}</span>
                      </div>
                      <div className="text-sm font-bold text-gray-700 flex justify-between gap-4">
                        <span>وقت الإصدار:</span>
                        <span className="font-mono text-gray-900">
                          {inv.createdAt ? (function(){ 
                            const d = new Date(inv.createdAt.seconds ? inv.createdAt.seconds * 1000 : (inv.createdAt?.toDate ? inv.createdAt.toDate() : inv.createdAt)); 
                            return isNaN(d.getTime()) ? '---' : d.toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit' }); 
                          })() : new Date().toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="text-sm font-bold text-gray-700 flex justify-between gap-4 border-t border-gray-200 pt-1 mt-1 font-cairo">
                        <span>المستخدم:</span>
                        <span className="font-mono text-gray-900">1</span>
                      </div>
                    </div>
                  </div>

                  {/* Customer Info Single Line */}
                  <div className="bg-gray-100 p-3 rounded-lg mb-4 border border-gray-300 flex justify-between items-center px-6">
                    <div className="text-sm font-black text-gray-900">
                      <span className="text-xs text-gray-600 ml-2">إسم العميل:</span>
                      {inv.customerName}
                    </div>
                    <div className="text-sm font-bold text-gray-900 border-r border-gray-300 pr-6">
                      <span className="text-xs text-gray-600 ml-2">الجهة:</span>
                      {getCustomerCompany(inv.customerId) || '---'}
                    </div>
                    <div className="text-sm font-bold text-gray-900 border-r border-gray-300 pr-6" dir="ltr">
                      <span className="text-xs text-gray-600 ml-2 font-sans">تلفون/جوال:</span>
                      <span className="font-mono">{getCustomerPhone(inv.customerId) || 'غير متوفر'}</span>
                    </div>
                  </div>

                  {/* Device Detailed Items Table */}
                  <div className="border border-gray-400 overflow-hidden mb-4 rounded-md mt-6">
                    <table className="w-full text-right border-collapse text-sm">
                      <thead className="bg-gray-100 text-gray-800 font-bold border-b-2 border-gray-400">
                        <tr>
                          <th className="px-3 py-3 text-center w-12 border-l border-gray-400 bg-gray-200/50">مسلسل</th>
                          <th className="px-3 py-3 border-l border-gray-400">النوع/الجهاز</th>
                          <th className="px-3 py-3 border-l border-gray-400 w-1/3">تقرير الفحص المسجل</th>
                          <th className="px-3 py-3 border-l border-gray-400 w-1/3">تفاصيل الإجراء الحالي</th>
                          <th className="px-3 py-3 text-center border-l border-gray-400 w-24">العدد</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-300">
                        {actionItems.map((action, idx) => {
                          const it = invoiceItems.find(i => i.id === action.id);
                          if (!it) return null;
                          return (
                            <tr key={idx} className="even:bg-gray-50/50">
                              <td className="px-3 py-3 text-center font-mono font-bold border-l border-gray-400 bg-gray-50">{idx + 1}</td>
                              <td className="px-3 py-3 font-bold text-gray-900 border-l border-gray-400 leading-relaxed">
                                {it.deviceType} {it.deviceName ? `- ${it.deviceName}` : ''}
                              </td>
                              <td className="px-3 py-3 text-gray-800 leading-relaxed border-l border-gray-400 whitespace-nowrap overflow-hidden max-w-[200px] text-ellipsis">
                                {it.engineerReport || 'لا يوجد تقرير'}
                              </td>
                              <td className="px-3 py-3 text-gray-800 leading-relaxed border-l border-gray-400 whitespace-nowrap overflow-hidden max-w-[200px] text-ellipsis">
                                <div className="font-bold mb-1">({action.outcome === 'approved' ? 'موافقة' : action.outcome === 'waiting_parts' ? 'انتظار قطع' : 'رفض'})</div>
                                {action.reason || '-'}
                              </td>
                              <td className="px-3 py-3 text-center font-mono text-gray-900 border-l border-gray-400">
                                {action.count}
                              </td>
                            </tr>
                          );
                        })}
                        {/* Last row for totals */}
                        <tr className="bg-gray-200/60 font-bold border-t-2 border-gray-400">
                          <td colSpan={4} className="px-3 py-4 text-left font-black border-l border-gray-400 text-base">إجمالي الأجهزة المشمولة في الإجراء</td>
                          <td className="px-3 py-4 text-center font-mono font-black border-l border-gray-400 text-lg">
                            {actionItems.reduce((acc, row) => acc + row.count, 0)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Summary Devices Status */}
                  <div className="flex items-center gap-4 mb-4 text-sm font-bold text-gray-900 mt-6">
                    <div className="flex items-center gap-2">
                       <span>عدد أجهزة مشمولة بالموافقة</span>
                      <div className="w-12 h-8 border-2 border-gray-400 bg-gray-50 rounded flex items-center justify-center font-mono font-black text-base text-emerald-600">
                        {actionItems.filter(i => i.outcome === 'approved').reduce((sum, i) => sum + i.count, 0)}
                      </div>
                    </div>
                    <span className="text-gray-400">|</span>
                    <div className="flex items-center gap-2">
                      <span>عدد أجهزة انتظار قطع</span>
                      <div className="w-12 h-8 border-2 border-gray-400 bg-gray-50 rounded flex items-center justify-center font-mono font-black text-base text-amber-600">
                        {actionItems.filter(i => i.outcome === 'waiting_parts').reduce((sum, i) => sum + i.count, 0)}
                      </div>
                    </div>
                    <span className="text-gray-400">|</span>
                    <div className="flex items-center gap-2">
                      <span>عدد أجهزة رفضت</span>
                      <div className="w-12 h-8 border-2 border-gray-400 bg-gray-50 rounded flex items-center justify-center font-mono font-black text-base text-rose-600">
                        {actionItems.filter(i => i.outcome === 'refused').reduce((sum, i) => sum + i.count, 0)}
                      </div>
                    </div>
                  </div>

                  <div className="border-t-2 border-gray-900 my-8"></div>

                  {/* Footer Notes & Signatures - New Layout */}
                  <div className="flex justify-between items-start text-xs font-bold text-gray-900 leading-loose mb-6 px-4">
                    {/* Right Side */}
                    <div className="text-right space-y-1">
                        <p>نرجو منكم الرد خلال 24 ساعة كحد أقصى</p>
                        <p className="pt-6 font-black">توقيع العميل بالموافقة / ........................................</p>
                    </div>

                    {/* Left Side */}
                    <div className="text-left space-y-1">
                        <p className="pt-8">اسم المهندس المختص / <span className="font-bold border-b border-dashed px-4">{engineerName || '................'}</span> التوقيع /.............</p>
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

                  <BankAccountsFooter shopConfig={shopConfig} currentOutput={{ output_datetime: new Date() }} />
              </div>
            </div>
          </div>
        </div>
      );
    }

    const isQuantityInvalid = !currentFormRow.count || 
                              isNaN(Number(currentFormRow.count)) || 
                              Number(currentFormRow.count) <= 0 || 
                              (currentFormRow.id ? Number(currentFormRow.count) > getAvailableQuantity(currentFormRow.id, editingIndex !== null ? editingIndex : -1) : true);

    const isApplyDisabled = !currentFormRow.id || isQuantityInvalid;

    return (
      <div className="w-full h-full space-y-0 pb-32 md:pb-8 text-right font-sans" dir="rtl">
        {/* Unified Navigation Sticky Header */}
        <div className="flex items-center px-4 py-3 border-b border-white/10 bg-[#0a0a0a]/80 backdrop-blur-xl z-40 sticky top-0 flex-wrap md:flex-nowrap gap-4">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <button onClick={() => setSelectedInvoice(null)} className="p-1.5 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-xl transition-all shrink-0">
              <ArrowLeft size={18} className="rtl:rotate-180" />
            </button>
            <h1 className="text-lg font-black tracking-tight flex items-center gap-2 text-white m-0 p-0">
              <Clock size={18} className="text-amber-500 animate-pulse" />
              {subTab === 'parts' ? 'إجراء انتظار قطع الغيار' : 'إجراء انتظار الموافقة والقطع'} - #{selectedInvoice.invoiceNumber}
            </h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button 
              onClick={() => setActivePrintReportInvoice(selectedInvoice)}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-1.5 shadow-md hover:scale-[1.03] active:scale-[0.97] transition-all cursor-pointer"
            >
              <Printer size={14} />
              عرض وطباعة التقرير الفني
            </button>
          </div>
        </div>

        {/* Invoice Info */}
        <div className="bg-[#1a1a1a] p-6 border-b border-white/5 space-y-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl -translate-y-10 -translate-x-10"></div>
          
          <div className="flex items-center gap-4 relative z-10">
             <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-gray-400">
                <Clock size={24} />
             </div>
             <div>
               <h3 className="text-xl font-bold text-white">{selectedInvoice.customerName}</h3>
               <p className="text-xs text-gray-400 mt-1">رقم الهاتف: {getCustomerNumber(selectedInvoice.customerId)}</p>
             </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-white/5 relative z-10">
            <div className="flex flex-row items-center gap-4">
              <label className="text-xs text-gray-400 font-bold whitespace-nowrap w-20 shrink-0">المهندس</label>
              <input 
                type="text" 
                value={engineerName}
                list="engineers-list"
                onChange={e => setEngineerName(e.target.value)}
                placeholder="أدخل اسم مسؤول الإجراء فنيًا أو إداريًا"
                className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 focus:border-amber-500 outline-none transition-all text-right text-white text-sm"
              />
              <datalist id="engineers-list">
                {engineersList.map((eng, idx) => (
                  <option key={idx} value={eng} />
                ))}
              </datalist>
            </div>
          </div>
        </div>

        {/* Form Entry Block */}
        <div className="space-y-4 p-4 mt-2">
           <div className="bg-[#1a1a1a] p-6 rounded-2xl border border-white/5 space-y-4 shadow-lg">
             <div className="flex justify-between items-center mb-2 pb-3 border-b border-white/5">
                <h3 className="font-bold text-amber-500 text-sm">البند التفصيلي والموافقة</h3>
             </div>

             <div className="space-y-4 w-full">
               {/* الجهاز */}
               <div className="flex flex-row items-center gap-3 w-full">
                 <label className="text-xs text-gray-400 font-bold whitespace-nowrap w-20 shrink-0">الجهاز</label>
                 <select 
                   value={currentFormRow.id}
                   onChange={e => handleUpdateCurrentForm('id', e.target.value)}
                   className="flex-1 bg-black/40 border border-white/10 px-4 py-3 focus:border-amber-500 outline-none transition-all rounded-xl text-sm text-right text-white truncate box-border"
                 >
                   <option value="" disabled>اختر الجهاز</option>
                   {invoiceItems.map(it => {
                     const available = getAvailableQuantity(it.id!, -1);
                     if (available <= 0 && currentFormRow.id !== it.id) return null;
                     return <option key={it.id} value={it.id}>{it.deviceType} - {it.deviceName} - المتبقى: {available}</option>;
                   })}
                 </select>
               </div>

               {/* تقرير الفحص */}
               {(() => {
                 const selectedItem = invoiceItems.find(i => i.id === currentFormRow.id);
                 if (!selectedItem) return null;
                 return (
                    <div className="flex flex-row items-center gap-3 w-full">
                      <span className="text-xs text-amber-500 font-bold whitespace-nowrap w-20 shrink-0 self-center">تقرير الفحص</span>
                      <div className="flex-1 bg-black/20 px-4 py-3 border border-white/5 rounded-xl text-sm font-medium text-amber-500 truncate box-border" title={selectedItem.engineerReport}>
                        {selectedItem.engineerReport || 'لا يوجد'}
                      </div>
                    </div>
                 );
               })()}

               {/* تفاصيل الرد */}
               <div className="flex flex-row items-center gap-3 w-full">
                 <label className="text-xs text-gray-400 font-bold whitespace-nowrap w-20 shrink-0 self-center">تفاصيل الرد</label>
                 <input 
                   type="text"
                   value={currentFormRow.reason}
                   onFocus={(e) => {
                     e.target.select();
                     e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                   }}
                   onClick={(e) => {
                     e.currentTarget.select();
                   }}
                   onChange={e => handleUpdateCurrentForm('reason', e.target.value)}
                   placeholder="الرجاء كتابة تفاصيل الرد"
                   className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 focus:border-amber-500 outline-none transition-all text-sm text-right text-white box-border"
                 />
               </div>
             </div>

             {/* Count + Decisive Action Outcomes */}
             <div className="mt-4 pt-3 border-t border-white/5">
                <div className="bg-black/20 p-3 rounded-xl border border-white/5 w-full space-y-3">
                   <div className="flex flex-wrap items-center gap-6">
                      <div className="flex items-center gap-2 shrink-0">
                         <span className="text-xs text-gray-400 font-bold whitespace-nowrap shrink-0">العدد</span>
                         <input 
                           type="text"
                           inputMode="numeric"
                           pattern="[0-9]*"
                           value={currentFormRow.count}
                           onFocus={e => e.target.select()}
                           onKeyDown={e => {
                             if (['-', '+', '.', 'e', 'E', ',', '`'].includes(e.key)) {
                               e.preventDefault();
                             }
                           }}
                           onChange={e => {
                             let cleanValStr = e.target.value.replace(/[^0-9]/g, '');
                             if (cleanValStr === '') {
                               handleUpdateCurrentForm('count', '');
                               return;
                             }
                             let val = parseInt(cleanValStr, 10);
                             if (isNaN(val)) {
                               handleUpdateCurrentForm('count', '');
                               return;
                             }
                             const max = currentFormRow.id ? getAvailableQuantity(currentFormRow.id, editingIndex !== null ? editingIndex : -1) : 1;
                             if (val > max) {
                               val = max;
                             }
                             if (val < 1) {
                               val = 1;
                             }
                             handleUpdateCurrentForm('count', val);
                           }}
                           onBlur={() => {
                             let val = currentFormRow.count;
                             const max = currentFormRow.id ? getAvailableQuantity(currentFormRow.id, editingIndex !== null ? editingIndex : -1) : 1;
                             if (val === '' || isNaN(Number(val)) || Number(val) < 1) {
                               val = Math.max(1, max);
                             } else {
                               val = Math.floor(Number(val));
                               if (val > max) {
                                 val = max;
                               }
                               if (val < 1) {
                                 val = 1;
                               }
                             }
                             handleUpdateCurrentForm('count', val);
                           }}
                           className="w-16 bg-black/40 border border-white/10 px-2 py-1.5 focus:border-amber-500 outline-none transition-all text-center rounded-lg text-xs font-bold text-white font-mono"
                         />
                      </div>

                      <div className="hidden md:block h-6 w-px bg-white/10 shrink-0"></div>

                      <label className="flex items-center gap-2 cursor-pointer">
                         <input 
                           type="radio" 
                           checked={currentFormRow.outcome === 'approved'} 
                           onChange={() => handleUpdateCurrentForm('outcome', 'approved')}
                           className="accent-emerald-500 w-4 h-4 cursor-pointer"
                         />
                         <span className="text-xs font-bold text-white hover:text-emerald-400 transition-colors whitespace-nowrap">
                           {subTab === 'parts' ? 'وصلت قطع الغيار (إلى الصيانة)' : 'تم موافقة العميل'}
                         </span>
                      </label>
                   </div>

                   <div className="flex flex-wrap items-center gap-6 pt-2.5 border-t border-white/5">
                      <label className="flex items-center gap-2 cursor-pointer">
                         <input 
                           type="radio" 
                           checked={currentFormRow.outcome === 'refused'} 
                           onChange={() => handleUpdateCurrentForm('outcome', 'refused')}
                           className="accent-red-500 w-4 h-4 cursor-pointer"
                         />
                         <span className="text-xs font-bold text-gray-300 hover:text-red-500 transition-colors whitespace-nowrap">
                           {subTab === 'parts' ? 'لم تتوفر قطع الغيار (إلى الخروج)' : 'لم يوافق العميل'}
                         </span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                         <input 
                           type="radio" 
                           checked={currentFormRow.outcome === 'waiting_parts'} 
                           onChange={() => handleUpdateCurrentForm('outcome', 'waiting_parts')}
                           className="accent-amber-500 w-4 h-4 cursor-pointer"
                         />
                         <span className="text-xs font-bold text-gray-400 hover:text-amber-500 transition-colors whitespace-nowrap">
                           {subTab === 'parts' ? 'ما زال ينتظر قطع الغيار' : 'انتظار قطع الغيار'}
                         </span>
                      </label>
                   </div>
                </div>
             </div>
             
             {/* Form Action Buttons (Add, Update, Cancel) */}
             <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/5">
               <button
                 onClick={handleCancelForm}
                 className="px-6 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl text-sm font-bold transition-all cursor-pointer"
               >
                 إلغاء
               </button>
               {editingIndex !== null ? (
                 <button
                   onClick={handleApplyFormToTable}
                   disabled={isApplyDisabled}
                   className="px-6 py-2 bg-amber-500 hover:bg-amber-600 text-black rounded-xl text-sm font-bold shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
                 >
                   تعديل
                 </button>
               ) : (
                 <button
                   onClick={handleApplyFormToTable}
                   disabled={isApplyDisabled}
                   className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-black rounded-xl text-sm font-bold shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
                 >
                   إضافة الجهاز
                 </button>
               )}
             </div>

           </div>
        </div>

        {/* Temporary Table / Action Items */}
        {actionItems.length > 0 && (
          <div className="space-y-3 p-4">
            <h3 className="text-sm font-bold text-white mb-2">الأجهزة المضافة للإجراء ({actionItems.length}):</h3>
            <div className="bg-[#1a1a1a] rounded-2xl border border-white/5 overflow-x-auto shadow-lg">
              <table className="w-full text-sm text-right">
                <thead className="bg-black/40 border-b border-white/5">
                  <tr className="text-xs text-gray-400 whitespace-nowrap">
                    <th className="py-3 px-4 font-bold">الجهاز</th>
                    <th className="py-3 px-4 font-bold">تقرير الفحص</th>
                    <th className="py-3 px-4 font-bold">العدد</th>
                    <th className="py-3 px-4 font-bold">حالة الرد</th>
                    <th className="py-3 px-4 font-bold">تفاصيل الرد</th>
                    <th className="py-3 px-4 font-bold w-24">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-gray-300">
                  {actionItems.map((row, idx) => {
                    const it = invoiceItems.find(i => i.id === row.id);
                    return (
                      <tr key={idx} className="hover:bg-white/5 transition-colors whitespace-nowrap">
                        <td className="py-3 px-4">{it ? `${it.deviceType} - ${it.deviceName}` : 'غير معروف'}</td>
                        <td className="py-3 px-4">{it?.engineerReport || '-'}</td>
                        <td className="py-3 px-4 font-mono font-bold">{row.count}</td>
                        <td className="py-3 px-4">
                          {row.outcome === 'approved' ? <span className="text-emerald-400">{subTab === 'parts' ? 'وصول قطع' : 'تم موافقة العميل'}</span> : 
                           row.outcome === 'waiting_parts' ? <span className="text-amber-400">انتظار قطع</span> : 
                           <span className="text-red-400">{subTab === 'parts' ? 'عدم توفر قطع' : 'لم يوافق العميل'}</span>}
                        </td>
                        <td className="py-3 px-4">{row.reason || '-'}</td>
                        <td className="py-3 px-4 flex items-center gap-2">
                           <button onClick={() => handleEditTableRow(idx)} className="p-1 hover:bg-amber-500/20 text-amber-500 rounded transition-colors cursor-pointer" title="تعديل">
                             <Edit2 size={16} />
                           </button>
                           <button onClick={() => handleRemoveFormRow(idx)} className="p-1 hover:bg-red-500/20 text-red-500 rounded transition-colors cursor-pointer" title="حذف">
                             <Trash2 size={16} />
                           </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Form CTA Buttons */}
        <div className="p-4 mb-16">
           <button 
             onClick={() => setShowPreviewReport(true)}
             disabled={loadingForm || !engineerName.trim() || actionItems.length === 0}
             className="w-full bg-amber-500 hover:bg-amber-600 text-black py-4 font-black transition-all flex items-center justify-center gap-2 rounded-2xl hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
           >
             <Search size={20} className="text-black" />
             معاينة الحالة والإسناد
           </button>
        </div>
      </div>
    );
  }

  // STANDARD LIST VIEW: "صفحة انتظار الموافقة والقطع" (Dual View via subTabs)
  const countApprovalDevices = items.filter(i => ['30', 'awaiting_approval'].includes(i.status) && i.quantity > 0).reduce((sum, i) => sum + (Number(i.quantity) || 0), 0);
  const countPartsDevices = items.filter(i => ['35', 'awaiting_parts'].includes(i.status) && i.quantity > 0).reduce((sum, i) => sum + (Number(i.quantity) || 0), 0);

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20 text-right font-sans px-4 pt-4" dir="rtl">
      {/* Large Orange/Amber Dual Stats Counter Card */}
      <div className="px-0">
        <div className="w-full bg-gradient-to-br from-amber-600 via-orange-600 to-amber-700 text-white p-6 rounded-[2rem] shadow-lg relative overflow-hidden">
          {/* Faint Background Icon */}
          <div className="absolute top-1/2 left-6 -translate-y-1/2 opacity-10 pointer-events-none">
            <Clock size={160} />
          </div>

          <div className="relative z-10 grid grid-cols-2 divide-x divide-white/15 rtl:divide-x-reverse">
            {/* Clickable section 1: Waiting for Customer Approval */}
            <button
              onClick={() => {
                setSubTab('approval');
                setSearch('');
                setDecisions({});
              }}
              className={`flex flex-col items-center justify-center py-4 px-2 transition-all rounded-2xl relative cursor-pointer ${
                subTab === 'approval' 
                  ? 'bg-white/15 shadow-inner scale-[1.02]' 
                  : 'hover:bg-white/5 opacity-80 hover:opacity-100'
              }`}
            >
              {subTab === 'approval' && (
                <span className="absolute top-3 right-3 w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping" />
              )}
              <span className="text-3xl sm:text-5xl font-black font-mono tracking-wider drop-shadow-md">{countApprovalDevices}</span>
              <span className="text-xs sm:text-sm font-bold font-cairo mt-2 text-amber-100">بانتظار موافقة العميل</span>
              <span className="text-[10px] text-amber-200 mt-1 opacity-70">الموافقة على تكلفة الصيانة</span>
            </button>

            {/* Clickable section 2: Waiting for Spare Parts */}
            <button
              onClick={() => {
                setSubTab('parts');
                setSearch('');
                setDecisions({});
              }}
              className={`flex flex-col items-center justify-center py-4 px-2 transition-all rounded-2xl relative cursor-pointer ${
                subTab === 'parts' 
                  ? 'bg-white/15 shadow-inner scale-[1.02]' 
                  : 'hover:bg-white/5 opacity-80 hover:opacity-100'
              }`}
            >
              {subTab === 'parts' && (
                <span className="absolute top-3 right-3 w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping" />
              )}
              <span className="text-3xl sm:text-5xl font-black font-mono tracking-wider drop-shadow-md">{countPartsDevices}</span>
              <span className="text-xs sm:text-sm font-bold font-cairo mt-2 text-amber-100">بانتظار قطع الغيار</span>
              <span className="text-[10px] text-amber-200 mt-1 opacity-70">تأمين المواد اللازمة</span>
            </button>
          </div>
        </div>
      </div>

      {/* Hero Stats */}
      <div className="bg-[#1a1a1a] rounded-3xl p-6 md:p-8 border border-white/5 shadow-2xl relative overflow-hidden flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="absolute top-0 right-0 w-40 h-40 bg-amber-500/10 rounded-full blur-3xl -translate-y-20 translate-x-10"></div>
        <div className="bg-black/40 border border-white/10 p-4 rounded-2xl w-full sm:w-auto text-center sm:min-w-[200px] z-10 flex gap-4 mr-0 ml-auto select-none">
          <div>
            <div className="text-xs text-amber-500 font-bold uppercase tracking-widest mb-1">
              {subTab === 'approval' ? 'فواتير بانتظار الموافقة' : 'فواتير بانتظار قطع الغيار'}
            </div>
            <div className="text-3xl font-black font-mono text-white">{pendingInvoices.length}</div>
          </div>
          <div className="w-px bg-white/10 mx-4"></div>
          <div>
            <div className="text-xs text-gray-400 font-bold uppercase tracking-widest mb-1">
              {subTab === 'approval' ? 'أجهزة بانتظار الموافقة' : 'أجهزة بانتظار قطع الغيار'}
            </div>
            <div className="text-3xl font-black font-mono text-white">{totalAwaitingDevices}</div>
          </div>
        </div>
      </div>

      {/* Search Input */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:w-80 font-sans">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
          <input 
            type="text" 
            placeholder="البحث باسم العميل أو رقم الهاتف..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#1a1a1a] border border-white/5 rounded-2xl pr-12 pl-4 py-3 focus:border-amber-500 outline-none transition-all text-sm text-right text-white"
          />
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-[#1a1a1a] rounded-3xl border border-white/5 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse text-sm">
            <thead className="bg-black/40 text-gray-400 text-xs uppercase tracking-wider border-b border-white/5 select-none">
              <tr>
                <th className="px-6 py-4 font-bold">رقم الفاتورة</th>
                <th className="px-6 py-4 font-bold">رقم العميل</th>
                <th className="px-6 py-4 font-bold">اسم العميل</th>
                <th className="px-6 py-4 font-bold">
                  {subTab === 'approval' ? 'عدد الأجهزة' : 'عدد الأجهزة المتبقية'}
                </th>
                <th className="px-6 py-4 font-bold text-center w-36">
                  {subTab === 'approval' ? 'تمت الموافقة' : 'توفرت القطع'}
                </th>
                <th className="px-6 py-4 font-bold text-center w-36">
                  {subTab === 'approval' ? 'لم يوافق' : 'لم تتوفر'}
                </th>
                <th className="px-6 py-4 font-bold text-center w-36">إجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {pendingInvoices.map(invoice => {
                const currentDecision = decisions[invoice.id || ''];
                const isLoading = rowLoading[invoice.id || ''];
                
                return (
                  <tr key={invoice.id} className="hover:bg-white/5 transition-colors duration-150">
                    <td className="px-6 py-4 font-mono text-white font-bold whitespace-nowrap">{invoice.invoiceNumber}</td>
                    <td className="px-6 py-4 font-mono text-gray-400 whitespace-nowrap">{getCustomerNumber(invoice.customerId)}</td>
                    <td className="px-6 py-4 font-bold text-white max-w-[200px] truncate whitespace-nowrap">{invoice.customerName}</td>
                    <td className="px-6 py-4 font-mono text-amber-400 font-bold whitespace-nowrap">{countEligibleDevices(invoice.invoiceNumber)}</td>
                    
                    {/* Circle choice column "تمت الموافقة" / "توفرت القطع" */}
                    <td className="px-6 py-4 text-center whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleToggleDecision(invoice.id!, 'approved')}
                        disabled={isLoading}
                        className={`w-7 h-7 rounded-full border-2 flex items-center justify-center mx-auto transition-all duration-200 cursor-pointer disabled:opacity-50 ${
                          currentDecision === 'approved'
                            ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                            : 'border-white/10 text-transparent hover:border-emerald-500/50 hover:bg-emerald-500/5'
                        }`}
                      >
                        <Check size={14} className={currentDecision === 'approved' ? 'opacity-100' : 'opacity-0'} />
                      </button>
                    </td>

                    {/* Circle choice column "لم يوافق" / "لم تتوفر" */}
                    <td className="px-6 py-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleDecision(invoice.id!, 'refused')}
                        disabled={isLoading}
                        className={`w-7 h-7 rounded-full border-2 flex items-center justify-center mx-auto transition-all duration-200 cursor-pointer disabled:opacity-50 ${
                          currentDecision === 'refused'
                            ? 'border-red-500 bg-red-500/20 text-red-500 shadow-[0_0_12px_rgba(239,68,68,0.3)]'
                            : 'border-white/10 text-transparent hover:border-red-500/50 hover:bg-red-500/5'
                        }`}
                      >
                        <Check size={14} className={currentDecision === 'refused' ? 'opacity-100 text-red-500' : 'opacity-0'} />
                      </button>
                    </td>

                    {/* Action button */}
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          type="button"
                          onClick={() => setActivePrintReportInvoice(invoice)}
                          title="عرض وطباعة تقرير الفحص الفني وعرض الأسعار"
                          className="p-2.5 rounded-xl bg-purple-600/10 hover:bg-purple-600 text-purple-400 hover:text-white transition-all cursor-pointer border border-purple-500/20 active:scale-95 group"
                        >
                          <Printer size={15} className="group-hover:rotate-6 transition-transform" />
                        </button>
                        <button 
                          onClick={() => subTab === 'approval' ? handleProcessActionBtn(invoice) : handleProcessPartsAction(invoice)}
                          disabled={isLoading}
                          className="px-4 py-2.5 rounded-xl text-xs font-black bg-amber-500 hover:bg-amber-600 text-black hover:scale-[1.03] active:scale-[0.97] cursor-pointer inline-flex items-center gap-1.5 shadow-md transition-all duration-200 disabled:opacity-50"
                        >
                          {isLoading ? (
                            <Loader2 className="animate-spin text-black" size={14} />
                          ) : (
                            <>
                              {currentDecision ? 'تنفيذ الإجراء السريع' : 'إجراء تفصيلي'}
                              <ArrowUpRight size={12} className="shrink-0 text-black rtl:-scale-x-100" />
                            </>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {pendingInvoices.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    {subTab === 'approval' 
                      ? 'لا توجد فواتير أو أجهزة بانتظار الموافقة حالياً.' 
                      : 'لا توجد فواتير أو أجهزة بانتظار قطع الغيار حالياً.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {activePrintReportInvoice && (() => {
        const inv = activePrintReportInvoice;
        
        const getConditionRank = (item: any) => {
          const report = (item.engineerReport || '').toLowerCase();
          const subStatus = (item.subStatus || '').toLowerCase();
          
          if (subStatus === 'intact' || report.includes('سليم') || report.includes('intact')) return 1;
          if (subStatus === 'unrepairable' || report.includes('لا يصلح') || report.includes('لايصلح') || report.includes('unrepairable')) return 2;
          return 0; // Maintenance
        };

        const invItems = items
          .filter(it => it.invoiceNumber === inv.invoiceNumber)
          .sort((a, b) => {
            const typeA = a.deviceType || '';
            const typeB = b.deviceType || '';
            const typeCompare = typeA.localeCompare(typeB, 'ar');
            if (typeCompare !== 0) return typeCompare;
            
            const nameA = a.deviceName || '';
            const nameB = b.deviceName || '';
            const nameCompare = nameA.localeCompare(nameB, 'ar');
            if (nameCompare !== 0) return nameCompare;
            
            return getConditionRank(a) - getConditionRank(b);
          });
          
        const totalCostVal = invItems.reduce((sum, item) => sum + (Number(item.cost || item.unitCost || 0) * (item.quantity || 1)), 0);
        const currencyVal = inv.currency || 'USD';
        const customerPhone = getCustomerPhone(inv.customerId) || 'غير متوفر';
        const customerCompany = getCustomerCompany(inv.customerId) || 'غير متوفر';

        return (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[999] overflow-y-auto flex items-start justify-center p-2 sm:p-6 md:p-8 font-sans print:p-0 print:bg-white print:relative" dir="rtl">
            <div className="bg-[#141414] border border-white/10 w-full max-w-4xl rounded-3xl overflow-hidden shadow-2xl flex flex-col my-4 print:border-0 print:my-0 print:shadow-none print:bg-white">
              
              {/* Buttons / Controls hidden during print */}
              <div className="flex items-center justify-between p-4 bg-black/50 border-b border-white/5 print:hidden flex-wrap gap-4 select-none">
                <div className="flex items-center gap-2">
                  <button 
                    type="button"
                    onClick={() => setActivePrintReportInvoice(null)}
                    className="px-4 py-2 bg-slate-200 border border-slate-300 rounded-xl text-slate-900 hover:bg-slate-300 font-bold transition-all flex items-center gap-2 text-sm shadow-md"
                  >
                    <ArrowLeft size={16} className="rtl:rotate-180" />
                    العودة للتعديل
                  </button>
                  <span className="text-sm font-bold text-white hidden sm:block">معاينة وتجهيز وعرض سعر العميل</span>
                </div>

                <div className="flex items-center gap-2">
                  {/* Native Print button */}
                  <button 
                    type="button"
                    onClick={handlePrintDirect}
                    className="px-4 py-2.5 rounded-xl text-xs font-black bg-white hover:bg-gray-100 text-black flex items-center gap-2 shadow-md hover:scale-[1.03] active:scale-[0.97] transition-all cursor-pointer border border-white/20"
                  >
                    <Printer size={16} />
                    طباعة فورية
                  </button>

                  {/* WhatsApp Export button */}
                  <button 
                    type="button"
                    onClick={() => handleExportPDFAndWhatsApp(inv)}
                    disabled={isGeneratingPDF}
                    className="px-4 py-2.5 rounded-xl text-xs font-black bg-emerald-500 hover:bg-emerald-600 text-white flex items-center gap-2 shadow-md hover:scale-[1.03] active:scale-[0.97] transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isGeneratingPDF ? (
                      <>
                        <Loader2 className="animate-spin" size={16} />
                        جاري التصدير...
                      </>
                    ) : (
                      <>
                        <WhatsAppIcon className="w-5 h-5 text-white" />
                        إرسال للواتس اب وتنزيل PDF
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Printable Section Box */}
              <div className="overflow-x-auto w-full pb-4">
                <div id="print-report-area" className="p-8 bg-white text-gray-900 print:p-0 print:bg-white print:text-black w-[794px] min-h-fit mx-auto">
                    {/* Header Layout */}
                    <div className="flex justify-between items-start border-b-2 border-gray-900 pb-4 mb-4">
                      {/* Right Corner: Shop Name */}
                      <div className="text-right flex-1 pt-1">
                        <h2 className="text-xl font-black text-gray-900 tracking-tight leading-tight font-cairo whitespace-nowrap">{shopConfig?.shopName || 'عالم الصيانة والتجارة'}</h2>
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
                      <h1 className="text-lg font-black text-gray-900 tracking-tight border-2 border-gray-900 px-4 py-1.5 rounded-lg inline-block bg-gray-50/50">عرض سعر صيانة أجهزة</h1>
                    </div>

                    {/* Left Corner: Invoice Info */}
                    <div className="text-left flex-1 space-y-1 pt-1 bg-gray-50/50 p-3 rounded-lg border border-gray-200">
                      <div className="text-sm font-bold text-gray-700 flex justify-between gap-4">
                        <span>رقم التقرير:</span>
                        <span className="font-mono text-gray-900">{inv.invoiceNumber}</span>
                      </div>
                      <div className="text-sm font-bold text-gray-700 flex justify-between gap-4">
                        <span>التاريخ:</span>
                        <span className="font-mono text-gray-900">{inv.createdAt ? (function(){ const d = new Date(inv.createdAt.seconds ? inv.createdAt.seconds * 1000 : (inv.createdAt?.toDate ? inv.createdAt.toDate() : inv.createdAt)); return isNaN(d.getTime()) ? '---' : d.toISOString().slice(0,10).replace(/-/g, '/'); })() : '---'}</span>
                      </div>
                      <div className="text-sm font-bold text-gray-700 flex justify-between gap-4">
                        <span>وقت الإصدار:</span>
                        <span className="font-mono text-gray-900">
                          {inv.createdAt ? (function(){ 
                            const d = new Date(inv.createdAt.seconds ? inv.createdAt.seconds * 1000 : (inv.createdAt?.toDate ? inv.createdAt.toDate() : inv.createdAt)); 
                            return isNaN(d.getTime()) ? '---' : d.toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit' }); 
                          })() : new Date().toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="text-sm font-bold text-gray-700 flex justify-between gap-4 border-t border-gray-200 pt-1 mt-1 font-cairo">
                        <span>المستخدم:</span>
                        <span className="font-mono text-gray-900">1</span>
                      </div>
                    </div>
                  </div>

                  {/* Customer Info Single Line */}
                  <div className="bg-gray-100 p-3 rounded-lg mb-4 border border-gray-300 flex justify-between items-center px-6">
                    <div className="text-sm font-black text-gray-900">
                      <span className="text-xs text-gray-600 ml-2">إسم العميل:</span>
                      {inv.customerName}
                    </div>
                    <div className="text-sm font-bold text-gray-900 border-r border-gray-300 pr-6">
                      <span className="text-xs text-gray-600 ml-2">الجهة:</span>
                      {customerCompany && customerCompany !== '---' ? customerCompany : '---'}
                    </div>
                    <div className="text-sm font-bold text-gray-900 border-r border-gray-300 pr-6" dir="ltr">
                      <span className="text-xs text-gray-600 ml-2 font-sans">تلفون/جوال:</span>
                      <span className="font-mono">{customerPhone}</span>
                    </div>
                  </div>

                  {/* Device Detailed Items Table */}
                  <div className="border border-gray-400 overflow-hidden mb-4 rounded-md">
                    <table className="w-full text-right border-collapse text-sm">
                      <thead className="bg-gray-100 text-gray-800 font-bold border-b-2 border-gray-400">
                        <tr>
                          <th className="px-3 py-3 text-center w-12 border-l border-gray-400 bg-gray-200/50">مسلسل</th>
                          <th className="px-3 py-3 border-l border-gray-400">النوع/الجهاز</th>
                          <th className="px-3 py-3 border-l border-gray-400">تقرير الفحص</th>
                          <th className="px-3 py-3 text-center border-l border-gray-400 w-28">تكلفة الصيانة</th>
                          <th className="px-3 py-3 text-center border-l border-gray-400 w-24">العدد</th>
                          <th className="px-3 py-3 text-center w-32 font-black bg-gray-200/50">اجمالي التكلفة</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-300">
                        {invItems.map((item, idx) => {
                          const itemQty = Number(item.quantity || 1);
                          const totalItemCost = Number(item.cost || 0);
                          const unitItemCost = item.unitCost || (itemQty > 0 ? totalItemCost / itemQty : 0);
                          
                          return (
                            <tr key={item.id} className="even:bg-gray-50/50">
                              <td className="px-3 py-3 text-center font-mono font-bold border-l border-gray-400 bg-gray-50">{idx + 1}</td>
                              <td className="px-3 py-3 font-bold text-gray-900 border-l border-gray-400 leading-relaxed">
                                {item.deviceType} {item.deviceName ? `- ${item.deviceName}` : ''}
                              </td>
                              <td className="px-3 py-3 text-gray-800 leading-relaxed border-l border-gray-400 whitespace-nowrap overflow-hidden max-w-[200px] text-ellipsis">
                                {item.engineerReport || item.faultType || 'قيد المعاينة والمراجعة'}
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
                        {/* Last row for totals */}
                        <tr className="bg-gray-200/60 font-bold border-t-2 border-gray-400">
                          <td colSpan={4} className="px-3 py-4 text-left font-black border-l border-gray-400 text-base">الإجمالي</td>
                          <td className="px-3 py-4 text-center font-mono font-black border-l border-gray-400 text-lg">
                            {invItems.reduce((sum, item) => sum + Number(item.quantity || 1), 0)}
                          </td>
                          <td className="px-3 py-4 text-center font-mono font-black text-xl text-gray-900">
                            {invItems.reduce((sum, item) => sum + Number(item.cost || 0), 0).toLocaleString('en-US')} <span className="text-sm font-sans mr-1">{currencyVal}</span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Summary Devices Status */}
                  {(() => {
                    const counters = [
                      {
                        key: 'maintenance',
                        label: 'صيانة',
                        value: invItems.filter(i => i.subStatus !== 'unrepairable' && i.subStatus !== 'intact' && i.subStatus !== 'refused' && i.subStatus !== 'no_parts' && i.subStatus !== 'parts_not_available').reduce((sum, i) => sum + Number(i.quantity || 1), 0),
                        textColor: 'text-gray-900',
                      },
                      {
                        key: 'unrepairable',
                        label: 'لايصلح',
                        value: invItems.filter(i => i.subStatus === 'unrepairable').reduce((sum, i) => sum + Number(i.quantity || 1), 0),
                        textColor: 'text-rose-600',
                      },
                      {
                        key: 'intact',
                        label: 'سليم',
                        value: invItems.filter(i => i.subStatus === 'intact').reduce((sum, i) => sum + Number(i.quantity || 1), 0),
                        textColor: 'text-emerald-600',
                      },
                      {
                        key: 'refused',
                        label: 'لم يوافق العميل',
                        value: invItems.filter(i => i.subStatus === 'refused').reduce((sum, i) => sum + Number(i.quantity || 1), 0),
                        textColor: 'text-orange-600',
                      },
                      {
                        key: 'no_parts',
                        label: 'عدم توفر قطع',
                        value: invItems.filter(i => i.subStatus === 'no_parts' || i.subStatus === 'parts_not_available').reduce((sum, i) => sum + Number(i.quantity || 1), 0),
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

                  <div className="border-t-2 border-gray-900 my-8"></div>

                  {/* Footer Notes & Signatures - New Layout */}
                  <div className="flex justify-between items-start text-xs font-bold text-gray-900 leading-loose mb-6 px-4">
                    {/* Right Side */}
                    <div className="text-right space-y-1">
                        <p>نرجو منكم الرد خلال 24 ساعة كحد أقصى</p>
                        <p className="pt-6 font-black">توقيع العميل بالموافقة / ........................................</p>
                    </div>

                    {/* Left Side */}
                    <div className="text-left space-y-1">
                        <p className="pt-8">اسم المهندس المختص / <span className="font-bold border-b border-dashed px-4">{invItems.find(i => i.technician)?.technician || '................'}</span> التوقيع /.............</p>
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

                  <BankAccountsFooter shopConfig={shopConfig} currentOutput={currentOutput || { output_datetime: new Date() }} />
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { collection, onSnapshot, query, orderBy, doc, getDoc, setDoc, updateDoc, writeBatch, serverTimestamp } from '../firebase';
import { db } from '../firebase';
import { User, Phone, Smartphone, AlertTriangle, CheckCircle, Package, ArrowLeft, ArrowUpRight, Search, FileText, ChevronLeft, Eye, Clock, DollarSign, X, Users, ArrowUpDown, Plus, Edit2, Check, Building, Mail, Printer, UserPlus, MessageCircle, MapPin, Facebook } from 'lucide-react';
import { Customer, Invoice, InvoiceItem, User as SystemUser } from '../types';
import BankAccountsFooter from './BankAccountsFooter';
import { useTranslation } from 'react-i18next';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Filesystem, Directory } from '@capacitor/filesystem';

const WhatsAppIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M12.012 2c-5.506 0-9.978 4.471-9.978 9.978 0 1.764.459 3.42 1.258 4.873L2 22l5.312-1.393c1.405.766 3 1.18 4.7 1.18 5.506 0 9.978-4.472 9.978-9.978C21.99 6.471 17.518 2 12.012 2zm6.331 14.161c-.244.686-1.22 1.258-1.687 1.341-.468.084-.935.152-2.903-.631-2.479-.982-4.053-3.522-4.175-3.69-.122-.167-.991-1.319-.991-2.518 0-1.199.631-1.787.854-2.028.223-.241.488-.302.65-.302.162 0 .325.003.467.01.147.007.345-.057.545.421.203.488.691 1.687.752 1.809.061.122.102.264.02.427-.081.162-.122.264-.244.407-.122.142-.256.319-.366.427-.122.122-.249.255-.107.498.142.244.631 1.036 1.354 1.678.932.827 1.714 1.082 1.957 1.204.244.122.386.102.528-.061.142-.162.61-2.008.772-2.313.162-.305.325-.244.548-.162.223.081 1.423.671 1.667.793.244.122.406.183.467.284.061.104.061.59-.183 1.277z" />
  </svg>
);

export default function Customers({ user, onBack }: { user: SystemUser; onBack?: () => void }) {
  const { t } = useTranslation();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [showStatementModal, setShowStatementModal] = useState(false);
  const [showPrintOptions, setShowPrintOptions] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [shopConfig, setShopConfig] = useState<any>(null);
  const [currentOutput, setCurrentOutput] = useState<any>(null);

  // Search/Autocomplete State
  const [search, setSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  // Selected state
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [activeCustomerTab, setActiveCustomerTab] = useState<'details' | 'statement' | 'log' | 'menu'>('menu');
  const [showPreview, setShowPreview] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // "Add Customer" panel states
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [addName, setAddName] = useState('');
  const [addCompanyName, setAddCompanyName] = useState('');
  const [addPhone1, setAddPhone1] = useState('');
  const [addPhone2, setAddPhone2] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addNotes, setAddNotes] = useState('');
  const [isAddingInProcess, setIsAddingInProcess] = useState(false);

  // "Edit Customer Info" states
  const [isEditingMode, setIsEditingMode] = useState(false);
  const [editPhone1, setEditPhone1] = useState('');
  const [editPhone2, setEditPhone2] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [isSavingInProcess, setIsSavingInProcess] = useState(false);

  const nextCustomerNumber = Math.max(0, ...customers.map(c => Number(c.customerNumber) || 0)) + 1;

  const isAddFormValid = addName.trim() !== '' && addPhone1.trim() !== '';

  const handleAddCustomer = async () => {
    if (!isAddFormValid) return;
    setIsAddingInProcess(true);
    try {
      const nextNum = Math.max(0, ...customers.map(c => Number(c.customerNumber) || 0)) + 1;
      const settingsRef = doc(db, 'settings', 'app');
      const settingsDoc = await getDoc(settingsRef);
      let sysNextNum = nextNum;
      if (settingsDoc.exists()) {
        const lastCustNum = Number(settingsDoc.data()?.lastCustomerNumber) || 0;
        sysNextNum = Math.max(nextNum, lastCustNum + 1);
      }

      const batch = writeBatch(db);
      const customerRef = doc(collection(db, 'customers'));
      
      const newCustomerData = {
        name: addName.trim(),
        companyName: addCompanyName.trim(),
        phone1: addPhone1.trim(),
        phone2: addPhone2.trim(),
        email: addEmail.trim(),
        notes: addNotes.trim(),
        customerNumber: sysNextNum,
        createdAt: serverTimestamp()
      };

      batch.set(customerRef, newCustomerData);
      batch.set(settingsRef, { lastCustomerNumber: sysNextNum }, { merge: true });

      await batch.commit();

      // Reset
      setAddName('');
      setAddCompanyName('');
      setAddPhone1('');
      setAddPhone2('');
      setAddEmail('');
      setAddNotes('');
      setShowAddCustomer(false);

      // Auto select newly created customer
      selectCustomer({ id: customerRef.id, ...newCustomerData } as any);
    } catch (err) {
      console.error("Error adding customer:", err);
    } finally {
      setIsAddingInProcess(false);
    }
  };

  // Load Customers, Invoices, and Invoice Items in real-time
  useEffect(() => {
    const unsubscribeCustomers = onSnapshot(query(collection(db, 'customers'), orderBy('name', 'asc')), (snapshot) => {
      setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
    });

    const unsubscribeInvoices = onSnapshot(collection(db, 'invoices'), (snapshot) => {
      setInvoices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Invoice)));
    });

    const unsubscribeItems = onSnapshot(collection(db, 'invoice_items'), (snapshot) => {
      setItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InvoiceItem)));
    });

    const unsubscribeTransactions = onSnapshot(collection(db, 'vault_transactions'), (snapshot) => {
      setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    getDoc(doc(db, 'settings', 'shop')).then((snap) => {
      if (snap.exists()) {
        setShopConfig(snap.data() as any);
      }
    });

    return () => {
      unsubscribeCustomers();
      unsubscribeInvoices();
      unsubscribeItems();
      unsubscribeTransactions();
    };
  }, []);

  // Filter suggestion results
  const suggestions = search.trim() === '' ? [] : customers.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone1.includes(search) || (c.phone2 && c.phone2.includes(search))
  ).slice(0, 10);

  // Handlers for selection
  const selectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setActiveCustomerTab('menu');
    setSearch(customer.name);
    setShowDropdown(false);
    setShowPreview(false); // Reset preview on brand-new selection
    setIsEditingMode(false); // Reset edit mode
    setEditPhone1(customer.phone1 || '');
    setEditPhone2(customer.phone2 || '');
    setEditEmail(customer.email || '');
    setEditNotes(customer.notes || '');
  };

  const handleUpdateCustomer = async () => {
    if (!selectedCustomer || !selectedCustomer.id) return;
    const isEditFormValid = editPhone1.trim() !== '';
    if (!isEditFormValid) return;
    
    setIsSavingInProcess(true);
    try {
      const customerRef = doc(db, 'customers', selectedCustomer.id);
      const updatedFields = {
        phone1: editPhone1.trim(),
        phone2: editPhone2.trim(),
        email: editEmail.trim(),
        notes: editNotes.trim(),
      };
      
      await updateDoc(customerRef, updatedFields);
      
      // Update local states
      const updatedCust = {
        ...selectedCustomer,
        ...updatedFields
      };
      setSelectedCustomer(updatedCust);
      
      // Also update in-memory customers list
      setCustomers(prev => prev.map(c => c.id === selectedCustomer.id ? updatedCust : c));
      
      setIsEditingMode(false);
    } catch (err) {
      console.error("Error updating customer:", err);
    } finally {
      setIsSavingInProcess(false);
    }
  };

  const getInvoiceActualCost = (invoiceItems: InvoiceItem[]) => {
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

  const getCustomerCurrencyLabel = (customerId: string) => {
    const customerInvs = invoices.filter(inv => inv.customerId === customerId);
    const currencies = Array.from(new Set(customerInvs.map(inv => inv.currency || 'USD')));
    if (currencies.length === 0) return 'USD';
    return currencies.join(' / ');
  };

  // Calculations for selected customer
  const getCustomerRemainingDevices = (customerId: string) => {
    // outstanding devices: items state not delivered and not '60'
    return items.filter(it => 
      (it.customerId === customerId || invoices.some(inv => inv.customerId === customerId && inv.invoiceNumber === it.invoiceNumber)) && 
      it.status !== 'delivered' && it.status !== '60'
    ).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  };

  const getCustomerOutstandingAmount = (customerId: string) => {
    const customerInvs = invoices.filter(inv => inv.customerId === customerId);
    return customerInvs.reduce((sum, inv) => {
      const invItems = items.filter(it => it.invoiceNumber === inv.invoiceNumber);
      const actualCost = getInvoiceActualCost(invItems);
      return sum + Math.max(0, actualCost - Number(inv.amountPaid || 0));
    }, 0);
  };

  const getCustomerTotalCost = (customerId: string) => {
    const customerInvs = invoices.filter(inv => inv.customerId === customerId);
    return customerInvs.reduce((sum, inv) => {
      const invItems = items.filter(it => it.invoiceNumber === inv.invoiceNumber);
      return sum + getInvoiceActualCost(invItems);
    }, 0);
  };

  const getCustomerTotalPaid = (customerId: string) => {
    const customerInvs = invoices.filter(inv => inv.customerId === customerId);
    const invoicesPaid = customerInvs.reduce((sum, inv) => sum + Number(inv.amountPaid || 0), 0);
    
    // Add separate collections (receipt transactions)
    const separateReceipts = transactions
      .filter(tx => tx.customerId === customerId && tx.type === 'receipt')
      .reduce((sum, tx) => sum + Math.abs(Number(tx.amount || 0)), 0);

    // Subtract separate payments (payment transactions)
    const separatePayments = transactions
      .filter(tx => tx.customerId === customerId && tx.type === 'payment')
      .reduce((sum, tx) => sum + Math.abs(Number(tx.amount || 0)), 0);

    return invoicesPaid + separateReceipts - separatePayments;
  };

  // Generate statement entries chronologically for Selected Customer
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
          label: tx.notes || 'سند قبض مالي مستقل',
          reference: String(tx.voucherNumber || tx.id?.substring(0, 5)).replace(/#/g, ''),
          notes: 'مقبوضات نقدية مستقلة مسجلة بالخزينة',
          debit: 0,
          credit: Math.abs(Number(tx.amount || 0))
        });
      } else if (tx.type === 'payment') {
        entries.push({
          id: `tx-${tx.id}`,
          date: txDate,
          type: 'سند صرف',
          label: tx.notes || 'سند صرف للعميل مستقل',
          reference: String(tx.voucherNumber || tx.id?.substring(0, 5)).replace(/#/g, ''),
          notes: 'صرف مالي أو استرجاع نقدي للعميل',
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
      
      // Calculate realistic height based on scale width vs height ratio (design element assumes 800 width)
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

      // 2. Prepare the PDF Base64 & save in database folder and sqlite saved_pdfs
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
        const { localDb } = await import('../lib/local-db');
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

      // Download standard desktop ledger
      pdf.save(filename);

      // 3. Launch WhatsApp link or Native Share
      const totalCost = getCustomerTotalCost(customerId);
      const totalPaid = getCustomerTotalPaid(customerId);
      const diff = totalCost - totalPaid;
      const currency = getCustomerCurrencyLabel(customerId);

      let statusText = '';
      if (diff < -0.01) {
        statusText = `رصيد دائن للعميل بفائض: ${Math.abs(diff).toLocaleString()} ${currency}`;
      } else if (diff > 0.01) {
        statusText = `متبقي عليه كديون متراكمة: ${Math.abs(diff).toLocaleString()} ${currency}`;
      } else {
        statusText = `الحساب متزن بالكامل (0.00)`;
      }

      let message = `*كشف مالي رسمي وموحد بصيغة PDF* 📄\n\n`;
      message += `عزيزي العميل *${cust.name}*،\n`;
      message += `تجدون أدناه ملخصاً مالياً بالعمليات والدفوعات المسجلة لصيانتكم. كما تم تنزيل وحفظ مستند الـ PDF للتقرير في مجلد قاعدة البيانات.\n\n`;
      message += `- *الرصيد الصافي:* ${statusText}\n`;
      message += `- *إجمالي مستحقات الصيانة:* ${totalCost.toLocaleString()} ${currency}\n`;
      message += `- *إجمالي السندات والمقبوضات:* ${totalPaid.toLocaleString()} ${currency}\n\n`;
      message += `يرجى مشاركة وإرسال كشف مستند الـ PDF المحفوظ الآن بنجاح على جهازكم.`;

      // Native Share API if supported (to attach actual PDF sheet on mobile)
      let sharedNatively = false;
      try {
        if (navigator.share && navigator.canShare) {
          const pdfBlob = pdf.output('blob');
          const file = new File([pdfBlob], filename, { type: 'application/pdf' });
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: filename,
              text: message,
            });
            sharedNatively = true;
          }
        }
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

  // Selected customer invoices
  const customerInvoices = selectedCustomer 
    ? invoices.filter(inv => inv.customerId === selectedCustomer.id)
              .sort((a, b) => Number(b.invoiceNumber || 0) - Number(a.invoiceNumber || 0))
    : [];

  // Sorting/Filter controls
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [filterType, setFilterType] = useState<'alpha' | 'date' | 'debt'>('alpha');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Pagination controls
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  // Filtered and sorted list of all customers
  const getProcessedCustomers = () => {
    let list = customers.filter(c => 
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone1.includes(search) || (c.phone2 && c.phone2.includes(search))
    );
    
    // Process Sort/Filter
    list.sort((a, b) => {
      if (filterType === 'alpha') {
        return sortDir === 'asc' 
          ? a.name.localeCompare(b.name, 'ar') 
          : b.name.localeCompare(a.name, 'ar');
      } else if (filterType === 'date') {
        const dateA = a.createdAt ? (typeof a.createdAt.toDate === 'function' ? a.createdAt.toDate().getTime() : new Date(a.createdAt).getTime()) : 0;
        const dateB = b.createdAt ? (typeof b.createdAt.toDate === 'function' ? b.createdAt.toDate().getTime() : new Date(b.createdAt).getTime()) : 0;
        return sortDir === 'asc' ? dateA - dateB : dateB - dateA;
      } else if (filterType === 'debt') {
        const debtA = getCustomerOutstandingAmount(a.id!);
        const debtB = getCustomerOutstandingAmount(b.id!);
        return sortDir === 'asc' ? debtA - debtB : debtB - debtA;
      }
      return 0;
    });

    return list;
  };

  const setFilterAndSort = (type: 'alpha' | 'date' | 'debt', dir: 'asc' | 'desc') => {
    setFilterType(type);
    setSortDir(dir);
    setShowFilterDropdown(false);
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
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'parts_not_available':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      case '40':
      case 'repairing':
        return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
      case '50':
      case 'ready':
      case 'intact':
      case 'unrepairable':
      case 'refused':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case '60':
      case 'delivered':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
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

  const allProcessedCustomers = getProcessedCustomers();
  const totalPages = Math.max(1, Math.ceil(allProcessedCustomers.length / itemsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const currentCustomers = allProcessedCustomers.slice((safeCurrentPage - 1) * itemsPerPage, safeCurrentPage * itemsPerPage);

  return (
    <div className="text-right -mx-4 md:-mx-8 pb-24 md:pb-6" dir="rtl">
      {/* Sleek, Full-Width Page Header */}
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
          <h1 className="text-lg font-black text-white m-0 p-0">{t('common.customers', 'العملاء')}</h1>
        </div>
      </div>


      {/* Add Customer Form Panel */}
      {showAddCustomer && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="bg-[#121212] border border-orange-500/20 rounded-3xl p-6 md:p-8 space-y-6 shadow-2xl relative overflow-hidden"
        >
          {/* Background decoration */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-orange-600/5 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-orange-600/10 text-orange-500 rounded-xl border border-orange-500/15">
                <Users size={18} />
              </div>
              <div>
                <h2 className="text-sm font-black font-cairo text-white">إضافة عميل جديد في النظام</h2>
                <p className="text-[10px] text-gray-400 font-bold mt-1">املاً البيانات الأساسية لإنشاء العميل وتهيئته لاستقبال الفواتير والمعاملات المالية بقيم صفرية</p>
              </div>
            </div>
            
            <button
              onClick={() => setShowAddCustomer(false)}
              className="p-1 px-2.5 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white font-black text-xs font-cairo rounded-lg transition-all"
            >
              إغلاق
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6" dir="rtl">
            {/* 1. Customer Number (Auto, Disabled) */}
            <div className="space-y-2 text-right">
              <label className="text-[11px] font-bold text-gray-400 block font-cairo">رقم العميل المولد تلقائياً:</label>
              <input
                type="text"
                value={`# ${nextCustomerNumber}`}
                disabled
                className="w-full bg-white/[0.02] border border-white/5 rounded-2xl px-4 py-3 text-sm font-mono text-gray-500 text-right cursor-not-allowed font-bold"
              />
            </div>

            {/* 2. Customer Name (Required) */}
            <div className="space-y-2 text-right">
              <label className="text-[11px] font-bold text-gray-400 block font-cairo">اسم العميل <span className="text-orange-500 font-extrabold">* (إلزامي)</span>:</label>
              <input
                type="text"
                placeholder="مثال: محمد أحمد علي..."
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 focus:border-orange-500 outline-none transition-all text-sm font-bold text-white text-right font-cairo"
              />
            </div>

            {/* 3. Company Name (Optional) */}
            <div className="space-y-2 text-right">
              <label className="text-[11px] font-bold text-gray-400 block font-cairo">اسم الجهة أو الشركة (اختياري):</label>
              <input
                type="text"
                placeholder="مثال: شركة البرمجيات المتحدة..."
                value={addCompanyName}
                onChange={(e) => setAddCompanyName(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 focus:border-orange-500 outline-none transition-all text-sm font-bold text-white text-right font-cairo"
              />
            </div>

            {/* 4. Main Phone (Required with 'No Phone' option) */}
            <div className="space-y-2 text-right">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-gray-400 block font-cairo">رقم الهاتف الرئيسي <span className="text-orange-500 font-extrabold">* (أساسي)</span>:</label>
                <button
                  type="button"
                  onClick={() => setAddPhone1('لا يوجد')}
                  className="px-2 py-0.5 bg-orange-600/10 hover:bg-orange-600/20 text-orange-400 rounded-lg text-[9px] font-black font-cairo transition-all border border-orange-500/15"
                >
                  تخطي لا يوجد
                </button>
              </div>
              <input
                type="text"
                placeholder="أدخل رقم الجوال أو الهاتف الرئيسي..."
                value={addPhone1}
                onChange={(e) => setAddPhone1(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 focus:border-orange-500 outline-none transition-all text-sm font-bold text-white text-right font-mono"
              />
            </div>

            {/* 5. Secondary Phone (Optional) */}
            <div className="space-y-2 text-right">
              <label className="text-[11px] font-bold text-gray-400 block font-cairo">رقم هاتف ثانوي (اختياري):</label>
              <input
                type="text"
                placeholder="أدخل رقم الجوال الإضافي (إن وجد)..."
                value={addPhone2}
                onChange={(e) => setAddPhone2(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 focus:border-orange-500 outline-none transition-all text-sm font-bold text-white text-right font-mono"
              />
            </div>

            {/* 6. Email (Optional) */}
            <div className="space-y-2 text-right">
              <label className="text-[11px] font-bold text-gray-400 block font-cairo">البريد الإلكتروني (اختياري):</label>
              <input
                type="email"
                placeholder="customer@domain.com"
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 focus:border-orange-500 outline-none transition-all text-sm font-bold text-white text-right font-mono"
              />
            </div>

            {/* 7. Details / Notes (Optional) */}
            <div className="space-y-2 md:col-span-2 text-right">
              <label className="text-[11px] font-bold text-gray-400 block font-cairo">تفاصيل وملاحظات إضافية عن العميل (اختياري):</label>
              <textarea
                placeholder="اكتب أية تفاصيل خاصة بالدفع، العنوان، أو شروحات إضافية..."
                value={addNotes}
                onChange={(e) => setAddNotes(e.target.value)}
                rows={3}
                className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 focus:border-orange-500 outline-none transition-all text-sm font-bold text-slate-200 text-right font-cairo resize-none"
              />
            </div>
          </div>

          {/* Form CTA Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/5">
            <button
              type="button"
              onClick={() => setShowAddCustomer(false)}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-gray-400 hover:text-white font-black font-cairo text-xs transition-all"
            >
              إلغاء التراجع
            </button>
            <button
              type="button"
              disabled={!isAddFormValid || isAddingInProcess}
              onClick={handleAddCustomer}
              className={`px-5 py-2.5 font-black font-cairo text-xs rounded-xl transition-all shadow-lg flex items-center gap-2 border ${
                isAddFormValid && !isAddingInProcess
                  ? 'bg-orange-600 hover:bg-orange-500 text-white border-orange-600 hover:shadow-orange-600/15'
                  : 'bg-white/[0.02] text-gray-500 border-white/5 cursor-not-allowed shadow-none'
              }`}
            >
              {isAddingInProcess ? (
                <span>جاري الحفظ والتهيئة...</span>
              ) : (
                <>
                  <Check size={14} />
                  <span>تنفيذ إضافة العميل</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      )}

      {/* Smart Search Panel */}
      {(!selectedCustomer || activeCustomerTab === 'menu') && (
        <div className="customers-box bg-[#1a1a1a] border-y border-white/5 mx-0 my-0 relative">
          <div className="flex items-center gap-3 px-4 py-3">
          
          {/* 1. Name Autocomplete Search */}
          <div className="flex-1 space-y-1 relative">
            <label className="text-[10px] font-bold text-gray-500 block">البحث باسم العميل أو رقم الهاتف:</label>
            <div className="relative">
              <input
                type="text"
                placeholder="ابدأ بكتابة اسم العميل أو الهاتف..."
                value={search}
                onFocus={() => {
                  setShowDropdown(true);
                }}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setShowDropdown(true);
                  if (selectedCustomer && e.target.value !== selectedCustomer.name) {
                    setSelectedCustomer(null);
                    setShowPreview(false);
                  }
                }}
                className="w-full bg-black/40 border border-white/10 rounded-2xl pl-4 pr-11 py-3.5 focus:border-orange-500 outline-none transition-all text-sm font-bold text-white text-right"
              />
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
              
              {search && (
                <button 
                  onClick={() => {
                    setSearch('');
                    setSelectedCustomer(null);
                    setShowPreview(false);
                  }}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Suggestions panel */}
            {showDropdown && suggestions.length > 0 && (
              <div className="customers-dropdown absolute z-50 left-0 right-0 mt-2 bg-[#1f1f1f] border border-white/10 rounded-2xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto">
                <div className="p-2 text-[10px] text-gray-500 border-b border-white/5 bg-black/20 font-bold">نتائج البحث في النظام:</div>
                {suggestions.map((cust) => (
                  <button
                    key={cust.id}
                    onClick={() => selectCustomer(cust)}
                    className="w-full text-right px-4 py-3 text-xs hover:bg-orange-600 hover:text-white text-slate-300 transition-all border-b border-white/[0.02] flex items-center justify-between"
                  >
                    <span className="font-bold">{cust.name}</span>
                    <span className="font-mono text-[10px] text-gray-500 group-hover:text-white">#{cust.customerNumber || '---'}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Add Customer Button */}
          <div className="relative">
            <button
              onClick={() => {
                setShowAddCustomer(!showAddCustomer);
                setSelectedCustomer(null);
              }}
              className="p-3 bg-orange-600/10 hover:bg-orange-600 border border-orange-600/20 text-orange-500 hover:text-white rounded-xl transition-all shadow-lg hover:shadow-orange-600/20"
              title="إضافة عميل جديد"
            >
              <UserPlus size={20} />
            </button>
          </div>

        </div>

        {/* Global Click Closes Dropdowns */}
        {showDropdown && (
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => {
              setShowDropdown(false);
            }} 
          />
        )}
      </div>
      )}

      {/* Customer Action Modal */}
      {selectedCustomer && activeCustomerTab === 'menu' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="customer-modal-bg bg-[#141414] border border-white/10 rounded-3xl w-full max-w-sm p-6 space-y-4 shadow-2xl relative text-right">
             <div className="flex items-center justify-between mb-4">
               <h2 className="text-lg font-black text-white">{selectedCustomer.name}</h2>
               <button
                  onClick={() => {
                    setSelectedCustomer(null);
                    setSearch('');
                  }}
                  className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-gray-400"
                >
                  <X size={18} />
                </button>
             </div>
             
             <div className="grid grid-cols-1 gap-3">
              <button onClick={() => setShowDetailsModal(true)} className="w-full text-right p-4 bg-orange-600/10 hover:bg-orange-600/20 text-orange-400 rounded-2xl font-bold flex items-center justify-between border border-orange-500/10">
                <span>بيانات العميل</span>
                <ChevronLeft size={18} />
              </button>
              <button onClick={() => setShowStatementModal(true)} className="w-full text-right p-4 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-bold flex items-center justify-between border border-white/5">
                <span>كشف حساب</span>
                <ChevronLeft size={18} />
              </button>
              <button onClick={() => setShowLogModal(true)} className="w-full text-right p-4 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-bold flex items-center justify-between border border-white/5">
                <span>سجل العميل</span>
                <ChevronLeft size={18} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Details Panel (Only displayed when a category is selected) */}
      {selectedCustomer && activeCustomerTab !== 'menu' && (
        <div className="customers-details-card bg-[#121212] border border-white/5 rounded-3xl p-6 relative group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-orange-600/5 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex items-center justify-between gap-4 mb-6">
            <h2 className="text-sm font-black text-white flex items-center gap-2">
              <User size={16} className="text-orange-500"/>
              <span>{selectedCustomer.name}</span>
            </h2>
            <button
               onClick={() => setActiveCustomerTab('menu')}
               className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-[10px] text-gray-400 font-bold transition-all flex items-center gap-1"
             >
               <ChevronLeft size={14} className="rtl:rotate-180" /> العودة للقائمة
             </button>
          </div>

          {activeCustomerTab === 'details' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* COLUMN 1: Read-Only System Metadata & Accounts state */}
            <div className="space-y-4">
              <div className="p-4 bg-white/[0.01] border border-white/5 rounded-2xl relative space-y-3">
                <div className="text-[10px] font-black tracking-wider text-orange-500 uppercase font-cairo border-b border-white/5 pb-1">البيانات النظامية الثابتة (غير قابلة للتعديل)</div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Customer number */}
                  <div className="space-y-1 text-right">
                    <span className="text-[10px] text-gray-500 font-bold block font-cairo">رقم العميل:</span>
                    <div className="customer-static-input w-full bg-[#161616] border border-white/5 rounded-xl px-3.5 py-2 text-xs font-mono font-black text-gray-400 cursor-not-allowed">
                      #{selectedCustomer.customerNumber || '---'}
                    </div>
                  </div>

                  {/* Customer Name */}
                  <div className="space-y-1 text-right">
                    <span className="text-[10px] text-gray-500 font-bold block font-cairo">اسم العميل ورابط الحساب:</span>
                    <div className="customer-static-input w-full bg-[#161616] border border-white/5 rounded-xl px-3.5 py-2 text-xs font-bold text-gray-400 cursor-not-allowed font-cairo">
                      {selectedCustomer.name}
                    </div>
                  </div>

                  {/* Corporate/Entity name if any */}
                  <div className="space-y-1 text-right">
                    <span className="text-[10px] text-gray-500 font-bold block font-cairo">اسم الجهة / الشركة:</span>
                    <div className="customer-static-input w-full bg-[#161616] border border-white/5 rounded-xl px-3.5 py-2 text-xs font-bold text-gray-400 cursor-not-allowed font-cairo">
                      {selectedCustomer.companyName || 'لا يوجد'}
                    </div>
                  </div>

                  {/* Registration date */}
                  <div className="space-y-1 text-right">
                    <span className="text-[10px] text-gray-500 font-bold block font-cairo">تاريخ التسجيل بالمنظومة:</span>
                    <div className="customer-static-input w-full bg-[#161616] border border-white/5 rounded-xl px-3.5 py-2 text-[11px] font-bold text-gray-400 cursor-not-allowed font-cairo">
                      {selectedCustomer.createdAt
                        ? (function(){ const d = new Date(selectedCustomer.createdAt && typeof selectedCustomer.createdAt.toDate === 'function' ? selectedCustomer.createdAt.toDate() : (selectedCustomer.createdAt.seconds ? selectedCustomer.createdAt.seconds * 1000 : selectedCustomer.createdAt)); return isNaN(d.getTime()) ? '---' : d.toLocaleDateString('ar-YE', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' }); })()
                        : 'تاريخ قديم/مستورد'
                      }
                    </div>
                  </div>
                </div>
              </div>

              {/* Calculations blocks for devices & Net Account balance */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* 1. Remaining devices in shop */}
                <div className="p-4 bg-black/20 border border-white/5 rounded-2xl text-right">
                  <span className="text-[10px] text-gray-500 font-bold block font-cairo uppercase">الأجهزة المتبقية بمحل الصيانة</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-2xl font-black text-white font-mono">{getCustomerRemainingDevices(selectedCustomer.id!)}</span>
                    <span className="text-gray-500 text-[10px] font-bold">أجهزة</span>
                  </div>
                </div>

                {/* 2. Outstanding Balance & Financial indicator (له أو عليه) */}
                <div className="p-4 bg-black/20 border border-white/5 rounded-2xl text-right">
                  <span className="text-[10px] text-gray-500 font-bold block font-cairo uppercase">حالة صافي مديونية العميل</span>
                  <div className="mt-1">
                    {(() => {
                      const totalPaid = getCustomerTotalPaid(selectedCustomer.id!);
                      const totalCost = getCustomerTotalCost(selectedCustomer.id!);
                      const diff = totalPaid - totalCost;
                      const curr = getCustomerCurrencyLabel(selectedCustomer.id!);
                      
                      if (diff > 0.01) {
                        return (
                          <div className="space-y-1">
                            <div className="text-lg font-black text-emerald-400 font-mono">+{diff.toFixed(2)} {curr}</div>
                            <span className="inline-block px-2 py-0.5 rounded-lg text-[9px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold font-cairo">دائن (له متبقي لدينا)</span>
                          </div>
                        );
                      } else if (diff < -0.01) {
                        return (
                          <div className="space-y-1">
                            <div className="text-lg font-black text-rose-500 font-mono">-{Math.abs(diff).toFixed(2)} {curr}</div>
                            <span className="inline-block px-2 py-0.5 rounded-lg text-[9px] bg-rose-500/10 border border-rose-500/20 text-rose-500 font-bold font-cairo">مدين (عليه مستحقات للدفع)</span>
                          </div>
                        );
                      } else {
                        return (
                          <div className="space-y-1">
                            <div className="text-lg font-black text-slate-400 font-mono">0.00 {curr}</div>
                            <span className="inline-block px-2 py-0.5 rounded-lg text-[9px] bg-white/[0.02] border border-white/5 text-slate-400 font-bold font-cairo">رصيد خالي من المديونيات</span>
                          </div>
                        );
                      }
                    })()}
                  </div>
                </div>

              </div>
            </div>

            {/* COLUMN 2: Editable/Modifiable Secondary Contact Information */}
            <div className="space-y-4">
              <div className="p-4 bg-white/[0.01] border border-white/5 rounded-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <div className="text-[10px] font-black tracking-wider text-orange-500 uppercase font-cairo">بيانات الاتصال والتفاصيل (قابلة للتعديل والتحرير)</div>
                  {!isEditingMode ? (
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditingMode(true);
                        setEditPhone1(selectedCustomer.phone1 || '');
                        setEditPhone2(selectedCustomer.phone2 || '');
                        setEditEmail(selectedCustomer.email || '');
                        setEditNotes(selectedCustomer.notes || '');
                      }}
                      className="px-2.5 py-1 bg-orange-600/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/25 rounded-md text-[10px] font-bold font-cairo transition-all flex items-center gap-1.5"
                    >
                      <Edit2 size={10} />
                      <span>تحرير البيانات الأساسية</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsEditingMode(false)}
                      className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-gray-400 rounded-md text-[10px] font-bold font-cairo border border-white/10 transition-all"
                    >
                      إلغاء التعديل
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Phone 1 */}
                  <div className="space-y-1 text-right">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-gray-400 font-bold block font-cairo">الهاتف الرئيسي:</span>
                      {isEditingMode && (
                        <button
                          type="button"
                          onClick={() => setEditPhone1('لا يوجد')}
                          className="text-[9px] text-orange-400 hover:text-white bg-white/5 px-2 py-0.5 rounded border border-white/5 font-cairo font-black"
                        >
                          تعيين لا يوجد
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      disabled={!isEditingMode}
                      value={isEditingMode ? editPhone1 : selectedCustomer.phone1}
                      onChange={(e) => setEditPhone1(e.target.value)}
                      className={`customer-static-input w-full text-xs font-mono font-bold text-right py-2.5 px-3.5 border rounded-xl transition-all ${
                        isEditingMode
                          ? 'bg-black/50 border-white/10 text-white focus:border-orange-500 outline-none'
                          : 'bg-[#161616] border-white/5 text-gray-400 cursor-not-allowed select-none'
                      }`}
                    />
                  </div>

                  {/* Phone 2 */}
                  <div className="space-y-1 text-right">
                    <span className="text-[10px] text-gray-400 font-bold block font-cairo">رقم هاتف ثانوي:</span>
                    <input
                      type="text"
                      disabled={!isEditingMode}
                      value={isEditingMode ? editPhone2 : selectedCustomer.phone2 || ''}
                      onChange={(e) => setEditPhone2(e.target.value)}
                      placeholder={isEditingMode ? 'رقم هاتف إضافي إن وجد...' : 'غير مدخل'}
                      className={`customer-static-input w-full text-xs font-mono font-bold text-right py-2.5 px-3.5 border rounded-xl transition-all ${
                        isEditingMode
                          ? 'bg-black/50 border-white/10 text-white focus:border-orange-500 outline-none'
                          : 'bg-[#161616] border-white/5 text-gray-400 cursor-not-allowed select-none'
                      }`}
                    />
                  </div>

                  {/* Email */}
                  <div className="space-y-1 text-right">
                    <span className="text-[10px] text-gray-400 font-bold block font-cairo">البريد الإلكتروني:</span>
                    <input
                      type="email"
                      disabled={!isEditingMode}
                      value={isEditingMode ? editEmail : selectedCustomer.email || ''}
                      onChange={(e) => setEditEmail(e.target.value)}
                      placeholder={isEditingMode ? 'customer@domain.com' : 'غير مدخل'}
                      className={`customer-static-input w-full text-xs font-mono font-bold text-right py-2.5 px-3.5 border rounded-xl transition-all ${
                        isEditingMode
                          ? 'bg-black/50 border-white/10 text-white focus:border-orange-500 outline-none'
                          : 'bg-[#161616] border-white/5 text-gray-400 cursor-not-allowed select-none'
                      }`}
                    />
                  </div>

                  {/* Details / Notes / Notes */}
                  <div className="space-y-1 text-right md:col-span-2">
                    <span className="text-[10px] text-gray-400 font-bold block font-cairo">تفاصيل وملاحظات إضافية:</span>
                    <textarea
                      disabled={!isEditingMode}
                      value={isEditingMode ? editNotes : selectedCustomer.notes || ''}
                      onChange={(e) => setEditNotes(e.target.value)}
                      rows={2}
                      placeholder={isEditingMode ? 'اكتب أية ملاحظات تفصيلية أو عنونة أخرى للعميل...' : 'لا توجد ملاحظات مسجلة للعميل'}
                      className={`customer-static-input w-full text-xs font-bold text-right py-2 px-3.5 border rounded-xl transition-all resize-none ${
                        isEditingMode
                          ? 'bg-black/50 border-white/10 text-white focus:border-orange-500 outline-none font-cairo'
                          : 'bg-[#161616] border-white/5 text-gray-400 cursor-not-allowed select-none font-cairo'
                      }`}
                    />
                  </div>
                </div>

                {/* Edit Action Save / Discard buttons */}
                {isEditingMode && (
                  <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-white/5">
                    <button
                      type="button"
                      onClick={() => setIsEditingMode(false)}
                      className="px-3.5 py-1.5 bg-white/5 hover:bg-white/10 text-gray-400 rounded-lg text-[10px] font-bold font-cairo border border-white/5 transition-all"
                    >
                      إلغاء التعديل
                    </button>
                    <button
                      type="button"
                      disabled={editPhone1.trim() === '' || isSavingInProcess}
                      onClick={handleUpdateCustomer}
                      className={`px-4.5 py-1.5 font-black font-cairo text-[10px] border rounded-lg shadow-lg flex items-center gap-1.5 transition-all ${
                        editPhone1.trim() !== '' && !isSavingInProcess
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-600 hover:shadow-emerald-600/15'
                          : 'bg-white/[0.01] text-gray-500 border-white/5 cursor-not-allowed shadow-none'
                      }`}
                    >
                      {isSavingInProcess ? (
                        <span>جاري الحفظ...</span>
                      ) : (
                        <>
                          <Check size={11} />
                          <span>حفظ وتثبيت البيانات</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>

          </div>
          )}
          
          {activeCustomerTab === 'statement' && (
            <div className="p-6 bg-black/40 border border-white/5 rounded-2xl flex flex-col items-center gap-4">
              <p className="text-gray-400 text-sm font-bold text-center">يمكنك إصدار كشف حساب شامل للعميل من هنا</p>
              <button
                onClick={() => setShowStatementModal(true)}
                className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-purple-500/10 transition-all flex items-center gap-2"
              >
                <FileText size={14} />
                <span>إصدار كشف حساب شامل</span>
              </button>
            </div>
          )}

          {activeCustomerTab === 'log' && (
            <div className="pt-6 border-t border-white/5 space-y-4">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <FileText size={16} className="text-orange-500" />
                <span>سجلات وفواتير العميل المالي والتقني ({customerInvoices.length})</span>
              </div>

              <div className="bg-black/25 rounded-2xl border border-white/5 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-right border-collapse text-xs">
                    <thead>
                      <tr className="bg-white/[0.02] border-b border-white/5 text-gray-500 uppercase">
                        <th className="px-6 py-3 font-bold">رقم الفاتورة</th>
                        <th className="px-6 py-3 font-bold">تاريخ الفاتورة</th>
                        <th className="px-6 py-3 font-bold">عدد الأجهزة</th>
                        <th className="px-6 py-3 font-bold">التكلفة الإجمالية</th>
                        <th className="px-6 py-3 font-bold">المدفوع</th>
                        <th className="px-6 py-3 font-bold">المتبقي</th>
                        <th className="px-6 py-3 font-bold">حالة الفاتورة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-slate-300">
                      {customerInvoices.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                            لا توجد فواتير مسجلة لهذا العميل.
                          </td>
                        </tr>
                      ) : (
                        customerInvoices.map((inv) => {
                          const invItems = items.filter(it => it.invoiceNumber === inv.invoiceNumber);
                          const itemsCount = invItems.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0);
                          const actualCost = getInvoiceActualCost(invItems);
                          const remainingForInv = Math.max(0, actualCost - Number(inv.amountPaid || 0));
                          const curr = inv.currency || 'USD';

                          // Group counts by status
                          const statusGroups: { [status: string]: number } = {};
                          invItems.forEach(it => {
                            const curStatus = it.status || '10';
                            statusGroups[curStatus] = (statusGroups[curStatus] || 0) + (Number(it.quantity) || 1);
                          });
                          
                          return (
                            <tr key={inv.id} className="hover:bg-white/[0.01] transition-colors">
                              <td className="px-6 py-4 font-mono font-bold text-white">{inv.invoiceNumber}</td>
                              <td className="px-6 py-4 font-mono text-slate-400">
                                {inv.createdAt 
                                  ? (function(){ const d = new Date(inv.createdAt && typeof inv.createdAt.toDate === 'function' ? inv.createdAt.toDate() : (inv.createdAt.seconds ? inv.createdAt.seconds * 1000 : inv.createdAt)); return isNaN(d.getTime()) ? '---' : d.toLocaleDateString('ar-YE'); })()
                                  : '---'
                                }
                              </td>
                              <td className="px-6 py-4 font-mono">{itemsCount}</td>
                              <td className="px-6 py-4 font-mono text-white font-bold">{actualCost.toFixed(2)} <span className="text-[9px] text-gray-500">{curr}</span></td>
                              <td className="px-6 py-4 font-mono text-emerald-400">{Number(inv.amountPaid || 0).toFixed(2)} <span className="text-[9px] text-gray-500">{curr}</span></td>
                              <td className="px-6 py-4 font-mono text-rose-500 font-bold">{remainingForInv.toFixed(2)} <span className="text-[9px] text-gray-500">{curr}</span></td>
                              <td className="px-6 py-4">
                                <div className="flex flex-col gap-1.5 justify-end">
                                  {Object.entries(statusGroups).map(([status, count]) => (
                                    <div key={status} className="flex items-center gap-1.5 justify-end">
                                      <span className="text-[10px] font-bold text-gray-400 font-mono">{count}x</span>
                                      <span className={`inline-block px-2.5 py-0.5 rounded-full border text-[9px] font-bold ${getStatusStyle(status)}`}>
                                        {getStatusTextArabic(status)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Bottom action block (Unique ID placeholder) */}
          <div className="flex justify-end pt-4">
            <span className="text-[10px] text-gray-500 font-bold font-cairo font-mono">المعرف الفريد: {selectedCustomer.id}</span>
          </div>

        </div>
      )}

      {/* Comprehensive Customers List Registry (Loaded directly into database table below search inputs) */}
      {(!selectedCustomer || activeCustomerTab === 'menu') && (
        <div className="customers-box bg-[#1a1a1a] border-y border-white/5 mx-0 my-4 space-y-0">
        {/* Headers and Advanced Sort filters */}
        <div className="flex items-center justify-between gap-2 p-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-orange-600/10 text-orange-500 rounded-lg border border-orange-500/15">
              <Users size={16} />
            </div>
            <h3 className="text-[10px] sm:text-xs font-black font-cairo text-white">جدول جميع العملاء المسجلين في النظام</h3>
          </div>
          
          {/* Filter Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowFilterDropdown(!showFilterDropdown)}
              className="px-2 py-1.5 bg-white/5 hover:bg-orange-600/20 text-gray-400 hover:text-orange-500 rounded-lg transition-all border border-white/10 flex items-center gap-1.5"
            >
              <span className="text-[9px] font-bold font-cairo sm:block hidden">ترتيب وفرز</span>
              <ArrowUpDown size={12} />
            </button>
            
            {showFilterDropdown && (
              <div className="absolute z-50 left-0 mt-2 bg-[#1f1f1f] border border-white/10 rounded-xl shadow-2xl p-1.5 w-48">
                <button onClick={() => setFilterAndSort('alpha', 'asc')} className="w-full text-right px-3 py-1.5 text-[10px] hover:bg-orange-600 hover:text-white text-slate-300 rounded font-bold font-cairo transition-colors">أبجدي (أ إلى ي)</button>
                <button onClick={() => setFilterAndSort('alpha', 'desc')} className="w-full text-right px-3 py-1.5 text-[10px] hover:bg-orange-600 hover:text-white text-slate-300 rounded font-bold font-cairo transition-colors">أبجدي (ي إلى أ)</button>
                <button onClick={() => setFilterAndSort('date', 'desc')} className="w-full text-right px-3 py-1.5 text-[10px] hover:bg-orange-600 hover:text-white text-slate-300 rounded font-bold font-cairo transition-colors">تاريخ التسجيل الأحدث</button>
                <button onClick={() => setFilterAndSort('date', 'asc')} className="w-full text-right px-3 py-1.5 text-[10px] hover:bg-orange-600 hover:text-white text-slate-300 rounded font-bold font-cairo transition-colors">تاريخ التسجيل الأقدم</button>
                <button onClick={() => setFilterAndSort('debt', 'asc')} className="w-full text-right px-3 py-1.5 text-[10px] hover:bg-orange-600 hover:text-white text-slate-300 rounded font-bold font-cairo transition-colors">المديونية (الأقل أولاً)</button>
                <button onClick={() => setFilterAndSort('debt', 'desc')} className="w-full text-right px-3 py-1.5 text-[10px] hover:bg-orange-600 hover:text-white text-slate-300 rounded font-bold font-cairo transition-colors">المديونية (الأكثر أولاً)</button>
              </div>
            )}
          </div>
        </div>

        {/* The Customers Data Table */}
        <div className="w-full overflow-hidden">
          <table className="w-full text-right border-collapse table-fixed select-none">
            <thead>
              <tr className="bg-white/5 border-b border-white/10 text-gray-400 text-[9px] sm:text-[10px]">
                <th className="px-1 py-1.5 font-bold text-center w-10 sm:w-16">الكود</th>
                <th className="px-1 py-1.5 font-bold w-1/4">اسم العميل</th>
                <th className="px-1 py-1.5 font-bold">رقم الجوال</th>
                <th className="px-1 py-1.5 font-bold text-center w-12 sm:w-16 whitespace-nowrap">أجهزة</th>
                <th className="px-1 py-1.5 font-bold text-center w-14 sm:w-16 whitespace-nowrap">المديونية</th>
                <th className="px-1 py-1.5 font-bold text-center w-14 sm:w-20 whitespace-nowrap">تاريخ التسجيل</th>
              </tr>
            </thead>
              <tbody className="divide-y divide-white/5 text-slate-300 text-[10px] sm:text-xs">
                {currentCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-2 py-8 text-center text-gray-500 font-bold font-cairo text-xs">
                      لا يوجد عملاء مطابقين للبحث حالياً.
                    </td>
                  </tr>
                ) : (
                  currentCustomers.map((cust) => {
                    const remainingDevices = getCustomerRemainingDevices(cust.id!);
                    const outstandingAmt = getCustomerOutstandingAmount(cust.id!);
                    const currLabel = getCustomerCurrencyLabel(cust.id!);
                    const isSelected = selectedCustomer?.id === cust.id;

                    return (
                      <tr key={cust.id} className="hover:bg-white/[0.03] transition-colors cursor-pointer" onClick={() => selectCustomer(cust)}>
                        <td className="px-1 py-1 font-mono font-bold text-gray-500 text-center text-[9px] sm:text-[10px]">
                          {cust.customerNumber || '---'}
                        </td>
                        <td className="px-1 py-1">
                          <div className="flex flex-col">
                            <span className={`font-bold text-[10px] sm:text-xs truncate ${isSelected ? 'text-orange-400' : 'text-white'}`}>{cust.name}</span>
                            {cust.notes && <span className="text-[8px] sm:text-[9px] text-gray-500 line-clamp-1">{cust.notes}</span>}
                          </div>
                        </td>
                        <td className="px-1 py-1 font-mono text-slate-400">
                          <div className="flex flex-col gap-0">
                            <span className="flex items-center text-[9px] sm:text-[10px] truncate">{cust.phone1}</span>
                            {cust.phone2 && <span className="flex items-center text-[8px] sm:text-[9px] text-gray-600 truncate">{cust.phone2}</span>}
                          </div>
                        </td>
                        <td className="px-1 py-1 text-center whitespace-nowrap text-[9px] sm:text-[10px]">
                          {remainingDevices > 0 ? (
                            <span className="inline-block bg-orange-500/10 text-orange-400 px-1 py-0.5 rounded text-[9px] font-bold">
                              {remainingDevices}
                            </span>
                          ) : (
                            <span className="text-slate-600 font-bold">-</span>
                          )}
                        </td>
                        <td className="px-1 py-1 text-center whitespace-nowrap text-[9px] sm:text-[10px]">
                          {outstandingAmt > 0 ? (
                            <span className="inline-block bg-rose-500/10 text-rose-400 px-1 py-0.5 rounded text-[9px] font-bold">
                              {outstandingAmt.toFixed(0)}
                            </span>
                          ) : (
                            <span className="text-slate-600 text-[9px] font-bold">0</span>
                          )}
                        </td>
                        <td className="px-1 py-1 font-mono text-slate-400 text-[9px] sm:text-[10px] text-center whitespace-nowrap">
                          {cust.createdAt
                            ? (function(){ const d = new Date(cust.createdAt && typeof cust.createdAt.toDate === 'function' ? cust.createdAt.toDate() : (cust.createdAt.seconds ? cust.createdAt.seconds * 1000 : cust.createdAt)); return isNaN(d.getTime()) ? '---' : d.toLocaleDateString('ar-YE', { year: '2-digit', month: 'numeric', day: 'numeric' }); })()
                            : '---'
                          }
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
        </div>
        
        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/5 bg-black/20">
            <span className="text-xs text-gray-500 font-bold font-cairo">
              عرض {((safeCurrentPage - 1) * itemsPerPage) + 1} إلى {Math.min(safeCurrentPage * itemsPerPage, allProcessedCustomers.length)} من أصل {allProcessedCustomers.length} عميل
            </span>
            <div className="flex items-center gap-1.5">
              <button
                disabled={safeCurrentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className="px-3 py-1.5 text-xs font-bold font-cairo bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed border border-white/10 rounded-lg transition-all"
              >
                السابق
              </button>
              <div className="flex items-center gap-1 mx-2">
                <span className="text-sm font-bold text-white">{safeCurrentPage}</span>
                <span className="text-xs text-gray-500">من {totalPages}</span>
              </div>
              <button
                disabled={safeCurrentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                className="px-3 py-1.5 text-xs font-bold font-cairo bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed border border-white/10 rounded-lg transition-all"
              >
                التالي
              </button>
            </div>
          </div>
        )}
      </div>
      )}

      {/* 5. COMPREHENSIVE CUSTOMER FINANCIAL STATEMENT MODAL */}
      {showStatementModal && selectedCustomer && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-xl">
          <div className="customer-modal-bg bg-[#141414] w-full h-full p-6 md:p-8 space-y-6 shadow-2xl relative overflow-y-auto text-right">
            
            {isGeneratingPDF && (
              <div className="absolute inset-0 z-[120] bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4 text-center p-6">
                <div className="w-14 h-14 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-white font-black font-cairo text-base">جاري إنشاء وتصدير ملف الـ PDF المحاسبي...</p>
                <p className="text-gray-400 font-cairo text-xs max-w-md leading-relaxed">بضع ثوانٍ وسيكون التقرير المالي الموحد جاهزاً على جهازك ومعداً للإرسال التلقائي عبر تطبيق واتساب للعميل.</p>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-between border-b border-white/5 pb-4 print:hidden">
              <div className="flex items-center gap-4">
                 <button onClick={() => setShowStatementModal(false)} className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-gray-400">
                    <X size={20} />
                 </button>
                 <h3 className="text-sm font-black text-purple-400 font-cairo flex items-center gap-1.5 flex-row-reverse">
                    <FileText size={18} />
                    كشف الحساب المالي الموحد والشامل
                 </h3>
              </div>
              <div className="flex items-center gap-2 relative">
                <button
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
                        onClick={() => {
                          handleWhatsAppShare(selectedCustomer.id!);
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
                const entries = getStatementEntries(selectedCustomer.id!);
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
                const curr = getCustomerCurrencyLabel(selectedCustomer.id!);
                const getArabicCurrencyName = (currCode: string) => {
                  if (!currCode) return 'دولار';
                  if (currCode.toUpperCase() === 'USD') return 'دولار';
                  if (currCode.toUpperCase() === 'YER') return 'ريال يمني';
                  if (currCode.toUpperCase().includes('USD') && currCode.toUpperCase().includes('YER')) return 'دولار / ريال يمني';
                  return currCode;
                };
                const arCurrency = getArabicCurrencyName(curr);

                return (
                  <div id="print-area" className="w-[820px] mx-auto space-y-5 bg-white text-gray-900 p-8 rounded-2xl border border-gray-300 text-right font-cairo shadow-lg" dir="rtl">
                    
                    {/* 1. Header (رأس الصفحة) & 2. Document Info (بيانات المرجع) */}
                    <div className="grid grid-cols-3 gap-4 items-start border-b-2 border-gray-950 pb-4 mb-3">
                      
                      {/* Right Column: Shop & Dept Info (التفاصيل اليمين) */}
                      <div className="text-right flex flex-col pt-1 space-y-1">
                        <h2 className="text-lg font-black text-gray-950 tracking-tight leading-tight font-cairo">
                          {shopConfig?.shopName || 'عالم الصيانة والتجارة'}
                        </h2>
                        <div className="text-xs font-bold text-gray-800 tracking-tight leading-tight font-cairo">
                          قسم الحسابات
                        </div>
                        
                        <div className="pt-1.5 space-y-1">
                          {(shopConfig?.phone1 || shopConfig?.phone2) && (
                            <div className="text-[10px] font-bold text-gray-800 flex items-center justify-start gap-1 w-fit">
                              <span>تلفون :</span>
                              <span dir="ltr" className="font-mono">
                                {shopConfig?.phone1}
                                {shopConfig?.phone1 && shopConfig?.phone2 && ' - '}
                                {shopConfig?.phone2}
                              </span>
                              <div className="flex items-center gap-1 mr-1">
                                <Smartphone size={10} className="text-gray-700" />
                                {(shopConfig?.phone1Whatsapp || shopConfig?.phone2Whatsapp) && (
                                  <MessageCircle size={10} className="text-green-600" />
                                )}
                              </div>
                            </div>
                          )}
                          {shopConfig?.landline && (
                            <div className="text-[10px] font-bold text-gray-800 flex items-center justify-start gap-1 w-fit">
                              <span>ثابت :</span>
                              <span dir="ltr" className="font-mono">{shopConfig.landline}</span>
                              <div className="flex items-center gap-1 mr-1">
                                <Phone size={10} className="text-gray-700" />
                              </div>
                            </div>
                          )}
                          {shopConfig?.facebookUrl && (
                            <div className="text-[10px] font-bold text-gray-800 flex items-center justify-start gap-1 w-fit">
                              <span>فيسبوك :</span>
                              <span dir="ltr" className="font-mono text-blue-800 truncate max-w-[150px]">{shopConfig.facebookUrl}</span>
                              <div className="flex items-center gap-1 mr-1">
                                <Facebook size={10} className="text-blue-600" />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Middle Column: Logo & Document Name (الوسط) */}
                      <div className="text-center flex flex-col items-center justify-center pt-1">
                        {shopConfig?.logoUrl ? (
                          <img src={shopConfig.logoUrl} alt="Logo" className="h-16 max-w-[150px] object-contain mb-2" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-12 h-12 border border-dashed border-gray-300 rounded-xl mb-2 flex items-center justify-center text-gray-400 text-[10px] font-bold font-cairo">شعار المحل</div>
                        )}
                        <h1 className="text-lg font-black text-gray-950 tracking-tight border border-gray-950 px-4 py-1.5 rounded-lg bg-gray-50/50 font-cairo">
                          كشف حساب مالي موحد
                        </h1>
                        <div className="text-[10px] font-bold text-gray-750 mt-1.5 font-cairo bg-gray-100 px-2 py-0.5 rounded">
                          {arCurrency} - {dateRangeStr}
                        </div>
                      </div>

                      {/* Left Column: Reference Info (اليسار) */}
                      <div className="text-left flex flex-col items-end pt-1 space-y-1">
                        <div className="text-xs font-bold text-gray-750 flex justify-between gap-4">
                          <span>رقم التقرير:</span>
                          <span className="font-mono text-gray-955">{selectedCustomer.customerNumber}</span>
                        </div>
                        <div className="text-xs font-bold text-gray-751 flex justify-between gap-4">
                          <span>التاريخ:</span>
                          <span className="font-mono text-gray-955">{new Date().toLocaleDateString('ar-YE', { year: 'numeric', month: 'numeric', day: 'numeric' })}</span>
                        </div>
                        <div className="text-xs font-bold text-gray-751 flex justify-between gap-4">
                          <span>وقت الإصدار:</span>
                          <span className="font-mono text-gray-955">
                            {new Date().toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className="text-xs font-bold text-gray-751 flex justify-between gap-4 border-t border-gray-200 pt-1 mt-1 font-cairo">
                          <span>رقم مستخدم النظام:</span>
                          <span className="font-mono text-gray-955">1</span>
                        </div>
                      </div>

                    </div>

                    {/* 3. Customer Info (بيانات العميل) */}
                    <div className="bg-gray-50/70 p-3 rounded-xl border border-gray-300 flex justify-between items-center px-6 my-3 font-cairo">
                      <div className="text-sm font-black text-gray-950 flex items-center gap-1.5">
                        <span className="text-xs text-gray-550">إسم العميل:</span>
                        <span className="text-gray-900">{selectedCustomer.name}</span>
                      </div>
                      <div className="text-sm font-bold text-gray-955 border-r border-gray-300 pr-6 flex items-center gap-1.5">
                        <span className="text-xs text-gray-550">الجهة/الشركة:</span>
                        <span className="text-gray-900">{selectedCustomer.companyName || '---'}</span>
                      </div>
                      <div className="text-sm font-bold text-gray-955 border-r border-gray-300 pr-6 flex items-center gap-1.5">
                        <span className="text-xs text-gray-550">التليفون:</span>
                        <span className="font-mono text-gray-900" dir="ltr">
                          {selectedCustomer.phone1}
                          {selectedCustomer.phone2 ? ` | ${selectedCustomer.phone2}` : ''}
                        </span>
                      </div>
                    </div>

                    {/* 4. Detail Grid (تفاصيل التقرير) */}
                    <div className="space-y-1.5">
                      <span className="text-xs font-black text-gray-800 font-cairo block">العمليات والتحركات المالية المحاسبية:</span>
                      <div className="border border-gray-400 rounded-xl overflow-hidden bg-white text-xs">
                        <table className="w-full border-collapse text-right select-none">
                          <thead>
                            <tr className="bg-gray-100 border-b-2 border-gray-400 text-gray-950 font-cairo font-black">
                              <th className="py-2.5 px-3 text-center w-12 border-l border-gray-400 bg-gray-200/40">مـ</th>
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
                                      {entry.debit > 0 ? `${entry.debit.toLocaleString()}` : '---'}
                                    </td>
                                    <td className="py-2.5 px-4 font-mono font-black text-emerald-800 text-center border-l border-gray-400 bg-emerald-50/5">
                                      {entry.credit > 0 ? `${entry.credit.toLocaleString()}` : '---'}
                                    </td>
                                    <td className={`py-2.5 px-4 font-mono font-black text-center ${entry.runningBalance > 0.01 ? 'text-rose-800' : entry.runningBalance < -0.01 ? 'text-emerald-800' : 'text-gray-600'}`}>
                                      {entry.runningBalance.toLocaleString()} {arCurrency}
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* 5. Summary Section (الملخص) */}
                    {(() => {
                      const totalCost = getCustomerTotalCost(selectedCustomer.id!);
                      const totalPaid = getCustomerTotalPaid(selectedCustomer.id!);
                      const diff = totalPaid - totalCost;
                      const isCreditor = diff > 0.01;
                      const isDebtor = diff < -0.01;
                      
                      const balanceStatus = isCreditor ? 'دائن (له في الحساب ومستحق له رصيد متبقي)' : isDebtor ? 'مدين (متبقي عليه ديون لصالح المحل)' : 'متزن الحساب بالكامل';

                      return (
                        <div className="border border-gray-400 p-3.5 rounded-xl text-center font-cairo bg-gray-50/40 my-3">
                          <div className="text-[10px] font-black text-gray-550 uppercase tracking-wider mb-1">صافي الحساب المالي الجاري (الملخص المالي)</div>
                          <div className="grid grid-cols-3 gap-2 border-t border-b border-gray-300 py-2.5 my-1.5 text-center">
                            <div>
                              <div className="text-[9px] text-gray-500 font-bold">إجمالي المطالبات (مدين)</div>
                              <div className="text-sm font-black font-mono text-rose-800 mt-0.5">{totalCost.toLocaleString()} {arCurrency}</div>
                            </div>
                            <div className="border-r border-l border-gray-300">
                              <div className="text-[9px] text-gray-500 font-bold">إجمالي المقبوضات (دائن)</div>
                              <div className="text-sm font-black font-mono text-emerald-800 mt-0.5">{totalPaid.toLocaleString()} {arCurrency}</div>
                            </div>
                            <div>
                              <div className="text-[9px] text-gray-500 font-bold">صافي المتبقي بالجاري</div>
                              <div className="text-sm font-black font-mono text-gray-950 mt-0.5">{Math.abs(diff).toLocaleString()} {arCurrency}</div>
                            </div>
                          </div>
                          <div className="text-xs font-black text-gray-900">
                            حالة الحساب النهائية: <span className={isCreditor ? 'text-emerald-700' : isDebtor ? 'text-rose-700 font-black' : 'text-gray-700'}>{balanceStatus}</span>
                          </div>
                        </div>
                      );
                    })()}

                    {/* 6. Notes (الملاحظات) */}
                    <div className="border border-gray-350 p-3.5 rounded-xl text-right font-cairo text-xs space-y-2 bg-yellow-50/10 my-3">
                      <div className="font-extrabold text-gray-950 border-b border-gray-200 pb-1 flex items-center gap-1.5">
                        <AlertTriangle size={12} className="text-amber-600" />
                        <span>الملاحظات والشروط العامة للتقرير:</span>
                      </div>
                      <ul className="list-disc list-inside space-y-1 text-gray-800 leading-relaxed text-[11px]">
                        <li>
                          <span className="font-black text-gray-950">مراجعة الحساب:</span> نرجو من عملائنا الكرام مراجعة وتأكيد هذا الكشف والرد علينا وتأكيد مطابقة الرصيد خلال 24 ساعة من تاريخ الاستلام.
                        </li>
                        <li>
                          <span className="font-black text-gray-950">الاعتماد النهائي:</span> يعتبر هذا الكشف كشفاً نهائياً وموافقة ضمنية مالم يردنا اعتراض مكتوب مسجلاً لدينا خلال أسبوع كحد أقصى من تاريخ إصدار التقرير.
                        </li>
                        <li>
                          <span className="font-black text-gray-950">تفاصيل الضمان:</span> تلتزم الشركة بتقديم كافة الضمانات الفنية والمالية المتفق عليها في بنود وفواتير الخدمات المرجعية.
                        </li>
                      </ul>
                    </div>

                    {/* 7. Signatures (التواقيع) */}
                    <div className="grid grid-cols-3 text-center pb-2 pt-2.5 font-cairo text-[11px] text-gray-950 font-bold gap-4 items-start border-t border-gray-350 my-4">
                      <div className="space-y-10">
                        <div>توقيع العميل / المفوض بالاستلام</div>
                        <div className="text-gray-400 font-mono">........................................</div>
                      </div>
                      
                      <div className="space-y-10">
                        <div>اسم وتوقيع الفني / المحاسب المختص</div>
                        <div className="text-gray-400 font-mono">........................................</div>
                      </div>

                      <div className="flex flex-col items-center justify-center">
                        <div className="text-[11px] text-gray-950 mb-3">اعتماد الإدارة وختم المؤسسة</div>
                        <div className="w-16 h-16 border-2 border-dashed border-gray-400 rounded-full flex items-center justify-center opacity-40 transform -rotate-12">
                          <p className="text-[7px] font-black text-center leading-tight">{shopConfig?.shopName || 'عالم الصيانة والتجارة'}</p>
                        </div>
                      </div>
                    </div>

                    {/* 8. Footer (ذيل الصفحة) */}
                    <div className="border-t-[3px] border-black my-2 border-solid"></div>
                    <div className="pt-2 font-cairo">
                      
                      {/* Row 1: Real location & Date / Time and Copy number in one line */}
                      <div className="flex items-center justify-between text-[10px] text-gray-800 font-bold pb-2 border-b border-gray-200">
                        <div>
                          {shopConfig?.address && (
                            <span className="flex items-center gap-1.5">
                              <MapPin size={10} className="text-gray-600" />
                              <span>الموقع الفعلي: {shopConfig.address}</span>
                            </span>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <span>تاريخ ووقت الطباعة:</span>
                          <span className="font-mono text-gray-900" dir="ltr">
                            {new Date().toLocaleDateString('en-GB')} {new Date().toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span className="text-gray-400">|</span>
                          <span>رقم النسخة:</span>
                          <span className="border border-gray-400 px-1.5 py-0.5 rounded bg-gray-50 font-mono text-[9px] font-black text-gray-900">1</span>
                        </div>
                      </div>

                      {/* Row 2: Company bank accounts */}
                      <div className="w-full">
                        <BankAccountsFooter shopConfig={shopConfig} />
                      </div>
                    </div>

                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* 7. CUSTOMER DETAILS MODAL */}
      {showDetailsModal && selectedCustomer && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-xl">
          <div className="customer-modal-bg bg-[#141414] w-full h-full p-6 md:p-8 space-y-6 shadow-2xl relative overflow-y-auto text-right">
            {/* Modal Actions */}
            <div className="flex items-center justify-between border-b border-white/5 pb-4 print:hidden">
              <div className="flex items-center gap-4">
                 <button onClick={() => setShowDetailsModal(false)} className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-gray-400">
                    <X size={20} />
                 </button>
                 <h3 className="text-sm font-black text-orange-400 font-cairo flex items-center gap-1.5 flex-row-reverse">
                    <User size={18} />
                    بيانات العميل المالية والتفصيلية
                 </h3>
              </div>
            </div>

            {/* Details Content */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* COLUMN 1: Read-Only System Metadata & Accounts state */}
              <div className="space-y-4">
                <div className="p-4 bg-white/[0.01] border border-white/5 rounded-2xl relative space-y-3">
                  <div className="text-[10px] font-black tracking-wider text-orange-500 uppercase font-cairo border-b border-white/5 pb-1">البيانات النظامية الثابتة</div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1 text-right">
                      <span className="text-[10px] text-gray-500 font-bold block font-cairo">رقم العميل:</span>
                      <div className="customer-static-input w-full bg-[#161616] border border-white/5 rounded-xl px-3.5 py-2 text-xs font-mono font-black text-gray-400 cursor-not-allowed">
                        #{selectedCustomer.customerNumber || '---'}
                      </div>
                    </div>

                    <div className="space-y-1 text-right">
                      <span className="text-[10px] text-gray-500 font-bold block font-cairo">اسم العميل:</span>
                      <div className="customer-static-input w-full bg-[#161616] border border-white/5 rounded-xl px-3.5 py-2 text-xs font-bold text-gray-400 cursor-not-allowed font-cairo">
                        {selectedCustomer.name}
                      </div>
                    </div>

                    <div className="space-y-1 text-right">
                      <span className="text-[10px] text-gray-500 font-bold block font-cairo">اسم الجهة / الشركة:</span>
                      <div className="customer-static-input w-full bg-[#161616] border border-white/5 rounded-xl px-3.5 py-2 text-xs font-bold text-gray-400 cursor-not-allowed font-cairo">
                        {selectedCustomer.companyName || 'لا يوجد'}
                      </div>
                    </div>

                    <div className="space-y-1 text-right">
                      <span className="text-[10px] text-gray-500 font-bold block font-cairo">تاريخ التسجيل:</span>
                      <div className="customer-static-input w-full bg-[#161616] border border-white/5 rounded-xl px-3.5 py-2 text-[11px] font-bold text-gray-400 cursor-not-allowed font-cairo">
                        {selectedCustomer.createdAt
                          ? (function(){ const d = new Date(selectedCustomer.createdAt && typeof selectedCustomer.createdAt.toDate === 'function' ? selectedCustomer.createdAt.toDate() : (selectedCustomer.createdAt.seconds ? selectedCustomer.createdAt.seconds * 1000 : selectedCustomer.createdAt)); return isNaN(d.getTime()) ? '---' : d.toLocaleDateString('ar-YE'); })()
                          : '---'
                        }
                      </div>
                    </div>
                  </div>
                </div>

                {/* Calculations blocks for devices & Net Account balance */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-black/20 border border-white/5 rounded-2xl text-right">
                    <span className="text-[10px] text-gray-500 font-bold block font-cairo uppercase">الأجهزة المتبقية بمحل الصيانة</span>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-2xl font-black text-white font-mono">{getCustomerRemainingDevices(selectedCustomer.id!)}</span>
                      <span className="text-gray-500 text-[10px] font-bold">أجهزة</span>
                    </div>
                  </div>

                  <div className="p-4 bg-black/20 border border-white/5 rounded-2xl text-right">
                    <span className="text-[10px] text-gray-500 font-bold block font-cairo uppercase">حالة صافي مديونية العميل</span>
                    <div className="mt-1">
                      {(() => {
                        const totalPaid = getCustomerTotalPaid(selectedCustomer.id!);
                        const totalCost = getCustomerTotalCost(selectedCustomer.id!);
                        const diff = totalPaid - totalCost;
                        const curr = getCustomerCurrencyLabel(selectedCustomer.id!);
                        
                        if (diff > 0.01) {
                          return <div className="text-lg font-black text-emerald-400 font-mono">+{diff.toFixed(2)} {curr}</div>;
                        } else if (diff < -0.01) {
                          return <div className="text-lg font-black text-rose-500 font-mono">{diff.toFixed(2)} {curr}</div>;
                        } else {
                          return <div className="text-lg font-black text-slate-400 font-mono">0.00 {curr}</div>;
                        }
                      })()}
                    </div>
                  </div>
                </div>
              </div>

              {/* COLUMN 2: Editable/Modifiable Secondary Contact Information */}
              <div className="space-y-4">
                 <div className="p-4 bg-white/[0.01] border border-white/5 rounded-2xl space-y-4">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <div className="text-[10px] font-black tracking-wider text-orange-500 uppercase font-cairo">بيانات الاتصال والتفاصيل</div>
                    {!isEditingMode ? (
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditingMode(true);
                          setEditPhone1(selectedCustomer.phone1 || '');
                          setEditPhone2(selectedCustomer.phone2 || '');
                          setEditEmail(selectedCustomer.email || '');
                          setEditNotes(selectedCustomer.notes || '');
                        }}
                        className="px-2.5 py-1 bg-orange-600/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/25 rounded-md text-[10px] font-bold font-cairo transition-all flex items-center gap-1.5"
                      >
                        <Edit2 size={10} />
                        <span>تحرير</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setIsEditingMode(false)}
                        className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-gray-400 rounded-md text-[10px] font-bold font-cairo border border-white/10 transition-all"
                      >
                        إلغاء التعديل
                      </button>
                    )}
                  </div>
                  
                  
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <div className="text-[10px] font-black tracking-wider text-orange-500 uppercase font-cairo">بيانات الاتصال والتفاصيل (قابلة للتعديل والتحرير)</div>
                    {!isEditingMode ? (
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditingMode(true);
                          setEditPhone1(selectedCustomer.phone1 || '');
                          setEditPhone2(selectedCustomer.phone2 || '');
                          setEditEmail(selectedCustomer.email || '');
                          setEditNotes(selectedCustomer.notes || '');
                        }}
                        className="px-2.5 py-1 bg-orange-600/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/25 rounded-md text-[10px] font-bold font-cairo transition-all flex items-center gap-1.5"
                      >
                        <Edit2 size={10} />
                        <span>تحرير البيانات الأساسية</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setIsEditingMode(false)}
                        className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-gray-400 rounded-md text-[10px] font-bold font-cairo border border-white/10 transition-all"
                      >
                        إلغاء التعديل
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Phone 1 */}
                    <div className="space-y-1 text-right">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-gray-400 font-bold block font-cairo">الهاتف الرئيسي:</span>
                        {isEditingMode && (
                          <button
                            type="button"
                            onClick={() => setEditPhone1('لا يوجد')}
                            className="text-[9px] text-orange-400 hover:text-white bg-white/5 px-2 py-0.5 rounded border border-white/5 font-cairo font-black"
                          >
                            تعيين لا يوجد
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        disabled={!isEditingMode}
                        value={isEditingMode ? editPhone1 : selectedCustomer.phone1}
                        onChange={(e) => setEditPhone1(e.target.value)}
                        className={`customer-static-input w-full text-xs font-mono font-bold text-right py-2.5 px-3.5 border rounded-xl transition-all ${
                          isEditingMode
                            ? 'bg-black/50 border-white/10 text-white focus:border-orange-500 outline-none'
                            : 'bg-[#161616] border-white/5 text-gray-400 cursor-not-allowed select-none'
                        }`}
                      />
                    </div>

                    {/* Phone 2 */}
                    <div className="space-y-1 text-right">
                      <span className="text-[10px] text-gray-400 font-bold block font-cairo">رقم هاتف ثانوي:</span>
                      <input
                        type="text"
                        disabled={!isEditingMode}
                        value={isEditingMode ? editPhone2 : selectedCustomer.phone2 || ''}
                        onChange={(e) => setEditPhone2(e.target.value)}
                        placeholder={isEditingMode ? 'رقم هاتف إضافي إن وجد...' : 'غير مدخل'}
                        className={`customer-static-input w-full text-xs font-mono font-bold text-right py-2.5 px-3.5 border rounded-xl transition-all ${
                          isEditingMode
                            ? 'bg-black/50 border-white/10 text-white focus:border-orange-500 outline-none'
                            : 'bg-[#161616] border-white/5 text-gray-400 cursor-not-allowed select-none'
                        }`}
                      />
                    </div>

                    {/* Email */}
                    <div className="space-y-1 text-right">
                      <span className="text-[10px] text-gray-400 font-bold block font-cairo">البريد الإلكتروني:</span>
                      <input
                        type="email"
                        disabled={!isEditingMode}
                        value={isEditingMode ? editEmail : selectedCustomer.email || ''}
                        onChange={(e) => setEditEmail(e.target.value)}
                        placeholder={isEditingMode ? 'customer@domain.com' : 'غير مدخل'}
                        className={`customer-static-input w-full text-xs font-mono font-bold text-right py-2.5 px-3.5 border rounded-xl transition-all ${
                          isEditingMode
                            ? 'bg-black/50 border-white/10 text-white focus:border-orange-500 outline-none'
                            : 'bg-[#161616] border-white/5 text-gray-400 cursor-not-allowed select-none'
                        }`}
                      />
                    </div>

                    {/* Details / Notes / Notes */}
                    <div className="space-y-1 text-right md:col-span-2">
                      <span className="text-[10px] text-gray-400 font-bold block font-cairo">تفاصيل وملاحظات إضافية:</span>
                      <textarea
                        disabled={!isEditingMode}
                        value={isEditingMode ? editNotes : selectedCustomer.notes || ''}
                        onChange={(e) => setEditNotes(e.target.value)}
                        rows={2}
                        placeholder={isEditingMode ? 'اكتب أية ملاحظات تفصيلية أو عنونة أخرى للعميل...' : 'لا توجد ملاحظات مسجلة للعميل'}
                        className={`customer-static-input w-full text-xs font-bold text-right py-2 px-3.5 border rounded-xl transition-all resize-none ${
                        isEditingMode
                          ? 'bg-black/50 border-white/10 text-white focus:border-orange-500 outline-none font-cairo'
                          : 'bg-[#161616] border-white/5 text-gray-400 cursor-not-allowed select-none font-cairo'
                        }`}
                      />
                    </div>
                  </div>

                  {/* Edit Action Save / Discard buttons */}
                  {isEditingMode && (
                    <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-white/5">
                      <button
                        type="button"
                        onClick={() => setIsEditingMode(false)}
                        className="px-3.5 py-1.5 bg-white/5 hover:bg-white/10 text-gray-400 rounded-lg text-[10px] font-bold font-cairo border border-white/5 transition-all"
                      >
                        إلغاء التعديل
                      </button>
                      <button
                        type="button"
                        disabled={editPhone1.trim() === '' || isSavingInProcess}
                        onClick={handleUpdateCustomer}
                        className={`px-4.5 py-1.5 font-black font-cairo text-[10px] border rounded-lg shadow-lg flex items-center gap-1.5 transition-all ${
                          editPhone1.trim() !== '' && !isSavingInProcess
                            ? 'bg-orange-600 border-orange-600 text-white hover:bg-orange-500'
                            : 'bg-white/10 border-white/5 text-gray-500 cursor-not-allowed'
                        }`}
                      >
                        {isSavingInProcess ? 'جاري الحفظ...' : 'حفظ التعديلات'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

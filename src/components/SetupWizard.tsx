import React, { useState } from 'react';
import { motion } from 'motion/react';
import { doc, setDoc } from '../firebase';
import { db } from '../firebase';
import { ShopConfig } from '../types';
import { Store, Calendar, Upload, CheckCircle, Loader2, ArrowRight } from 'lucide-react';

export default function SetupWizard({ onComplete }: { onComplete: (config: ShopConfig) => void }) {
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<ShopConfig>({
    shopName: 'عالم الصيانة والتجارة',
    fiscalYear: new Date().getFullYear().toString(),
    startDate: new Date().toISOString().split('T')[0],
    logoUrl: ''
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await setDoc(doc(db, 'settings', 'shop'), config);
      onComplete(config);
    } catch (e) {
      console.error(e);
      alert('Error saving configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setConfig({ ...config, logoUrl: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center p-6 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-orange-900/10 via-transparent to-transparent">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-xl w-full bg-[#1a1a1a] border border-white/5 rounded-3xl p-8 shadow-2xl space-y-8"
      >
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-orange-600/10 text-orange-500 rounded-full text-xs font-bold uppercase tracking-wider">
            <CheckCircle size={14} />
            First Time Setup
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Configure Your Business</h1>
          <p className="text-gray-400">Let's set up your shop profile and fiscal year.</p>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5 md:col-span-2 text-center flex flex-col items-center">
              <label className="text-xs font-bold text-gray-500 uppercase w-full text-left ml-1">Business Logo</label>
              <div className="relative group mt-2">
                <div className="w-32 h-32 rounded-2xl bg-black/40 border-2 border-dashed border-white/10 flex items-center justify-center overflow-hidden transition-all group-hover:border-orange-500">
                  {config.logoUrl ? (
                    <img src={config.logoUrl} alt="Preview" className="w-full h-full object-contain" />
                  ) : (
                    <Upload className="text-gray-600" size={32} />
                  )}
                </div>
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleLogoUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <div className="absolute -bottom-2 -right-2 p-2 bg-orange-600 rounded-lg shadow-lg text-white opacity-0 group-hover:opacity-100 transition-opacity">
                  <Upload size={16} />
                </div>
              </div>
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-bold text-gray-500 uppercase ml-1">Shop Name</label>
              <div className="relative">
                <Store className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" size={18} />
                <input 
                  type="text" 
                  required
                  value={config.shopName}
                  onChange={(e) => setConfig({ ...config, shopName: e.target.value })}
                  className="w-full bg-black/40 border border-white/10 rounded-2xl pl-12 pr-4 py-3 focus:border-orange-500 outline-none transition-all"
                  placeholder="عالم الصيانة والتجارة"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-500 uppercase ml-1">Fiscal Year</label>
              <div className="relative">
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" size={18} />
                <input 
                  type="text" 
                  required
                  value={config.fiscalYear}
                  onChange={(e) => setConfig({ ...config, fiscalYear: e.target.value })}
                  className="w-full bg-black/40 border border-white/10 rounded-2xl pl-12 pr-4 py-3 focus:border-orange-500 outline-none transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-500 uppercase ml-1">Start Date</label>
              <input 
                type="date" 
                required
                value={config.startDate}
                onChange={(e) => setConfig({ ...config, startDate: e.target.value })}
                className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 focus:border-orange-500 outline-none transition-all"
              />
            </div>
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-orange-900/20 flex items-center justify-center gap-2 group"
          >
            {loading ? <Loader2 size={20} className="animate-spin" /> : (
              <>
                Finalize Setup
                <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

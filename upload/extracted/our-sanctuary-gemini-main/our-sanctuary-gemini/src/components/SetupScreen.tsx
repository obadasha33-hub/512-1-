/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { KeyRound, Plus, Heart } from 'lucide-react';

interface SetupScreenProps {
  onComplete: (data: { identity: 'Batman' | 'Princess', vaultId: string }) => void;
}

export default function SetupScreen({ onComplete }: SetupScreenProps) {
  const [step, setStep] = useState<'vault' | 'identity'>('vault');
  const [joinCode, setJoinCode] = useState('');
  const [vaultId, setVaultId] = useState<string | null>(null);

  const generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const handleCreateVault = () => {
    const newCode = generateCode();
    setVaultId(newCode);
    setStep('identity');
  };

  const handleJoinVault = (e: React.FormEvent) => {
    e.preventDefault();
    if (joinCode.trim().length >= 6) {
      setVaultId(joinCode.trim().toUpperCase());
      setStep('identity');
    } else {
      alert("Please enter a valid 6-character code");
    }
  };

  const handleIdentitySelect = (identity: 'Batman' | 'Princess') => {
    if (vaultId) {
      onComplete({ identity, vaultId });
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#FFF0F6]">
      <AnimatePresence mode="wait">
        {step === 'vault' ? (
          <motion.div 
            key="vault-step"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-sm flex flex-col items-center"
          >
            <div className="w-20 h-20 bg-rose-100 rounded-full flex items-center justify-center mb-6 shadow-md">
               <Heart size={40} className="text-rose-500 fill-rose-500" />
            </div>
            
            <h1 className="font-serif text-3xl font-bold text-[#4A0E26] mb-2 text-center">Your Sanctuary</h1>
            <p className="text-[#4A0E26]/60 mb-8 text-center text-sm">Create a new vault or join an existing one to connect with your partner.</p>
            
            <button
              onClick={handleCreateVault}
              className="w-full py-4 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-full font-bold shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all mb-6"
            >
              <Plus size={20} /> Create New Vault
            </button>
            
            <div className="w-full flex items-center gap-4 mb-6">
              <div className="h-px bg-rose-200 flex-1"></div>
              <span className="text-rose-400 text-xs font-semibold uppercase tracking-wider">OR</span>
              <div className="h-px bg-rose-200 flex-1"></div>
            </div>

            <form onSubmit={handleJoinVault} className="w-full bg-white p-4 rounded-3xl shadow-md border border-rose-100">
              <div className="flex bg-rose-50/50 rounded-2xl items-center p-2 mb-4">
                <KeyRound size={20} className="text-rose-400 ms-2" />
                <input 
                  type="text" 
                  placeholder="Enter 6-char code" 
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  maxLength={6}
                  className="bg-transparent border-none outline-none flex-1 p-2 uppercase placeholder:normal-case font-mono tracking-widest text-center text-lg text-[#4A0E26] font-bold"
                />
              </div>
              <button
                type="submit"
                className="w-full py-3 bg-white border border-rose-200 text-rose-600 rounded-full font-semibold active:scale-95 transition-all"
              >
                Join Partner's Vault
              </button>
            </form>
          </motion.div>
        ) : (
          <motion.div 
            key="identity-step"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md"
          >
            <div className="text-center mb-8">
              <h1 className="font-serif text-3xl font-bold text-[#4A0E26] mb-2">Who are you?</h1>
              {vaultId && (
                <div className="inline-flex items-center gap-2 bg-rose-100 px-4 py-1.5 rounded-full mt-2">
                  <span className="text-xs text-rose-600 font-medium">Vault Code:</span>
                  <span className="font-mono font-bold tracking-widest text-rose-800">{vaultId}</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleIdentitySelect('Batman')}
                className="flex flex-col items-center gap-4 p-6 bg-white rounded-3xl shadow-lg border-2 border-transparent hover:border-[#FF4D94] transition-colors"
              >
                <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-[#FFF0F6] bg-slate-900 flex items-center justify-center text-6xl shadow-inner">
                  🦇
                </div>
                <span className="font-semibold text-lg text-[#101C2B]">Your Batman 🌟</span>
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleIdentitySelect('Princess')}
                className="flex flex-col items-center gap-4 p-6 bg-white rounded-3xl shadow-lg border-2 border-transparent hover:border-[#FF4D94] transition-colors"
              >
                <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-[#FFF0F6] bg-pink-100 flex items-center justify-center text-6xl shadow-inner">
                  🎀
                </div>
                <span className="font-semibold text-lg text-[#101C2B]">My Princess 🎀👸</span>
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

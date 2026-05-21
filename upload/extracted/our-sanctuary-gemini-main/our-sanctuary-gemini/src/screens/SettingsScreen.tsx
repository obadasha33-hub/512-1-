/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { ReactNode, Dispatch, SetStateAction } from 'react';
import { motion } from 'motion/react';
import { AppState, THEMES, ThemeName, FONTS, FontStyle, NotificationSettings, DEFAULT_NOTIFICATION_SETTINGS } from '../types';
import { ASSETS } from '../constants';
import { Download, Fingerprint, LogOut, CheckCircle2, Type, Palette, Camera, Image as ImageIcon, Share2, Heart, Cloud, RefreshCw, ShieldCheck, Bell, Volume2, Vibrate, Eye, MessageCircle, Sparkles, Smile } from 'lucide-react';
import { createBackup, downloadBackupFile } from '../lib/backup';
import { setNotificationSettings, resetNotificationService } from '../lib/notificationService';

export const SettingsScreen = React.memo(function SettingsScreen({ 
  state, 
  setState,
  deferredPrompt,
  setDeferredPrompt
}: { 
  state: AppState, 
  setState: Dispatch<SetStateAction<AppState>>,
  deferredPrompt?: any,
  setDeferredPrompt?: any
}) {
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [isConfirmingReset, setIsConfirmingReset] = React.useState(false);

  const syncNames = async (updates: Partial<AppState>) => {
    if (!state.vaultId) return;
    const { doc, setDoc } = await import('../lib/supabaseFirestoreCompat');
    const { db } = await import('../lib/supabaseFirestoreCompat');
    await setDoc(doc(db, "couples", state.vaultId), {
      ...updates,
      lastUpdated: new Date().toISOString()
    }, { merge: true });
  };

  const toggleNotif = (key: keyof NotificationSettings) => {
    const current = state.notificationSettings || { ...DEFAULT_NOTIFICATION_SETTINGS };
    const updated = { ...current, [key]: !current[key] };
    setState(s => ({ ...s, notificationSettings: updated }));
    setNotificationSettings(updated);
    localStorage.setItem('after-dark-notification-settings', JSON.stringify(updated));
    syncNames({ notificationSettings: updated });
  };

  const forceSync = async () => {
    if (!state.vaultId) return;
    setIsSyncing(true);
    try {
      const { doc, setDoc } = await import('../lib/supabaseFirestoreCompat');
      const { db } = await import('../lib/supabaseFirestoreCompat');
      
      const { identity, currentTab, ...backupData } = state;
      
      await setDoc(doc(db, "couples", state.vaultId), {
        ...backupData,
        lastSyncedAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      }, { merge: true });
      
      setState(s => ({ ...s, lastSyncedAt: new Date().toISOString() }));
      alert("Cloud sync complete!");
    } catch (e) {
      console.error("Manual sync failed", e);
    } finally {
      setIsSyncing(false);
    }
  };

  const shareApp = () => {
    const url = window.location.origin;
    navigator.clipboard.writeText(url);
    alert("Share this link with your partner and both sign in to sync! 💖");
  };

  return (
    <div className="flex flex-col gap-10 pb-8">
      {/* Sync Status */}
      <section className="bg-gradient-to-br from-pink-500 to-rose-600 rounded-[2.5rem] p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col gap-3">
          <h3 className="text-xl font-bold mb-1">Sync Your Vault</h3>
          <p className="text-white/80 text-sm mb-2 leading-relaxed">
            Invite your partner to this private space using your Vault Code.
          </p>
          
          <div className="bg-white/10 rounded-2xl p-4 flex flex-col items-center border border-white/20 mb-2">
            <span className="text-xs uppercase tracking-widest text-white/70 mb-1">Your Vault Code</span>
            <span className="font-mono text-3xl font-bold tracking-[0.2em]">{state.vaultId || '------'}</span>
            <button 
              onClick={() => {
                navigator.clipboard.writeText(state.vaultId || '');
                alert('Vault code copied! Send this to your partner.');
              }}
              className="mt-3 text-xs bg-white text-rose-600 px-4 py-1.5 rounded-full font-bold uppercase tracking-wider"
            >
              Copy Code
            </button>
          </div>

          {deferredPrompt && (
            <button 
              onClick={async () => {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                if (outcome === 'accepted') {
                  setDeferredPrompt(null);
                }
              }}
              className="w-full py-3 bg-rose-800 text-white border-white/20 border rounded-full font-bold text-sm shadow-[inset_0_2px_10px_rgba(0,0,0,0.2)] active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <Download size={18} /> Install App
            </button>
          )}
          <button 
            onClick={async () => {
              try {
                const { Capacitor } = await import('@capacitor/core');
                if (Capacitor.isNativePlatform()) {
                  const { LocalNotifications } = await import('@capacitor/local-notifications');
                  await LocalNotifications.requestPermissions();
                } else if ("Notification" in window) {
                  await Notification.requestPermission();
                }
              } catch (e) {
                console.error("Failed to request notification permission", e);
              }
              alert("Notification permission requested successfully");
            }}
            className="w-full py-3 bg-rose-800/50 text-white border-white/20 border rounded-full font-bold text-sm active:scale-95 transition-all flex items-center justify-center gap-2 mt-2"
          >
            Enable Notifications
          </button>
          <button 
            onClick={() => {
              try {
                const backup = createBackup(state);
                downloadBackupFile(backup);
              } catch (e) {
                console.error('Export failed:', e);
                alert('Failed to export backup. Check console for details.');
              }
            }}
            className="w-full py-3 bg-rose-800/30 text-white border-white/20 border rounded-full font-bold text-sm active:scale-95 transition-all flex items-center justify-center gap-2 mt-2"
          >
            <Download size={16} /> Export Vault Data
          </button>
        </div>
        <div className="absolute top-0 end-0 -translate-y-1/4 translate-x-1/4 opacity-10 pointer-events-none">
          <Heart size={200} fill="white" />
        </div>
      </section>

      {/* Identities */}
      <section className="flex flex-col gap-4">
        <h2 className="font-serif text-2xl font-bold text-[var(--color-primary)]">Identities</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ProfileCard 
            title="Princess" 
            name={state.princessName} 
            img={state.princessPhoto || ASSETS.profiles.princess} 
            vaultId={state.vaultId}
            onNameChange={(name) => {
              const updates = { princessName: name };
              setState(s => ({ ...s, ...updates }));
              syncNames(updates);
            }}
            onPhotoChange={(url) => {
              const updates = { princessPhoto: url };
              setState(s => ({ ...s, ...updates }));
              syncNames(updates);
            }}
          />
          <ProfileCard 
            title="Batman" 
            name={state.batmanName} 
            img={state.batmanPhoto || ASSETS.profiles.batman} 
            vaultId={state.vaultId}
            onNameChange={(name) => {
              const updates = { batmanName: name };
              setState(s => ({ ...s, ...updates }));
              syncNames(updates);
            }}
            onPhotoChange={(url) => {
              const updates = { batmanPhoto: url };
              setState(s => ({ ...s, ...updates }));
              syncNames(updates);
            }}
          />
        </div>
      </section>

      {/* Themes */}
      <section className="flex flex-col gap-4">
        <h2 className="font-serif text-2xl font-bold text-[var(--color-primary)] flex items-center gap-2">
          <Palette size={24} /> Sanctuary Vibe
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {(Object.keys(THEMES) as ThemeName[]).map((themeName) => (
            <button
              key={themeName}
              onClick={() => {
                setState(s => ({ ...s, theme: themeName }));
              }}
              className={`
                p-2 rounded-3xl bg-white border-2 transition-all flex flex-col items-center gap-2 group
                ${state.theme === themeName ? 'border-[var(--color-primary)] shadow-md translate-y-[-4px]' : 'border-transparent hover:border-gray-200'}
              `}
            >
              <div 
                className="w-full aspect-square rounded-2xl relative shadow-inner"
                style={{ background: `linear-gradient(135deg, ${THEMES[themeName].primaryContainer}, ${THEMES[themeName].primary})` }}
              >
                {state.theme === themeName && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <CheckCircle2 className="text-white drop-shadow-md" size={32} />
                  </div>
                )}
              </div>
              <span className="text-xs font-bold text-gray-600">{themeName}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Font Style */}
      <section className="flex flex-col gap-4">
        <h2 className="font-serif text-2xl font-bold text-[var(--color-primary)] flex items-center gap-2">
          <Type size={24} /> Font Style
        </h2>
        <div className="grid grid-cols-3 gap-3">
          {(Object.keys(FONTS) as FontStyle[]).map((fontName) => (
            <button
              key={fontName}
              onClick={() => {
                setState(s => ({ ...s, font: fontName }));
                syncNames({ font: fontName });
              }}
              className={`p-4 rounded-2xl bg-white border-2 transition-all text-center ${
                state.font === fontName 
                  ? 'border-[var(--color-primary)] shadow-md' 
                  : 'border-transparent hover:border-gray-200'
              }`}
              style={{ fontFamily: FONTS[fontName] }}
            >
              <span className="text-sm font-bold block">{fontName}</span>
              <span className="text-[10px] text-gray-400 mt-1 block">Aa Bb Cc</span>
            </button>
          ))}
        </div>
      </section>

      {/* Chat Customization */}
      <section className="flex flex-col gap-4">
        <h2 className="font-serif text-2xl font-bold text-[var(--color-primary)] flex items-center gap-2">
           Chat Wallpaper
        </h2>
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-black/5 flex flex-col gap-6">
           <div className="flex justify-between items-center">
             <div>
               <p className="font-semibold text-sm">Custom Wallpaper</p>
               <p className="text-[10px] text-gray-400 font-medium">Add an image to the chat background</p>
             </div>
             <div className="flex gap-2">
               {state.chatWallpaper && (
                  <button onClick={() => {
                     const updates = { chatWallpaper: undefined };
                     setState(s => ({ ...s, ...updates }));
                     syncNames(updates);
                  }} className="text-xs text-red-500 font-bold border rounded-full px-3 py-1">
                    Remove
                  </button>
               )}
               <label className="text-xs text-white bg-[var(--color-primary)] font-bold rounded-full px-3 py-1 cursor-pointer">
                 {state.chatWallpaper ? 'Change' : 'Upload'}
                 <input 
                   type="file" 
                   accept="image/*" 
                   className="hidden" 
                   onChange={async (e) => {
                     const file = e.target.files?.[0];
                     if (file) {
                        try {
                           const { uploadMedia } = await import('../lib/media');
                           const url = await uploadMedia(file, state.vaultId);
                           const updates = { chatWallpaper: url };
                           setState(s => ({ ...s, ...updates }));
                           syncNames(updates);
                        } catch (err) {
                           console.error(err);
                        }
                     }
                   }}
                 />
               </label>
             </div>
           </div>
        </div>
      </section>

      {/* AI Configuration */}
      <section className="flex flex-col gap-4">
        <h2 className="font-serif text-2xl font-bold text-[var(--color-primary)]">AI Settings</h2>
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-black/5 flex flex-col gap-4">
          <p className="text-xs text-gray-500">Provide your OpenRouter API key to use your own AI. Leave empty to use default free models (limited).</p>
          <input 
            type="password"
            placeholder="sk-or-v1-..."
            value={state.geminiApiKey || ''}
            onChange={(e) => {
              const updates = { geminiApiKey: e.target.value };
              setState(s => ({ ...s, ...updates }));
              localStorage.setItem('after-dark-gemini-api-key', e.target.value);
            }}
            className="w-full bg-gray-50 border border-black/10 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-[var(--color-primary)]/20 outline-none"
          />
        </div>
      </section>

      {/* Notification Settings */}
      <section className="flex flex-col gap-4">
        <h2 className="font-serif text-2xl font-bold text-[var(--color-primary)] flex items-center gap-2">
          <Bell size={24} /> Notifications
        </h2>
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-black/5 flex flex-col gap-4">
          <ToggleItem 
            icon={<MessageCircle size={20} />} 
            label="New Messages" 
            sub="Notify on incoming messages" 
            checked={state.notificationSettings?.messages ?? true} 
            onClick={() => toggleNotif('messages')}
          />
          <ToggleItem 
            icon={<Heart size={20} />} 
            label="Signals" 
            sub="Miss, hug, and kiss signals" 
            checked={state.notificationSettings?.signals ?? true} 
            onClick={() => toggleNotif('signals')}
          />
          <ToggleItem 
            icon={<Sparkles size={20} />} 
            label="New Memories" 
            sub="Notify on partner's new memory" 
            checked={state.notificationSettings?.memories ?? true} 
            onClick={() => toggleNotif('memories')}
          />
          <ToggleItem 
            icon={<Smile size={20} />} 
            label="Mood Updates" 
            sub="Notify when partner updates mood" 
            checked={state.notificationSettings?.moodUpdates ?? true} 
            onClick={() => toggleNotif('moodUpdates')}
          />
          <div className="border-t border-gray-100 pt-4 mt-2">
            <ToggleItem 
              icon={<Volume2 size={20} />} 
              label="Sound" 
              sub="Play sound for notifications" 
              checked={state.notificationSettings?.sound ?? true} 
              onClick={() => toggleNotif('sound')}
            />
            <ToggleItem 
              icon={<Vibrate size={20} />} 
              label="Vibration" 
              sub="Vibrate on notification" 
              checked={state.notificationSettings?.vibration ?? true} 
              onClick={() => toggleNotif('vibration')}
            />
            <ToggleItem 
              icon={<Eye size={20} />} 
              label="Show Preview" 
              sub="Show message preview in notification" 
              checked={state.notificationSettings?.showPreview ?? true} 
              onClick={() => toggleNotif('showPreview')}
            />
          </div>
        </div>
      </section>

      {/* Privacy */}
      <section className="flex flex-col gap-4">
        <h2 className="font-serif text-2xl font-bold text-[var(--color-primary)]">Data & Cloud</h2>
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-black/5 flex flex-col gap-6">
          <ToggleItem 
            icon={<Cloud size={20} />} 
            label="Automatic Cloud Sync" 
            sub="Backup state in background" 
            checked={!!state.autoSync} 
            onClick={() => {
              const newState = !state.autoSync;
              setState(s => ({ ...s, autoSync: newState }));
              syncNames({ autoSync: newState });
            }}
          />
          
          <div className="pt-4 border-t border-gray-100 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex gap-4 items-center">
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-500">
                  <RefreshCw size={20} className={isSyncing ? 'animate-spin' : ''} />
                </div>
                <div>
                  <p className="font-semibold text-sm">Force Cloud Backup</p>
                  <p className="text-[10px] text-gray-400 font-medium">
                    {state.lastSyncedAt 
                      ? `Last synced: ${new Date(state.lastSyncedAt).toLocaleString()}` 
                      : 'Never backed up manually'}
                  </p>
                </div>
              </div>
              <button 
                onClick={forceSync}
                disabled={isSyncing}
                className="px-4 py-2 bg-blue-500 text-white rounded-full text-xs font-bold shadow-sm active:scale-95 disabled:opacity-50"
              >
                Sync Now
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Security */}
      <section className="flex flex-col gap-4">
        <h2 className="font-serif text-2xl font-bold text-[var(--color-primary)]">Security</h2>
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-black/5 flex flex-col gap-6">
          <ToggleItem 
            icon={<ShieldCheck size={20} />} 
            label="End-to-End Encryption" 
            sub={state.encryptionKey ? "Data is encrypted in transit and cloud" : "Set a key to encrypt your data"} 
            checked={!!state.encryptionKey} 
            onClick={() => {
              const key = prompt("Enter an encryption key (Passphrase). Both partners must use the same key to decrypt data.", state.encryptionKey || "");
              if (key !== null) {
                setState(s => ({ ...s, encryptionKey: key }));
                localStorage.setItem('after-dark-encryption-key', key);
              }
            }}
          />
        </div>
      </section>

      {isConfirmingReset ? (
        <div className="w-full p-4 rounded-3xl bg-red-50 border border-red-100 flex flex-col gap-3">
          <p className="text-red-600 text-sm text-center font-semibold">Are you sure? This will clear your local connection to the vault.</p>
          <div className="flex gap-2">
            <button 
              onClick={() => setIsConfirmingReset(false)}
              className="flex-1 py-3 rounded-full bg-white text-gray-600 font-bold hover:bg-gray-50 transition-colors text-sm shadow-sm"
            >
              Cancel
            </button>
            <button 
              onClick={() => {
                setIsConfirmingReset(false);
                resetNotificationService();
                setState(s => ({ ...s, identity: null, vaultId: undefined }));
              }}
              className="flex-1 py-3 rounded-full bg-red-500 text-white font-bold hover:bg-red-600 transition-colors text-sm shadow-sm"
            >
              Yes, Reset
            </button>
          </div>
        </div>
      ) : (
        <button 
          onClick={() => setIsConfirmingReset(true)}
          className="w-full py-4 rounded-full bg-[var(--color-surface-container)] text-red-500 font-bold hover:bg-red-50 transition-colors flex items-center justify-center gap-2 mt-4"
        >
          <LogOut size={20} /> Reset App (Sign Out)
        </button>
      )}
    </div>
  );
});

const ProfileCard = React.memo(function ProfileCard({ 
  title, 
  name, 
  img, 
  vaultId,
  onNameChange, 
  onPhotoChange 
}: ProfileCardProps & { onPhotoChange: (url: string) => void }) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [editValue, setEditValue] = React.useState(name);
  const [isUploading, setIsUploading] = React.useState(false);
  const profileInputRef = React.useRef<HTMLInputElement>(null);
  const bgInputRef = React.useRef<HTMLInputElement>(null);

  const handleProfileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const { uploadMedia } = await import('../lib/media');
      const url = await uploadMedia(file, vaultId);
      onPhotoChange(url);
    } catch (err) {
      console.error(err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const { uploadMedia } = await import('../lib/media');
      const url = await uploadMedia(file, vaultId);
      onPhotoChange(url);
    } catch (err) {
      console.error(err);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="bg-white/40 backdrop-blur-xl rounded-3xl p-6 border border-black/5 flex flex-col items-center text-center gap-4 group">
      <input type="file" ref={profileInputRef} className="hidden" accept="image/*" onChange={handleProfileUpload} />
      <input type="file" ref={bgInputRef} className="hidden" accept="image/*" onChange={handleBgUpload} />
      
      <div className="relative">
        <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white shadow-lg flex items-center justify-center bg-gray-100">
          {isUploading ? (
            <div className="animate-spin text-[var(--color-primary)]">
              <Camera size={32} />
            </div>
          ) : (
            <img src={img} alt={title} className="w-full h-full object-cover" />
          )}
        </div>
        <div 
          onClick={() => profileInputRef.current?.click()}
          className="absolute inset-0 bg-black/20 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
        >
          <Camera size={24} className="text-white" />
        </div>
      </div>
      
      <div className="w-full">
        <span className="text-[10px] font-bold uppercase text-gray-400 tracking-widest">{title}</span>
        {isEditing ? (
          <input 
            autoFocus
            className="w-full text-center bg-transparent border-b-2 border-[var(--color-primary)] font-bold text-lg outline-none"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={() => {
              setIsEditing(false);
              if (editValue !== name) onNameChange(editValue);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setIsEditing(false);
                if (editValue !== name) onNameChange(editValue);
              }
            }}
          />
        ) : (
          <p 
            onClick={() => {
              setIsEditing(true);
              if (!name) setEditValue('');
            }}
            className="font-bold text-lg cursor-pointer hover:text-[var(--color-primary)] transition-colors min-h-[1.75rem]"
            title="Click to edit name"
          >
            {name || <span className="text-gray-400 italic text-sm">Set Name...</span>}
          </p>
        )}
      </div>
      
      <div className="flex gap-2 w-full">
        <button 
          onClick={() => bgInputRef.current?.click()}
          className="flex-1 text-[10px] font-bold uppercase tracking-widest p-2 bg-gray-50 rounded-full hover:bg-gray-100 transition-colors flex items-center justify-center gap-1"
        >
          <ImageIcon size={14} /> Bg
        </button>
        <button 
          onClick={() => profileInputRef.current?.click()}
          className="flex-1 text-[10px] font-bold uppercase tracking-widest p-2 bg-gray-50 rounded-full hover:bg-gray-100 transition-colors flex items-center justify-center gap-1"
        >
          <Camera size={14} /> Profile
        </button>
      </div>
    </div>
  );
});

const ToggleItem = React.memo(function ToggleItem({ 
  icon, 
  label, 
  sub, 
  checked, 
  onClick 
}: { 
  icon: React.ReactNode, 
  label: string, 
  sub: string, 
  checked: boolean,
  onClick: () => void
}) {
  return (
    <div 
      className="flex items-center justify-between cursor-pointer group"
      onClick={onClick}
    >
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-[var(--color-primary)] transition-colors group-hover:bg-gray-100">
          {icon}
        </div>
        <div>
          <p className="font-semibold text-sm">{label}</p>
          <p className="text-[10px] text-gray-400 font-medium">{sub}</p>
        </div>
      </div>
      <div className={`w-12 h-6 rounded-full p-1 transition-colors ${checked ? 'bg-[var(--color-primary)]' : 'bg-gray-200'}`}>
        <div className={`w-4 h-4 bg-white rounded-full transition-transform ${checked ? 'translate-x-6' : 'translate-x-0'}`} />
      </div>
    </div>
  );
});

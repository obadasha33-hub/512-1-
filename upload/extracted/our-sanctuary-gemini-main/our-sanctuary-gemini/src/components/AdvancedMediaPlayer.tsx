/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ZoomIn, ZoomOut, RotateCcw, Share2, Download, Play, Pause, Volume2, VolumeX } from 'lucide-react';

interface AdvancedMediaPlayerProps {
  src: string;
  onClose: () => void;
  title?: string;
  date?: string;
}

export default function AdvancedMediaPlayer({ src, onClose, title, date }: AdvancedMediaPlayerProps) {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const isVideo = src.toLowerCase().match(/\.(mp4|webm|ogg)$/) || src.startsWith('data:video/');

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) videoRef.current.pause();
      else videoRef.current.play();
      setIsPlaying(!isPlaying);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center p-4 backdrop-blur-md"
    >
      {/* Header */}
      <div className="absolute top-0 start-0 end-0 p-6 flex justify-between items-start z-10 bg-gradient-to-b from-black/50 to-transparent">
        <div className="text-white">
          {title && <h3 className="font-bold text-lg">{title}</h3>}
          {date && <p className="text-white/60 text-xs uppercase tracking-widest">{date}</p>}
        </div>
        <button 
          onClick={onClose}
          className="p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
        >
          <X size={24} />
        </button>
      </div>

      {/* Main View */}
      <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
        {isVideo ? (
          <div className="relative w-full h-full flex items-center justify-center">
            <video
              ref={videoRef}
              src={src}
              className="max-w-full max-h-full shadow-2xl"
              loop
              muted={isMuted}
              onClick={togglePlay}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            />
            {!isPlaying && (
              <button 
                onClick={togglePlay}
                className="absolute inset-0 flex items-center justify-center text-white/50 hover:text-white transition-colors"
              >
                <div className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center">
                  <Play size={48} fill="currentColor" />
                </div>
              </button>
            )}
          </div>
        ) : (
          <motion.img
            src={src}
            alt="Media Content"
            className="max-w-full max-h-full object-contain shadow-2xl"
            animate={{ scale, rotate: rotation }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            drag
            dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
          />
        )}
      </div>

      {/* Controls */}
      <div className="absolute bottom-10 start-1/2 -translate-x-1/2 flex items-center gap-2 bg-white/10 backdrop-blur-lg p-2 rounded-full border border-white/10 z-10">
        {isVideo ? (
          <>
            <ControlBtn icon={isPlaying ? <Pause size={20} /> : <Play size={20} />} onClick={togglePlay} />
            <ControlBtn icon={isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />} onClick={() => setIsMuted(!isMuted)} />
            <div className="w-[1px] h-6 bg-white/10 mx-1" />
          </>
        ) : (
          <>
            <ControlBtn icon={<ZoomOut size={20} />} onClick={() => setScale(s => Math.max(0.5, s - 0.25))} />
            <div className="w-[1px] h-6 bg-white/10 mx-1" />
            <ControlBtn icon={<RotateCcw size={20} />} onClick={() => setRotation(r => r - 90)} />
            <ControlBtn icon={<RotateCcw size={20} className="scale-x-[-1]" />} onClick={() => setRotation(r => r + 90)} />
            <div className="w-[1px] h-6 bg-white/10 mx-1" />
            <ControlBtn icon={<ZoomIn size={20} />} onClick={() => setScale(s => Math.min(4, s + 0.25))} />
          </>
        )}
        <div className="w-[1px] h-6 bg-white/10 mx-1" />
        <ControlBtn icon={<Share2 size={20} />} onClick={() => {
          if (navigator.share) {
            navigator.share({ title: title || 'Shared moment', url: src }).catch(console.error);
          } else {
            alert('Sharing not supported on this browser');
          }
        }} />
      </div>
    </motion.div>
  );
}

function ControlBtn({ icon, onClick, className = "" }: { icon: React.ReactNode, onClick: () => void, className?: string }) {
  return (
    <button 
      onClick={onClick}
      className={`p-3 text-white hover:bg-white/10 rounded-full transition-colors active:scale-90 ${className}`}
    >
      {icon}
    </button>
  );
}

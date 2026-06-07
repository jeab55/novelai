import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Play, Pause, Square, Volume2, X, ChevronDown } from "lucide-react";

const SPEEDS = [
  { label: "0.8×", value: 0.8 },
  { label: "1×", value: 1 },
  { label: "1.2×", value: 1.2 },
];

export default function TextToSpeechPanel({ content, onClose }) {
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [speed, setSpeed] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [noThaiVoice, setNoThaiVoice] = useState(false);
  const uttRef = useRef(null);

  // โหลดรายการเสียง
  useEffect(() => {
    const loadVoices = () => {
      const all = window.speechSynthesis.getVoices();
      if (!all.length) return;

      // กรองเสียงภาษาไทยก่อน ถ้าไม่มีเอาทั้งหมด
      const thaiVoices = all.filter((v) => v.lang.startsWith("th"));
      const available = thaiVoices.length ? thaiVoices : all;

      setVoices(available);
      setSelectedVoice(available[0]?.name || null);

      if (!thaiVoices.length) setNoThaiVoice(true);
    };

    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
  }, []);

  // หยุดเมื่อปิด panel
  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  const cleanText = (raw) => {
    if (!raw) return "";
    return raw.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  };

  const handlePlay = () => {
    if (isPaused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
      setIsPlaying(true);
      return;
    }

    window.speechSynthesis.cancel();
    const text = cleanText(content);
    if (!text) return;

    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = speed;
    utt.lang = "th-TH";

    const voice = voices.find((v) => v.name === selectedVoice);
    if (voice) utt.voice = voice;

    utt.onend = () => { setIsPlaying(false); setIsPaused(false); };
    utt.onerror = () => { setIsPlaying(false); setIsPaused(false); };

    uttRef.current = utt;
    window.speechSynthesis.speak(utt);
    setIsPlaying(true);
    setIsPaused(false);
  };

  const handlePause = () => {
    window.speechSynthesis.pause();
    setIsPaused(true);
    setIsPlaying(false);
  };

  const handleStop = () => {
    window.speechSynthesis.cancel();
    setIsPlaying(false);
    setIsPaused(false);
  };

  return (
    <div className="border-b border-border/60 bg-amber-50/60 px-4 py-2.5">
      <div className="flex items-center gap-2 flex-wrap">
        {/* ชื่อ */}
        <div className="flex items-center gap-1.5 text-xs font-medium text-amber-800 shrink-0">
          <Volume2 className="w-3.5 h-3.5" />
          อ่านด้วยเสียง
        </div>

        {noThaiVoice && (
          <span className="text-xs text-amber-700/80 bg-amber-100 px-2 py-0.5 rounded-full">
            ไม่พบเสียงภาษาไทยในอุปกรณ์ — ใช้เสียงเริ่มต้นแทน
          </span>
        )}

        {/* เลือกเสียง */}
        {voices.length > 1 && (
          <Select value={selectedVoice || ""} onValueChange={setSelectedVoice}>
            <SelectTrigger className="h-7 text-xs w-40 bg-white/70 border-amber-200">
              <SelectValue placeholder="เลือกเสียง" />
            </SelectTrigger>
            <SelectContent>
              {voices.map((v) => (
                <SelectItem key={v.name} value={v.name} className="text-xs">
                  {v.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* ความเร็ว */}
        <div className="flex items-center gap-1 rounded-md border border-amber-200 bg-white/70 p-0.5">
          {SPEEDS.map((s) => (
            <button
              key={s.value}
              onClick={() => setSpeed(s.value)}
              className={`px-2 py-0.5 rounded text-xs transition-colors ${
                speed === s.value
                  ? "bg-amber-700 text-white"
                  : "text-amber-800 hover:bg-amber-100"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* ปุ่มควบคุม */}
        <div className="flex items-center gap-1 ml-1">
          {!isPlaying ? (
            <Button
              size="sm"
              className="h-7 px-3 text-xs gap-1 bg-amber-700 hover:bg-amber-800 text-white"
              onClick={handlePlay}
              disabled={!content}
            >
              <Play className="w-3 h-3 fill-current" />
              {isPaused ? "ต่อ" : "เล่น"}
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-3 text-xs gap-1 border-amber-300 text-amber-800 hover:bg-amber-100"
              onClick={handlePause}
            >
              <Pause className="w-3 h-3" />
              หยุดชั่วคราว
            </Button>
          )}

          {(isPlaying || isPaused) && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs text-amber-700 hover:bg-amber-100"
              onClick={handleStop}
            >
              <Square className="w-3 h-3 fill-current" />
            </Button>
          )}
        </div>

        {/* ปุ่มปิด */}
        <button
          onClick={() => { handleStop(); onClose(); }}
          className="ml-auto text-amber-600/70 hover:text-amber-800 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
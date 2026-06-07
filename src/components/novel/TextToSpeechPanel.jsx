import React, { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Play, Pause, Square, Volume2, X } from "lucide-react";

const SPEEDS = [
  { label: "0.8×", value: 0.8 },
  { label: "1×", value: 1 },
  { label: "1.2×", value: 1.2 },
];

// ทำความสะอาดและแบ่งเนื้อหาเป็นประโยคย่อย
function prepareSegments(raw) {
  if (!raw) return [];

  let text = raw
    // ตัด HTML tags
    .replace(/<[^>]*>/g, " ")
    // ตัด Markdown syntax
    .replace(/#{1,6}\s/g, " ")
    .replace(/(\*{1,3}|_{1,3})(.*?)\1/g, "$2")
    .replace(/`{1,3}[^`]*`{1,3}/g, " ")
    .replace(/!\[.*?\]\(.*?\)/g, " ")
    .replace(/\[.*?\]\(.*?\)/g, " ")
    .replace(/[-*_]{3,}/g, " ")
    // ตัดบรรทัดว่างซ้ำ
    .replace(/\n{2,}/g, "\n")
    // ช่องว่างซ้ำ
    .replace(/[ \t]{2,}/g, " ")
    .trim();

  if (!text) return [];

  // แบ่งตามเครื่องหมายวรรค ๆ ฯ . ! ? และบรรทัดใหม่
  const raw_segments = text.split(/(?<=[ๆ.!?ฯ])\s+|\n/);

  return raw_segments
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export default function TextToSpeechPanel({ content, onClose }) {
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [speed, setSpeed] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [noThaiVoice, setNoThaiVoice] = useState(false);

  // refs ที่ไม่ trigger re-render
  const queueRef = useRef([]);         // array ของ string segments
  const indexRef = useRef(0);          // ตำแหน่งปัจจุบัน
  const activeRef = useRef(false);     // กำลังเล่นอยู่หรือเปล่า
  const pausedRef = useRef(false);     // pause state
  const resumeTimerRef = useRef(null); // Chrome keepalive timer
  const voicesRef = useRef([]);        // เก็บ voices ล่าสุดโดยไม่ให้ stale closure
  const selectedVoiceRef = useRef(null);
  const speedRef = useRef(1);

  // sync refs กับ state
  useEffect(() => { voicesRef.current = voices; }, [voices]);
  useEffect(() => { selectedVoiceRef.current = selectedVoice; }, [selectedVoice]);
  useEffect(() => { speedRef.current = speed; }, [speed]);

  // โหลดรายการเสียง
  useEffect(() => {
    const loadVoices = () => {
      const all = window.speechSynthesis.getVoices();
      if (!all.length) return;

      const thaiVoices = all.filter((v) => v.lang.startsWith("th"));
      const available = thaiVoices.length ? thaiVoices : all;

      setVoices(available);
      setSelectedVoice((prev) => prev || available[0]?.name || null);
      if (!thaiVoices.length) setNoThaiVoice(true);
    };

    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
  }, []);

  // cleanup เมื่อ unmount
  useEffect(() => {
    return () => {
      stopAll();
    };
  }, []);

  // Chrome bug fix: pause/resume ทุก 5 วินาทีระหว่างเล่น
  const startKeepAlive = useCallback(() => {
    stopKeepAlive();
    resumeTimerRef.current = setInterval(() => {
      if (activeRef.current && !pausedRef.current && window.speechSynthesis.speaking) {
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      }
    }, 5000);
  }, []);

  const stopKeepAlive = useCallback(() => {
    if (resumeTimerRef.current) {
      clearInterval(resumeTimerRef.current);
      resumeTimerRef.current = null;
    }
  }, []);

  // เล่น segment ที่ index ปัจจุบัน
  const speakCurrent = useCallback(() => {
    const queue = queueRef.current;
    const idx = indexRef.current;

    if (!activeRef.current || idx >= queue.length) {
      // จบแล้ว
      activeRef.current = false;
      indexRef.current = 0;
      stopKeepAlive();
      setIsPlaying(false);
      setIsPaused(false);
      return;
    }

    const text = queue[idx];
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = speedRef.current;
    utt.lang = "th-TH";

    const voice = voicesRef.current.find((v) => v.name === selectedVoiceRef.current);
    if (voice) utt.voice = voice;

    utt.onend = () => {
      if (!activeRef.current) return;
      indexRef.current += 1;
      speakCurrent();
    };

    utt.onerror = (e) => {
      // ข้าม interrupted error (เกิดจาก Chrome keepalive) ให้ไหลต่อ
      if (e.error === "interrupted") return;
      activeRef.current = false;
      stopKeepAlive();
      setIsPlaying(false);
      setIsPaused(false);
    };

    window.speechSynthesis.speak(utt);
  }, [stopKeepAlive]);

  const handlePlay = useCallback(() => {
    if (pausedRef.current) {
      // ต่อจากที่ค้างไว้
      pausedRef.current = false;
      activeRef.current = true;
      window.speechSynthesis.resume();
      startKeepAlive();
      setIsPaused(false);
      setIsPlaying(true);
      return;
    }

    // เริ่มใหม่
    window.speechSynthesis.cancel();
    const segments = prepareSegments(content);
    if (!segments.length) return;

    queueRef.current = segments;
    indexRef.current = 0;
    activeRef.current = true;
    pausedRef.current = false;

    startKeepAlive();
    setIsPlaying(true);
    setIsPaused(false);

    // ต้องรอ 1 tick หลัง cancel ก่อน speak (Chrome requirement)
    setTimeout(() => speakCurrent(), 50);
  }, [content, speakCurrent, startKeepAlive]);

  const handlePause = useCallback(() => {
    window.speechSynthesis.pause();
    pausedRef.current = true;
    activeRef.current = false;
    stopKeepAlive();
    setIsPaused(true);
    setIsPlaying(false);
  }, [stopKeepAlive]);

  const stopAll = useCallback(() => {
    activeRef.current = false;
    pausedRef.current = false;
    indexRef.current = 0;
    queueRef.current = [];
    stopKeepAlive();
    window.speechSynthesis.cancel();
    setIsPlaying(false);
    setIsPaused(false);
  }, [stopKeepAlive]);

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
              onClick={() => {
                setSpeed(s.value);
                // ถ้ากำลังเล่นอยู่ให้ restart segment ปัจจุบันด้วยความเร็วใหม่
                if (activeRef.current) {
                  speedRef.current = s.value;
                  window.speechSynthesis.cancel();
                  setTimeout(() => speakCurrent(), 50);
                }
              }}
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
              onClick={stopAll}
            >
              <Square className="w-3 h-3 fill-current" />
            </Button>
          )}
        </div>

        {/* ปุ่มปิด */}
        <button
          onClick={() => { stopAll(); onClose(); }}
          className="ml-auto text-amber-600/70 hover:text-amber-800 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
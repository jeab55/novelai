import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";
import { ArrowLeft, Key, Eye, EyeOff, CheckCircle2, AlertTriangle, Loader2, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export default function Settings() {
  const { user } = useAuth();
  const [apiKey, setApiKey] = useState("");
  const [maskedKey, setMaskedKey] = useState("");
  const [hasKey, setHasKey] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [testResult, setTestResult] = useState(null); // { ok, message }
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadKeyStatus();
  }, []);

  const loadKeyStatus = async () => {
    setLoading(true);
    const res = await base44.functions.invoke("saveUserApiKey", { action: "get" });
    setHasKey(!!res.data?.haKey);
    setMaskedKey(res.data?.maskedKey || "");
    setLoading(false);
  };

  const handleSave = async () => {
    if (!apiKey.trim()) return;
    setSaving(true);
    setTestResult(null);
    const res = await base44.functions.invoke("saveUserApiKey", { action: "save", apiKey: apiKey.trim() });
    setSaving(false);
    if (res.data?.error) {
      toast.error(res.data.error);
    } else {
      toast.success("บันทึก API key สำเร็จ");
      setApiKey("");
      setShowKey(false);
      await loadKeyStatus();
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    const res = await base44.functions.invoke("saveUserApiKey", { action: "test" });
    setTesting(false);
    if (res.data?.error) {
      setTestResult({ ok: false, message: res.data.error });
    } else {
      setTestResult({ ok: true, message: res.data.message || "API key ใช้งานได้ปกติ ✓" });
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    await base44.functions.invoke("saveUserApiKey", { action: "delete" });
    setDeleting(false);
    setHasKey(false);
    setMaskedKey("");
    setTestResult(null);
    toast.success("ลบ API key แล้ว");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/60 bg-card/80 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link to="/">
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <h1 className="text-lg font-heading font-bold">ตั้งค่า</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10 space-y-8">
        {/* OpenAI API key section */}
        <div className="bg-card border border-border/60 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-50 border border-violet-200 flex items-center justify-center">
              <Key className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <h2 className="font-heading font-semibold text-lg">OpenAI API Key</h2>
              <p className="text-sm text-muted-foreground">สำหรับฟีเจอร์สร้างภาพประกอบด้วย AI (DALL·E 3)</p>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="w-4 h-4 animate-spin" />
              กำลังโหลด...
            </div>
          ) : (
            <>
              {/* Current key status */}
              {hasKey && (
                <div className="flex items-center justify-between px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span className="text-sm font-medium text-emerald-700">มี API key บันทึกอยู่แล้ว</span>
                    <code className="text-xs text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded font-mono">{maskedKey}</code>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-emerald-700 hover:bg-emerald-100"
                      onClick={handleTest}
                      disabled={testing}
                    >
                      {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "ทดสอบ"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-red-600 hover:bg-red-50"
                      onClick={handleDelete}
                      disabled={deleting}
                    >
                      {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                </div>
              )}

              {/* Test result */}
              {testResult && (
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                  testResult.ok ? "bg-emerald-50 border border-emerald-200 text-emerald-700" : "bg-red-50 border border-red-200 text-red-700"
                }`}>
                  {testResult.ok
                    ? <CheckCircle2 className="w-4 h-4 shrink-0" />
                    : <AlertTriangle className="w-4 h-4 shrink-0" />
                  }
                  {testResult.message}
                </div>
              )}

              {/* Input new key */}
              <div className="space-y-2">
                <label className="text-sm font-medium">{hasKey ? "เปลี่ยน API key ใหม่" : "กรอก OpenAI API key"}</label>
                <div className="relative">
                  <Input
                    type={showKey ? "text" : "password"}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-..."
                    className="pr-10 font-mono text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  API key จะถูกเก็บอย่างปลอดภัยและใช้งานเฉพาะ backend เท่านั้น ไม่มีการแสดงค่าเต็ม
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleSave}
                  disabled={!apiKey.trim() || saving}
                  className="gap-2"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Key className="w-3.5 h-3.5" />}
                  {hasKey ? "อัปเดต API key" : "บันทึก API key"}
                </Button>
              </div>

              {/* Instructions */}
              <div className="px-4 py-3 bg-muted/40 rounded-xl text-xs text-muted-foreground space-y-1.5">
                <p className="font-medium text-foreground/70">วิธีรับ OpenAI API key:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>ไปที่ <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-primary underline inline-flex items-center gap-0.5">platform.openai.com/api-keys <ExternalLink className="w-2.5 h-2.5" /></a></li>
                  <li>สร้างบัญชีหรือเข้าสู่ระบบ</li>
                  <li>คลิก "Create new secret key"</li>
                  <li>คัดลอก key ที่ขึ้นต้นด้วย sk- มากรอกที่นี่</li>
                </ol>
                <p className="mt-2">การสร้างภาพแต่ละภาพใช้ประมาณ $0.04 (DALL·E 3 standard 1024×1024)</p>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Copy, X, UserPlus, Link as LinkIcon } from "lucide-react";

function generateToken() {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
}

export default function ShareNovelDialog({ open, onClose, novel }) {
  const [emailInput, setEmailInput] = useState("");
  const queryClient = useQueryClient();

  const sharedWith = novel?.shared_with || [];
  const publicToken = novel?.public_token || null;
  const publicUrl = publicToken ? `${window.location.origin}/novel/public/${publicToken}` : null;

  const updateNovel = useMutation({
    mutationFn: (data) => base44.entities.Novel.update(novel.id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["novels"] }),
  });

  const addEmail = () => {
    const email = emailInput.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      toast.error("กรุณากรอกอีเมลที่ถูกต้อง");
      return;
    }
    if (sharedWith.includes(email)) {
      toast.error("อีเมลนี้แชร์ไปแล้ว");
      return;
    }
    updateNovel.mutate({ shared_with: [...sharedWith, email] }, {
      onSuccess: () => {
        toast.success(`เชิญ ${email} สำเร็จ`);
        setEmailInput("");
      },
    });
  };

  const removeEmail = (email) => {
    updateNovel.mutate({ shared_with: sharedWith.filter((e) => e !== email) }, {
      onSuccess: () => toast.success(`ลบ ${email} ออกแล้ว`),
    });
  };

  const togglePublicLink = () => {
    if (publicToken) {
      updateNovel.mutate({ public_token: null }, {
        onSuccess: () => toast.success("ปิดลิงก์สาธารณะแล้ว"),
      });
    } else {
      const token = generateToken();
      updateNovel.mutate({ public_token: token }, {
        onSuccess: () => toast.success("เปิดลิงก์สาธารณะแล้ว"),
      });
    }
  };

  const copyLink = () => {
    if (publicUrl) {
      navigator.clipboard.writeText(publicUrl);
      toast.success("คัดลอกลิงก์แล้ว");
    }
  };

  if (!novel) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-lg">แชร์นิยาย</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-2">
          {/* Section 1: Invite collaborators */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <UserPlus className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold">เชิญผู้ร่วมเขียน</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              คนที่ได้รับเชิญจะสามารถเข้าถึงและแก้ไขเรื่องนี้ได้เหมือนเจ้าของ
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="กรอกอีเมล..."
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addEmail()}
                className="text-sm"
              />
              <Button size="sm" onClick={addEmail} disabled={updateNovel.isPending}>
                เชิญ
              </Button>
            </div>

            {sharedWith.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {sharedWith.map((email) => (
                  <li key={email} className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2">
                    <span className="text-sm truncate">{email}</span>
                    <button
                      onClick={() => removeEmail(email)}
                      className="ml-2 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {sharedWith.length === 0 && (
              <p className="text-xs text-muted-foreground mt-2 italic">ยังไม่ได้เชิญใคร</p>
            )}
          </div>

          <div className="border-t border-border/50" />

          {/* Section 2: Public read-only link */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <LinkIcon className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold">ลิงก์สาธารณะ (อ่านอย่างเดียว)</h3>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {publicToken ? "เปิดใช้งาน — ใครก็เข้าอ่านได้โดยไม่ต้องล็อกอิน" : "ปิดอยู่ — เปิดเพื่อสร้างลิงก์สาธารณะ"}
              </p>
              <Switch
                checked={!!publicToken}
                onCheckedChange={togglePublicLink}
                disabled={updateNovel.isPending}
              />
            </div>

            {publicToken && publicUrl && (
              <div className="mt-3 flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
                <span className="text-xs text-muted-foreground truncate flex-1">{publicUrl}</span>
                <button
                  onClick={copyLink}
                  className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
                  title="คัดลอกลิงก์"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
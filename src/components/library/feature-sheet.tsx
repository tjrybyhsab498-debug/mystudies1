import { useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { FeatureDef } from "@/lib/features";

export type FeatureRunConfig = {
  wholeDocument: boolean;
  pageFrom: number | null;
  pageTo: number | null;
  count: number;
};

export function FeatureSheet({
  feature,
  documentTitle,
  open,
  busy,
  progress,
  onOpenChange,
  onSubmit,
}: {
  feature: FeatureDef | undefined;
  documentTitle: string | undefined;
  open: boolean;
  busy: boolean;
  progress?: string | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (config: FeatureRunConfig) => void;
}) {
  const [wholeDocument, setWholeDocument] = useState(true);
  const [pageFrom, setPageFrom] = useState("1");
  const [pageTo, setPageTo] = useState("20");
  const [count, setCount] = useState("20");

  useEffect(() => {
    if (open) {
      setWholeDocument(true);
      setPageFrom("1");
      setPageTo("20");
      setCount("20");
    }
  }, [open]);

  if (!feature) return null;

  const from = Math.max(1, Math.min(Number(pageFrom) || 1, 10_000));
  const to = Math.max(from, Math.min(Number(pageTo) || from, 10_000));

  return (
    <Drawer open={open} onOpenChange={(next) => (busy ? null : onOpenChange(next))}>
      <DrawerContent className="mx-auto max-w-lg" dir="rtl">
        <DrawerHeader className="text-right">
          <DrawerTitle className="flex items-center gap-2 text-base">
            <feature.icon className="size-5 text-primary" />
            {feature.title}
          </DrawerTitle>
          <DrawerDescription className="truncate text-xs">
            {documentTitle ?? "ملف غير محدد"}
          </DrawerDescription>
        </DrawerHeader>

        <div className="space-y-4 px-4 pb-2">
          {!feature.ready ? (
            <p className="rounded-2xl border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
              هذه الميزة قيد التطوير وستُفتح في التحديث القادم. الكبسولة الذكية (التلخيص) جاهزة
              الآن.
            </p>
          ) : null}

          {feature.configKind === "page-range" ? (
            <>
              <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">المادة كاملة</p>
                  <p className="text-xs text-muted-foreground">أو حدّد نطاق صفحات معيّن</p>
                </div>
                <Switch checked={wholeDocument} onCheckedChange={setWholeDocument} />
              </div>

              {!wholeDocument ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="pageFrom">من صفحة</Label>
                    <Input
                      id="pageFrom"
                      type="number"
                      min={1}
                      inputMode="numeric"
                      value={pageFrom}
                      onChange={(e) => setPageFrom(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pageTo">إلى صفحة</Label>
                    <Input
                      id="pageTo"
                      type="number"
                      min={1}
                      inputMode="numeric"
                      value={pageTo}
                      onChange={(e) => setPageTo(e.target.value)}
                    />
                  </div>
                </div>
              ) : null}
            </>
          ) : null}

          {feature.configKind === "count" ? (
            <div className="space-y-2">
              <Label htmlFor="count">عدد العناصر</Label>
              <Input
                id="count"
                type="number"
                min={5}
                max={60}
                inputMode="numeric"
                value={count}
                onChange={(e) => setCount(e.target.value)}
              />
            </div>
          ) : null}

          {busy ? (
            <p className="flex items-center gap-2 rounded-2xl bg-primary-soft p-3 text-xs font-semibold text-primary">
              <Loader2 className="size-4 animate-spin" />
              {progress ?? "جارٍ العمل…"}
            </p>
          ) : null}
        </div>

        <DrawerFooter>
          <Button
            size="lg"
            disabled={busy || !feature.ready}
            onClick={() =>
              onSubmit({
                wholeDocument,
                pageFrom: wholeDocument ? null : from,
                pageTo: wholeDocument ? null : to,
                count: Math.max(5, Math.min(Number(count) || 20, 60)),
              })
            }
            className="gap-2"
          >
            <Sparkles className="size-4" />
            {feature.cta}
          </Button>
          <Button variant="ghost" disabled={busy} onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

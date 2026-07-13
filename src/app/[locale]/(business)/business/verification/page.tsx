import { CheckCircle2, Clock, FileText, Upload } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

export default async function BusinessVerificationPage() {
  const t = await getTranslations("business.verification");

  const steps = [
    { key: "identity", icon: FileText, done: true },
    { key: "documents", icon: Upload, done: true },
    { key: "review", icon: Clock, done: true },
    { key: "approved", icon: CheckCircle2, done: true },
  ] as const;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="mt-1 text-muted-foreground">{t("subtitle")}</p>
      </div>

      <Card className="border-emerald-500/30 bg-emerald-500/5">
        <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="size-10 text-emerald-600 dark:text-emerald-400" />
            <div>
              <Badge variant="success" className="mb-1">
                {t("status.verified")}
              </Badge>
              <p className="text-sm text-muted-foreground">{t("verifiedNote")}</p>
            </div>
          </div>
          <div className="text-end">
            <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">96%</p>
            <p className="text-sm text-muted-foreground">{t("trustScore")}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("progress")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <Progress value={100} className="h-2" />
          <div className="grid gap-4 sm:grid-cols-2">
            {steps.map(({ key, icon: Icon, done }) => (
              <div
                key={key}
                className="flex items-start gap-3 rounded-lg border p-4"
              >
                <div
                  className={
                    done
                      ? "flex size-10 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600"
                      : "flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground"
                  }
                >
                  <Icon className="size-5" />
                </div>
                <div>
                  <p className="font-medium">{t(`steps.${key}.title`)}</p>
                  <p className="text-sm text-muted-foreground">{t(`steps.${key}.description`)}</p>
                </div>
              </div>
            ))}
          </div>
          <Button variant="outline">{t("reupload")}</Button>
        </CardContent>
      </Card>
    </div>
  );
}

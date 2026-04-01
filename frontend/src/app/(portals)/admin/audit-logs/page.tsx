"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { ScrollText } from "lucide-react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type AuditLog = {
  id: string;
  user_id: string;
  user_name: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  description: string;
  created_at: string;
};

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const ACTION_LABELS: Record<string, string> = {
  create: "Oluşturma",
  update: "Güncelleme",
  delete: "Silme",
  convert: "Dönüştürme",
  login: "Giriş",
};

const ACTION_VARIANTS: Record<
  string,
  "success" | "secondary" | "destructive" | "warning" | "outline"
> = {
  create: "success",
  update: "secondary",
  delete: "destructive",
  convert: "warning",
  login: "outline",
};

const ENTITY_LABELS: Record<string, string> = {
  teacher: "Öğretmen",
  student: "Öğrenci",
  group: "Sınıf",
  announcement: "Duyuru",
  attendance: "Yoklama",
  payment: "Ödeme",
  lead: "Ön Kayıt",
  assignment: "Ödev",
};

const LIMIT = 50;

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const offsetRef = useRef(0);

  /* filters */
  const [actionFilter, setActionFilter] = useState("all");
  const [entityFilter, setEntityFilter] = useState("all");

  function buildUrl(action: string, entity: string, currentOffset: number) {
    const params = new URLSearchParams();
    if (action !== "all") params.set("action", action);
    if (entity !== "all") params.set("entity_type", entity);
    params.set("limit", String(LIMIT));
    params.set("offset", String(currentOffset));
    return `/api/v1/admin/audit-logs?${params.toString()}`;
  }

  /* initial fetch */
  useEffect(() => {
    api
      .get<AuditLog[]>(buildUrl("all", "all", 0))
      .then((res) => {
        const data = res ?? [];
        setLogs(data);
        setHasMore(data.length === LIMIT);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function applyFilter(setter: (v: string) => void, value: string) {
    setter(value);
    offsetRef.current = 0;
    const action = setter === setActionFilter ? value : actionFilter;
    const entity = setter === setEntityFilter ? value : entityFilter;
    setLoading(true);
    api
      .get<AuditLog[]>(buildUrl(action, entity, 0))
      .then((res) => {
        const data = res ?? [];
        setLogs(data);
        setHasMore(data.length === LIMIT);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  function handleLoadMore() {
    const newOffset = offsetRef.current + LIMIT;
    offsetRef.current = newOffset;
    setLoadingMore(true);
    api
      .get<AuditLog[]>(buildUrl(actionFilter, entityFilter, newOffset))
      .then((res) => {
        const data = res ?? [];
        setLogs((prev) => [...prev, ...data]);
        setHasMore(data.length === LIMIT);
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false));
  }

  if (loading)
    return <div className="text-muted-foreground">Yükleniyor...</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <h1 className="text-foreground flex items-center gap-2 text-2xl font-semibold">
        <ScrollText className="h-6 w-6" />
        Denetim Kaydı
      </h1>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={actionFilter}
          onValueChange={(v) => applyFilter(setActionFilter, v)}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="İşlem türü" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tümü</SelectItem>
            <SelectItem value="create">Oluşturma</SelectItem>
            <SelectItem value="update">Güncelleme</SelectItem>
            <SelectItem value="delete">Silme</SelectItem>
            <SelectItem value="convert">Dönüştürme</SelectItem>
            <SelectItem value="login">Giriş</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={entityFilter}
          onValueChange={(v) => applyFilter(setEntityFilter, v)}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Modül" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tümü</SelectItem>
            <SelectItem value="teacher">Öğretmen</SelectItem>
            <SelectItem value="student">Öğrenci</SelectItem>
            <SelectItem value="group">Sınıf</SelectItem>
            <SelectItem value="announcement">Duyuru</SelectItem>
            <SelectItem value="attendance">Yoklama</SelectItem>
            <SelectItem value="payment">Ödeme</SelectItem>
            <SelectItem value="lead">Ön Kayıt</SelectItem>
            <SelectItem value="assignment">Ödev</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Log list — timeline style */}
      {logs.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col items-center justify-center py-16"
        >
          <ScrollText className="text-muted-foreground/50 h-12 w-12" />
          <p className="text-muted-foreground mt-4 text-sm">
            Henüz denetim kaydı bulunmuyor
          </p>
        </motion.div>
      ) : (
        <div className="space-y-3">
          {logs.map((log, i) => (
            <motion.div
              key={log.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03, duration: 0.2 }}
            >
              <div className="border-border bg-card flex items-start gap-3 rounded-lg border p-3">
                <div className="mt-0.5">
                  <Badge variant={ACTION_VARIANTS[log.action] ?? "secondary"}>
                    {ACTION_LABELS[log.action] ?? log.action}
                  </Badge>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-foreground text-sm">{log.description}</p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {log.user_name} &middot;{" "}
                    {ENTITY_LABELS[log.entity_type] ?? log.entity_type} &middot;{" "}
                    {new Date(log.created_at).toLocaleString("tr-TR")}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Load more */}
      {hasMore && logs.length > 0 && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            onClick={handleLoadMore}
            disabled={loadingMore}
          >
            {loadingMore ? "Yükleniyor..." : "Daha Fazla Yükle"}
          </Button>
        </div>
      )}
    </div>
  );
}

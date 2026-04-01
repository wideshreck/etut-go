"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { motion } from "motion/react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Building2, GraduationCap, Users, Eye, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type InstitutionStat = {
  id: string;
  name: string;
  is_active: boolean;
  student_count: number;
  teacher_count: number;
};

export default function SuperadminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<InstitutionStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<InstitutionStat[]>("/api/v1/superadmin/dashboard")
      .then((data) => setStats(data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
      </div>
    );
  }

  const totalStudents = stats.reduce((sum, s) => sum + s.student_count, 0);
  const totalTeachers = stats.reduce((sum, s) => sum + s.teacher_count, 0);
  const activeCount = stats.filter((s) => s.is_active).length;

  const statCards = [
    {
      label: "Toplam Kurum",
      value: stats.length,
      icon: Building2,
      accent: false,
    },
    {
      label: "Aktif Kurum",
      value: activeCount,
      icon: Building2,
      accent: activeCount === stats.length && stats.length > 0,
    },
    {
      label: "Toplam Öğrenci",
      value: totalStudents,
      icon: GraduationCap,
      accent: false,
    },
    {
      label: "Toplam Öğretmen",
      value: totalTeachers,
      icon: Users,
      accent: false,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-foreground text-2xl font-semibold">
          Sistem Genel Bakışı
        </h1>
        <p className="text-muted-foreground text-sm">
          {new Date().toLocaleDateString("tr-TR", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
      </div>

      {/* Row 1: Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08, duration: 0.3 }}
            >
              <Card>
                <CardContent className="flex items-center gap-4 p-5">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                      stat.accent
                        ? "bg-success/10 text-success"
                        : "bg-primary/10 text-primary"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-muted-foreground text-sm">
                      {stat.label}
                    </p>
                    <p className="text-foreground text-2xl font-semibold">
                      {stat.value}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Row 2: Institution Table / Cards */}
      {stats.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Building2 className="text-muted-foreground/50 h-12 w-12" />
              <p className="text-muted-foreground mt-4 text-sm font-medium">
                Henüz kurum eklenmedi
              </p>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <>
          {/* Desktop Table */}
          <Card className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kurum Adı</TableHead>
                  <TableHead>Öğrenci</TableHead>
                  <TableHead>Öğretmen</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead className="w-[80px]">İşlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.map((inst, i) => (
                  <motion.tr
                    key={inst.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05, duration: 0.25 }}
                    whileHover={{ backgroundColor: "var(--color-muted)" }}
                    className="cursor-pointer border-b transition-colors"
                    onClick={() => router.push("/superadmin/institutions")}
                  >
                    <TableCell className="font-medium">{inst.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {inst.student_count}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {inst.teacher_count}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={inst.is_active ? "success" : "destructive"}
                      >
                        {inst.is_active ? "Aktif" : "Pasif"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push("/superadmin/institutions");
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Mobile Cards */}
          <div className="space-y-3 md:hidden">
            {stats.map((inst, i) => (
              <motion.div
                key={inst.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.25 }}
              >
                <Card
                  className="hover:border-primary/30 cursor-pointer transition-all hover:shadow-md"
                  onClick={() => router.push("/superadmin/institutions")}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="bg-primary/10 flex h-9 w-9 items-center justify-center rounded-lg">
                          <Building2 className="text-primary h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-foreground text-sm font-medium">
                            {inst.name}
                          </p>
                          <div className="text-muted-foreground mt-1 flex gap-3 text-xs">
                            <span className="flex items-center gap-1">
                              <GraduationCap className="h-3 w-3" />
                              {inst.student_count}
                            </span>
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {inst.teacher_count}
                            </span>
                          </div>
                        </div>
                      </div>
                      <Badge
                        variant={inst.is_active ? "success" : "destructive"}
                      >
                        {inst.is_active ? "Aktif" : "Pasif"}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

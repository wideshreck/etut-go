"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { GraduationCap, Loader2, Lock, Mail } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type RoleOption = {
  label: string;
  value: "admin" | "teacher" | "student" | "parent";
};

const ROLE_OPTIONS: RoleOption[] = [
  { label: "Yönetici", value: "admin" },
  { label: "Öğretmen", value: "teacher" },
  { label: "Öğrenci", value: "student" },
  { label: "Veli", value: "parent" },
];

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await login(email, password, selectedRole ?? undefined);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "E-posta veya şifre hatalı",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full lg:grid lg:grid-cols-2">
      {/* Sol Panel — Branding */}
      <div className="bg-muted hidden items-center justify-center lg:flex">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="text-center"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
            className="bg-primary mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl"
          >
            <GraduationCap className="text-primary-foreground h-8 w-8" />
          </motion.div>
          <h1 className="text-foreground text-4xl font-semibold tracking-tight">
            Etüt Pro
          </h1>
          <p className="text-muted-foreground mt-2">Eğitim Yönetim Platformu</p>
        </motion.div>
      </div>

      {/* Sağ Panel — Form */}
      <div className="flex min-h-screen items-center justify-center px-4 py-12 sm:px-6 lg:min-h-0 lg:px-8">
        <div className="w-full max-w-md">
          {/* Mobil Logo */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="mb-8 flex items-center justify-center gap-2 lg:hidden"
          >
            <div className="bg-primary flex h-10 w-10 items-center justify-center rounded-lg">
              <GraduationCap className="text-primary-foreground h-5 w-5" />
            </div>
            <h1 className="text-foreground text-2xl font-semibold">Etüt Pro</h1>
          </motion.div>

          <AnimatePresence mode="wait">
            {!selectedRole ? (
              <motion.div
                key="role-select"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25, ease: "easeInOut" }}
              >
                <div className="mb-6 text-center">
                  <h2 className="text-foreground text-2xl font-semibold">
                    Hoş Geldiniz
                  </h2>
                  <p className="text-muted-foreground mt-1 text-sm">
                    Devam etmek için giriş türünüzü seçin
                  </p>
                </div>
                <div className="space-y-2">
                  {ROLE_OPTIONS.map((option, i) => (
                    <motion.div
                      key={option.value}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: 0.25,
                        delay: i * 0.07,
                        ease: "easeOut",
                      }}
                    >
                      <Button
                        variant="outline"
                        onClick={() => setSelectedRole(option.value)}
                        className="h-auto w-full justify-start px-4 py-3.5 transition-all hover:translate-x-1"
                      >
                        <span className="text-sm font-medium">
                          {option.label}
                        </span>
                      </Button>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="login-form"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.25, ease: "easeInOut" }}
              >
                <div className="mb-6 text-center">
                  <h2 className="text-foreground text-2xl font-semibold">
                    Giriş Yap
                  </h2>
                  <p className="text-muted-foreground mt-1 text-sm">
                    Hesabınıza giriş yaparak devam edin
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: 0.05 }}
                    className="space-y-2"
                  >
                    <Label htmlFor="email">E-posta</Label>
                    <div className="relative">
                      <Mail className="text-muted-foreground absolute top-2.5 left-3 h-4 w-4" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="ornek@etut.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        disabled={loading}
                        className="pl-10"
                      />
                    </div>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: 0.1 }}
                    className="space-y-2"
                  >
                    <Label htmlFor="password">Şifre</Label>
                    <div className="relative">
                      <Lock className="text-muted-foreground absolute top-2.5 left-3 h-4 w-4" />
                      <Input
                        id="password"
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        disabled={loading}
                        className="pl-10"
                      />
                    </div>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: 0.15 }}
                  >
                    <Button
                      type="submit"
                      disabled={loading}
                      className="w-full"
                      size="lg"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Giriş yapılıyor...
                        </>
                      ) : (
                        "Giriş Yap"
                      )}
                    </Button>
                  </motion.div>
                </form>

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3, delay: 0.2 }}
                >
                  <Button
                    variant="ghost"
                    onClick={() => setSelectedRole(null)}
                    className="text-muted-foreground mt-4 w-full"
                  >
                    ← Geri dön
                  </Button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

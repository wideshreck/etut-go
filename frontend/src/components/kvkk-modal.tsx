"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ScrollText } from "lucide-react";

/**
 * KVKK Aydınlatma Metni
 *
 * KVKK Madde 10 ve "Aydınlatma Yükümlülüğünün Yerine Getirilmesinde
 * Uyulacak Usul ve Esaslar Hakkında Tebliğ" (10.03.2018 / Resmi Gazete 30356)
 * uyarınca hazırlanmıştır.
 *
 * ÖNEMLİ: Bu metin bir AYDINLATMA (bildirim) metnidir.
 * "Kabul ediyorum" veya onay mekanizması İÇERMEZ.
 * Aydınlatma yükümlülüğü tek taraflı bilgilendirmedir,
 * açık rıza ile birleştirilmesi Tebliğ'e aykırıdır.
 */
const AYDINLATMA_METNI = `KİŞİSEL VERİLERİN İŞLENMESİNE İLİŞKİN AYDINLATMA METNİ

İşbu aydınlatma metni, 6698 sayılı Kişisel Verilerin Korunması Kanunu'nun ("KVKK") 10. maddesi ile "Aydınlatma Yükümlülüğünün Yerine Getirilmesinde Uyulacak Usul ve Esaslar Hakkında Tebliğ" kapsamında veri sorumlusu sıfatıyla hazırlanmıştır.

1. VERİ SORUMLUSU
Kişisel verileriniz, eğitim hizmeti aldığınız kurum tarafından veri sorumlusu sıfatıyla aşağıda açıklanan amaçlar doğrultusunda işlenmektedir. Veri sorumlusunun güncel kimlik ve iletişim bilgilerine kurum yönetiminden ulaşabilirsiniz.

2. İŞLENEN KİŞİSEL VERİ KATEGORİLERİ
a) Kimlik Bilgileri: Ad, soyad, T.C. kimlik numarası, doğum tarihi, cinsiyet
b) İletişim Bilgileri: Telefon numarası, e-posta adresi, adres
c) Eğitim Bilgileri: Devam ettiği okul, sınıf düzeyi, hedef sınav, ders programı, ödev ve başarı durumu, devamsızlık kayıtları
d) Finansal Bilgiler: Ödeme kayıtları, taksit planları, banka/IBAN bilgileri
e) Veli/Yasal Temsilci Bilgileri: Ad, soyad, T.C. kimlik numarası, telefon, e-posta, meslek, yakınlık derecesi
f) Çalışan Bilgileri: Özlük dosyası kapsamındaki bilgiler (öğretmen ve personel için)
g) Görsel Kayıtlar: Kurum içi güvenlik kamerası görüntüleri (varsa)

3. KİŞİSEL VERİLERİN İŞLENME AMAÇLARI
Kişisel verileriniz aşağıdaki amaçlarla işlenmektedir:
• Eğitim ve öğretim hizmetlerinin planlanması ve yürütülmesi
• Öğrenci kayıt, kabul ve yerleştirme işlemlerinin gerçekleştirilmesi
• Ders programı oluşturulması ve ders takibinin yapılması
• Ödev atama, takip ve değerlendirme süreçlerinin yönetilmesi
• Yoklama/devamsızlık takibi ve veli bilgilendirmesi
• Özel ders randevu ve kredi yönetimi
• Ücret belirleme, tahsilat, taksitlendirme ve muhasebe işlemlerinin yürütülmesi
• Veli bilgilendirme ve iletişim faaliyetlerinin sürdürülmesi
• 5580 sayılı Özel Öğretim Kurumları Kanunu kapsamında MEB'e yapılacak bildirimlerin gerçekleştirilmesi
• 213 sayılı Vergi Usul Kanunu kapsamında mali yükümlülüklerin yerine getirilmesi
• Kurum içi güvenliğin sağlanması
• İlgili mevzuat gereği saklama ve arşiv faaliyetlerinin yürütülmesi
• Yetkili kamu kurum ve kuruluşlarına bilgi verilmesi

4. KİŞİSEL VERİLERİN TOPLANMA YÖNTEMİ VE HUKUKİ SEBEBİ
Kişisel verileriniz; kayıt formları, dijital platformlar (web ve mobil uygulamalar), telefon görüşmeleri ve yüz yüze görüşmeler aracılığıyla toplanmaktadır.

İşlemenin hukuki sebepleri:
• KVKK m.5/2(c): Bir sözleşmenin kurulması veya ifasıyla doğrudan doğruya ilgili olması (eğitim hizmeti sözleşmesi)
• KVKK m.5/2(ç): Veri sorumlusunun hukuki yükümlülüğünü yerine getirebilmesi (MEB bildirimleri, vergi yükümlülükleri)
• KVKK m.5/2(e): Bir hakkın tesisi, kullanılması veya korunması için zorunlu olması
• KVKK m.5/2(f): İlgili kişinin temel hak ve özgürlüklerine zarar vermemek kaydıyla, veri sorumlusunun meşru menfaatleri için zorunlu olması (kurum güvenliği)

Yukarıdaki hukuki sebeplere dayanmayan işleme faaliyetleri için ayrıca açık rızanız talep edilecektir.

5. KİŞİSEL VERİLERİN AKTARILMASI
Kişisel verileriniz, yukarıda belirtilen amaçların gerçekleştirilmesi doğrultusunda:
• Milli Eğitim Bakanlığı ve bağlı kuruluşlarına (5580 sayılı Kanun kapsamında yasal yükümlülük)
• Hazine ve Maliye Bakanlığı / Gelir İdaresi Başkanlığı'na (213 sayılı VUK kapsamında yasal yükümlülük)
• Sosyal Güvenlik Kurumu'na (5510 sayılı Kanun kapsamında çalışan bildirimleri)
• Yasal zorunluluk halinde adli ve idari mercilere
• Hukuki danışmanlık hizmeti alınan avukat/hukuk bürolarına (hakkın korunması amacıyla)
aktarılabilir.

Kişisel verileriniz yurt dışına aktarılmamaktadır.

6. KİŞİSEL VERİLERİN SAKLANMA SÜRESİ
Kişisel verileriniz, işleme amacının gerektirdiği süre boyunca ve ilgili mevzuatta öngörülen zamanaşımı süreleri boyunca saklanmaktadır:
• Eğitim kayıtları: Öğrencilik süresi + 10 yıl
• Mali kayıtlar: İlgili takvim yılını izleyen 5 yıl (VUK m.253)
• Sözleşmeler: Sözleşme sona ermesinden itibaren 10 yıl (TBK zamanaşımı)
• Çalışan kayıtları: İş ilişkisi sona ermesinden itibaren 10 yıl
Saklama süresi sona eren veriler, periyodik imha süreleri kapsamında silinir, yok edilir veya anonim hale getirilir.

7. İLGİLİ KİŞİ OLARAK HAKLARINIZ (KVKK m.11)
KVKK'nın 11. maddesi uyarınca aşağıdaki haklara sahipsiniz:
a) Kişisel verilerinizin işlenip işlenmediğini öğrenme,
b) Kişisel verileriniz işlenmişse buna ilişkin bilgi talep etme,
c) Kişisel verilerinizin işlenme amacını ve bunların amacına uygun kullanılıp kullanılmadığını öğrenme,
ç) Yurt içinde veya yurt dışında kişisel verilerinizin aktarıldığı üçüncü kişileri bilme,
d) Kişisel verilerinizin eksik veya yanlış işlenmiş olması hâlinde bunların düzeltilmesini isteme,
e) KVKK'nın 7. maddesi kapsamında kişisel verilerinizin silinmesini veya yok edilmesini isteme,
f) (d) ve (e) bentleri uyarınca yapılan işlemlerin, kişisel verilerinizin aktarıldığı üçüncü kişilere bildirilmesini isteme,
g) İşlenen verilerinizin münhasıran otomatik sistemler vasıtasıyla analiz edilmesi suretiyle kişinin kendisi aleyhine bir sonucun ortaya çıkmasına itiraz etme,
ğ) Kişisel verilerinizin kanuna aykırı olarak işlenmesi sebebiyle zarara uğramanız hâlinde zararın giderilmesini talep etme.

8. BAŞVURU YÖNTEMİ
Yukarıda sayılan haklarınızı kullanmak için kuruma yazılı olarak, kayıtlı elektronik posta (KEP) adresi, güvenli elektronik imza veya mobil imza kullanarak ya da noter kanalıyla başvurabilirsiniz. Başvurularınız 30 gün içinde sonuçlandırılacaktır.

İşbu aydınlatma metni, 6698 sayılı Kişisel Verilerin Korunması Kanunu'nun 10. maddesi ve ilgili Tebliğ hükümleri uyarınca bilgilendirme amacıyla hazırlanmış olup herhangi bir onay veya kabul niteliği taşımamaktadır.`;

export function KVKKModal() {
  const { user } = useAuth();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!user) return;
    api
      .get<{ accepted: boolean }>("/api/v1/auth/kvkk-status")
      .then((r) => {
        if (!r.accepted) setShow(true);
      })
      .catch(() => {});
  }, [user]);

  function handleAcknowledge() {
    // Aydınlatma gösterildiğini kaydet — bu bir ONAY değil, GÖRÜNTÜLEME kaydıdır
    api
      .post("/api/v1/auth/kvkk-accept")
      .then(() => setShow(false))
      .catch(() => setShow(false));
  }

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="border-border bg-background w-full max-w-2xl rounded-lg border p-4 shadow-xl sm:p-6"
      >
        <div className="mb-4 flex items-center gap-2">
          <ScrollText className="text-primary h-5 w-5" />
          <h2 className="text-foreground text-lg font-semibold">
            Kişisel Verilerin İşlenmesine İlişkin Aydınlatma Metni
          </h2>
        </div>

        <p className="text-muted-foreground mb-3 text-xs">
          6698 sayılı KVKK&apos;nın 10. maddesi uyarınca aşağıdaki bilgilendirme
          metni tarafınıza sunulmaktadır.
        </p>

        <div className="border-border bg-muted text-foreground max-h-[55vh] overflow-y-auto rounded-lg border p-4 text-xs leading-relaxed whitespace-pre-line">
          {AYDINLATMA_METNI.trim()}
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground text-[11px]">
            Bu metin bilgilendirme amaçlıdır, onay niteliği taşımaz.
          </p>
          <Button onClick={handleAcknowledge} size="lg">
            Okudum, Bilgilendirildim
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

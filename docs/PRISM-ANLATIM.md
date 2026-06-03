# Prism — Proje Anlatımı (Seyit için detaylı rehber)

> Bu doküman projeyi sıfırdan anlatır: ne, neden, nasıl, ne ile, neden Stellar — artı
> sunum ve jüri soruları hazırlığı. Sunumu sen yapacağın için **anlayarak** okumak önemli.

---

## 0. Tek cümle

**Prism = bir yapay zeka ajanına güvenle para harcatma sistemi.** Ajan harcar, ama *akıllı
kontrat* ne kadar / kime harcayacağını zorla sınırlar — ajan parayı kaçıramaz, ve her ödeme
otomatik muhasebeleşir.

---

## 1. Hangi problemi çözüyoruz?

Yapay zeka ajanları artık düşünüp iş yapabiliyor ama **ödeme** konusunda duvara çarpıyorlar.
Hiçbir işletme bir yapay zekaya cüzdan vermek istemiyor, iki sebepten:

1. **Güvenlik (asıl problem):** Ajan halüsinasyon görür ya da hacklenirse (prompt-injection)
   tüm parayı bir saldırgana yollayabilir.
2. **Muhasebe:** Ajan yüzlerce küçük ödeme yapınca "ne, neye, kime harcandı" takip edilemez.

Sonuç: Bugün ajanlar öneri verir ama **ödeme yapamaz.** Prism bu kilidi açar.

---

## 2. Çözüm: Prism ne yapıyor?

Üç garanti veriyoruz, üçü de **zincir tarafından** uygulanıyor:

| | Garanti | Nasıl |
|---|---|---|
| **Bound (Sınırla)** | Ajan fazla / yanlış adrese harcayamaz | Kontrat policy'yi (whitelist + limit) zorlar, ihlali **zincirde reddeder** |
| **Account (Muhasebeleştir)** | Her ödeme otomatik kime/neye ait belli | Harcama **görev başına** kontratta tutulur |
| **Fund (Bütçele)** | Para girerken hangi bütçeye ait belli | Sıfır maliyetli **muxed alt-adresler** |

Önemli: **Para işletmenin kendi kontratında durur (non-custodial).** Biz paraya asla
dokunmuyoruz — "biz yazılımız, banka değiliz." Güven koda ait.

---

## 3. Nasıl çalışıyor? (mekanizma — adım adım)

1. **Para işletmenin Soroban kontratında durur.** (Soroban = Stellar'ın akıllı kontrat motoru.)
2. **İşletme bir policy belirler:** izinli adresler (whitelist), tek-ödeme limiti, günlük limit.
3. **Ajan ödeme ister:** kontrata "şu görev için, şu adrese, şu kadar öde" der (`pay` fonksiyonu).
4. **Kontrat kontrol eder:**
   - Adres izinli mi? Değilse → **RED** (hata #2 `PayeeNotWhitelisted`).
   - Miktar tek-ödeme limitini aşıyor mu? → **RED** (#3 `ExceedsTaskLimit`).
   - Günlük toplam aşılıyor mu? → **RED** (#4 `ExceedsDailyLimit`).
   - Hepsi geçerse → **USDC öder + görev no'suna yazar.**
5. **Katil an (demo):** Ajanı kandırıp izinsiz adrese para yollatmaya çalışırız → kontrat
   zincirde reddeder, para kıpırdamaz. Mesaj: **"Model yanıldı; kontrat yanılmadı."**
6. **Muxed funding (para GİRİŞİ):** Her ajan bütçesi, tek havuz hesabının **bedava bir muxed
   alt-adresini** alır. Müşteri o adrese öder; sistem hangi bütçeye ait olduğunu otomatik bilir —
   memo yok, yeni hesap yok.
7. **ERC-8004:** Ajanın on-chain kimliği + itibarı var (trionlabs'ın Stellar 8004 kaydı).
   "Sadece doğrulanmış, itibarlı ajanlara öde" güven katmanı.

---

## 4. İki yönü ayır (kafanda otursun)

| Para **GİRERKEN** (muxed — Seyit) | Para **ÇIKARKEN** (kontrat — Bekir) |
|---|---|
| Hangi bütçeye ait? → muxed alt-adres etiketler | Ajan harcar, kontrat sınırı zorlar |
| "Müşteri parayı doğru bütçeye bıraksın" | "Ajan izinsiz harcayamasın + her ödeme görevine yazılsın" |

---

## 5. Mimari (slayta da konabilir)

```
   AJAN ──"şu adrese şu kadar öde"──►  PRİSM KONTRATI (Soroban)
                                        ├─ izinli adres mi?
   (hack denemesi) ──────────────────► ├─ limit aşılıyor mu?  ──► HAYIR → ❌ RED (zincirde)
                                        └─ EVET → ✅ USDC öder + göreve yazar ──► TEDARİKÇİ

   Para girişi:  müşteri ──► muxed alt-adres (bedava) ──► tek havuz, bütçe başına etiketli
   Güven katmanı: ERC-8004 kimlik + itibar
```

---

## 6. Teknoloji yığını

| Katman | Teknoloji |
|---|---|
| Akıllı kontrat | Rust + `soroban-sdk` 26 (Stellar) |
| Para | USDC (Stellar native; testte kendi test-USDC'miz — SAC) |
| Kontratla konuşma | Stellar CLI'ın ürettiği TypeScript client |
| Frontend | React 19 + Vite + TypeScript (framer-motion, three.js — Bekir cilalayacak) |
| Muxed | Stellar native muxed account + Horizon API |
| Güven | trionlabs/stellar-8004 registry + SDK |
| Ortam | Stellar **testnet**, gerçek işlemler |

---

## 7. Neden Stellar? (dürüst — jüri bunu soracak)

- **Sent-altı işlem ücreti:** Ajan çok sayıda küçük ödeme yapar; bunu ekonomik kılan tek şey.
  Ethereum'da gas öldürür.
- **Muxed accounts:** Tek hesap, sonsuz sıfır-maliyetli alt-adres → ödeme etiketlemenin en ucuz
  yolu. Başka zincirde bu kadar ucuz/basit yok. **Stellar'a özgü.**
- **Native account abstraction (`__check_auth`):** Kontrat-sınırlı ajanı doğal destekler.
- **Native USDC + anchor:** Gerçek dolar + 170+ ülkede fiat çıkış.

**Dürüst nüans:** "Ajanı sınırlama" tek başına yeni değil (her zincirde var). Bizim Stellar
avantajımız: **ucuz attribution (muxed) + fiat-seviye ray.** Abartmadan böyle söyleriz. Ayrıca
SDF'in kendi "Agents" hackathon temasıyla birebir örtüşüyor.

---

## 8. Canlı testnet (kanıt)

Tüm adresler ve doğrulanan sonuçlar: [`../DEPLOYMENT.md`](../DEPLOYMENT.md).

- **Prism Treasury:** `CAYWNXHANRY5GSJAZOR4YTKBKNOKTCITE52ZRKDKCAWLDTYWFFVFSPAZ`
- Doğrulandı (canlı testnet tx): legit ödeme ✅, rogue → red #2 ✅, per-task muhasebe ✅,
  muxed deposit attribution ✅.
- Per-task limit aşımı → red #3 (ExceedsTaskLimit) ve daily limit aşımı → red #4
  (ExceedsDailyLimit) kontrat test paketinde kanıtlı — `cargo test` → 6/6.

---

## 9. Demo akışı (her şeyin ne yaptığı)

Frontend `localhost:5173`:
- **Landing:** hikâye (problem → çözüm → "o an" → neden Stellar).
- **Launch live demo → Dashboard:**
  - **Run agent tasks:** ajan 3 tedarikçiye otonom öder → settled + tx linkleri.
  - **Simulate prompt-injection:** ajan izinsiz adrese yollamaya çalışır → 🔴 zincirde red.
  - **Auto-reconciled spend:** görev başına harcama, zincirden okunur.
  - **Funding rail:** "Fund 5 XLM" → muxed alt-adrese gerçek deposit → bütçeye atfedilir.

---

## 10. Sunum (8 slayt — template: Solution / PMF / Technical Workflow / Team + eklediklerimiz)

1. **Başlık** — "Prism — yapay zeka ajanınızın boşaltamayacağı cüzdan."
2. **Problem** — güvenlik + muhasebe.
3. **The Solution** — Prism nedir, 3 garanti, non-custodial.
4. **Kanıt** ⭐ — kırmızı "Blocked on-chain" görseli; "model yanıldı, kontrat yanılmadı."
5. **PMF** (Product-Market Fit) — kim ister: ajan çalıştıran işletmeler; pazar büyüyor
   (Coinbase/Google/Stripe ajan-ödemesine giriyor; SDF "ajanların duvarı" dedi); neden şimdi.
6. **Technical Workflow** — mimari diyagram + stack + neden Stellar.
7. **The Team** — Bekir (kontrat/altyapı) + Seyit (muxed funding rail / ürün).
8. **Kapanış** — dürüst fark + "Prism: ajanınızın boşaltamayacağı cüzdan. Teşekkürler."

---

## 11. Jüri Q&A hazırlığı (muhtemel sorular + kısa cevap)

- **"Bu zaten çözülmüş bir şey değil mi (bounded spend)?"**
  → "Sınırlama table-stakes. Bizim farkımız ucuz **attribution** (muxed) + fiat-seviye **ray** —
  ikisi de Stellar-native, ikisi de canlı."
- **"Neden Base/Solana değil (x402 orada)?"**
  → "Sent-altı ücret + muxed attribution + fiat anchor. Stellar de x402'ye geçiyor; biz onunla
  uyumluyuz."
- **"Custody riski var mı?"**
  → "Yok. Para işletmenin kendi kontratından çıkmaz. Biz yazılımız."
- **"Agent cüzdanı nasıl imzalıyor, anahtar nerede?"**
  → "Demoda testnet anahtarı gömülü (değersiz). Production'da ajanın kendi anahtarı / MPC. Önemli
  olan: güvenlik kontratta, insan onayında değil."
- **"Gerçek bir kullanıcı var mı / pazar gerçek mi?"**
  → "Pazar erken ama trend net: büyük oyuncular ajan-ödemesine giriyor, SDF kendi hackathon'unu
  yaptı. Biz altyapıyı kanıtladık, pilotla doğrulanacak."
- **"Muxed tam olarak ne çözüyor?"**
  → "Tek hesaba çok kaynaktan para girince 'bu hangi bütçeye ait' sorusunu — memo olmadan,
  ayrı hesap açmadan, bedava."
- **"Ne kadar gerçek, ne kadar mock?"**
  → "Kontrat + policy + red + ödeme + muhasebe + muxed: hepsi testnet'te gerçek. Anchor fiat
  çıkışı roadmap."
- **"Sırada ne var?"**
  → "Kontrat-içi 8004 reputation gate (dikiş hazır), anchor cash-out, x402 vendor uçları."

---

## 12. Sözlük (terimler)

- **Soroban:** Stellar'ın akıllı kontrat platformu (Rust + WASM).
- **Non-custodial:** Para sahibinde durur; biz tutmuyoruz.
- **Policy:** Kontratın uyguladığı kurallar (whitelist, limitler).
- **USDC / SAC:** Stellar'da dolar stablecoin; SAC = bir asset'i Soroban'da kullanılır kılan kontrat.
- **Muxed account (M-adres):** Tek hesabın bedava sanal alt-adresleri; gelen ödemeyi etiketler.
- **`to_muxed_id`:** Gelen ödemenin hangi alt-adrese (bütçeye) ait olduğunu söyleyen etiket.
- **`__check_auth`:** Soroban'ın "bu işlem yetkili mi" kontrolü; kontrat-sınırlı ajanın temeli.
- **ERC-8004:** Ajan kimliği + itibar standardı; Stellar versiyonu trionlabs/stellar-8004.
- **Attribution:** Bir ödemenin kime/neye ait olduğunu belirleme.
- **Horizon:** Stellar'ın işlem/ödeme geçmişi API'si.
- **Testnet:** Gerçek para olmayan deneme ağı (friendbot ile fonlanır).

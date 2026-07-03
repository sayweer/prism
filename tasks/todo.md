# Kova 2 — Dokümantasyon / kredibilite (2026-07-03) ✅

- [x] SECURITY.md — güvenlik modeli + 2026-06-03 audit bulgularının durumu (fixed/open)
      + known limitations + vulnerability disclosure yolu
- [x] ROADMAP.md — M1-M5 milestone'ları (Startup Track submission için öne çekildi)
- [x] README "real USDC" iddiası düzeltildi (testnet USDC + XLM gerçeği + M3 yolu)
- [x] CHANGELOG.md — 0.1.0 (IBW) → 0.2.0 (ZK+trust) → 0.3.0 (per-user) → 0.3.1 (onboarding)
- [x] web/README.md — Vite boilerplate yerine gerçek dev dokümanı
- [x] supabase/migrations/0001 — feedback+activity şeması + insert-only RLS repo'da
- [ ] (ertelendi) lint borcu — 24 hata, çoğu generated treasuryClient.ts + eski
      setState-in-effect kalıpları; CI gate'lemiyor, davranış riski nedeniyle ayrı iş

# Kova 1 — 10-kullanıcı push'u öncesi onboarding düzeltmeleri (2026-07-02)

Hedef: WhatsApp'tan gelen sıfır-bakiyeli, telefonlu, ilk-kez kullanıcı akışı baştan sona
takılmadan tamamlasın. Her madde ayrı commit; sonunda manuel Vercel deploy + canlı doğrulama.

- [x] 1. Funding gate — Workspace'e cüzdan XLM bakiyesi kontrolü + friendbot butonu
      (`lib/funding.ts` + 8 unit test; hesap yoksa/bakiye < 5 XLM ise uyarı kutusu)
- [x] 2. Treasury ID kaybolmasın — deploy sonrası "ID'ni kaydet" uyarısı + Copy ID butonu
      + "open existing" input'una StrKey C… validasyonu (`isValidContractId` + test)
- [x] 3. İlk kullanıcı akış yağlaması — "use the sample vendor" doldurma bağlantısı
      + whitelist başarısında Spend "To" alanı otomatik dolar
- [x] 4. Hata mesajları — deploy/fund/whitelist/pay catch'leri `sendErr`'de; `sendErr`'e
      "account not found" + mesaj-tabanlı "insufficient balance" eklendi (+2 test)
- [x] 5. Mobil — landing nav ≤900px'te Demo/Wallet/Activity kompakt kalıyor; iç nav
      flex-wrap + maxWidth; Workspace üst boşluk (84px); "Agent demo" butonu artık
      dashboard'a gidiyor (bug'dı: landing'e gidiyordu). 375px'te görsel doğrulandı.
- [x] 6. Onboarding docs — README adımları yenilendi (Freighter + friendbot + Copy ID
      + sample vendor); `docs/TRY-IT-TR.md` Türkçe hızlı başlangıç eklendi
- [x] 7. Deploy + canlı doğrulama — 42/42 test + build yeşil; `vercel --prod` →
      prism-stellar.vercel.app alias'landı; Vercel'de VITE_SUPABASE_* env'leri mevcut;
      canlıda feedback formu ile E2E insert doğrulandı (test satırı sonra silindi)

## İnceleme / Notlar

- Supabase `activity` + `feedback` RLS: enabled, sadece anon INSERT policy (SELECT yok) —
  canlı DB'de doğrulandı. Migration olarak repo'ya commit etmek → Kova 2.
- `npm run lint` 24 hata veriyor; tamamına yakını önceden mevcut borç (generated
  treasuryClient.ts, Dashboard/Analytics setState-in-effect). CI lint'i gate'lemiyor.
  Temizlik → Kova 2.
- Kova 2 (dokümantasyon/kredibilite) ve Kova 3 (mimari: agent-signing, kontrat yaşam
  döngüsü, midnight burst, ZK entegrasyonu, ABI drift, analytics penceresi) bekliyor —
  ayrıntılar 2026-07-02 oturum değerlendirmesinde.

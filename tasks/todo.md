# Kova 1 — 10-kullanıcı push'u öncesi onboarding düzeltmeleri (2026-07-02)

Hedef: WhatsApp'tan gelen sıfır-bakiyeli, telefonlu, ilk-kez kullanıcı akışı baştan sona
takılmadan tamamlasın. Her madde ayrı commit; sonunda manuel Vercel deploy + canlı doğrulama.

- [ ] 1. Funding gate — Workspace'e cüzdan XLM bakiyesi kontrolü + friendbot butonu
      (yeni `lib/funding.ts`, unit test; hesap yoksa/bakiye < 5 XLM ise uyarı kutusu)
      → doğrula: vitest geçer; bakiyesiz hesapta kutu görünür, friendbot sonrası kaybolur
- [ ] 2. Treasury ID kaybolmasın — deploy sonrası "ID'ni kaydet" uyarısı + kopyala butonu
      (treasury satırında copy affordance) + "open existing" input'una StrKey C… validasyonu
      → doğrula: kopyala tam ID'yi panoya yazar; geçersiz ID insan diliyle reddedilir
- [ ] 3. İlk kullanıcı akış yağlaması — örnek payee doldurma butonu (demo SERVICE hesabı)
      + whitelist başarısında Spend "To" alanını otomatik doldur
      → doğrula: ikinci adresi olmayan kullanıcı akışı bitirebilir
- [ ] 4. Hata mesajları — Workspace deploy/fund/whitelist/pay catch'lerini `sendErr`'e bağla;
      `sendErr`'e "account not found" (fonlanmamış hesap) durumu ekle + test
      → doğrula: vitest geçer; imza reddi "Signature rejected…" olarak görünür
- [ ] 5. Mobil — landing nav ≤900px'te Demo/Wallet/Activity erişilebilir kalsın (kompakt nav),
      iç nav'a flex-wrap + maxWidth, Workspace'e üst nav boşluğu; "Agent demo" butonu
      dashboard'a gitsin (bug: landing'e gidiyordu)
      → doğrula: 375px genişlikte nav taşmıyor, tüm görünümlere erişilebiliyor
- [ ] 6. Onboarding docs — README "Use your own treasury" bölümüne friendbot linki,
      ID-kaydet uyarısı, örnek payee notu; `docs/TRY-IT-TR.md` (kısa Türkçe rehber)
      → doğrula: adımlar UI ile birebir eşleşiyor
- [ ] 7. Deploy + canlı doğrulama — build+test+lint, `vercel --prod --cwd web`,
      Vercel env var'ları (Supabase) kontrol, canlı sitede smoke test, activity
      tablosuna kayıt düştüğünü doğrula
      → doğrula: canlı URL yeni sürümü veriyor, Supabase'e kayıt akıyor

Not (bu oturumda doğrulandı): Supabase `activity` + `feedback` RLS açık, sadece anon INSERT
policy'si var, SELECT yok — sızıntı riski yok. RLS'i migration olarak commit etmek Kova 2'de.

# Prism'i Dene — 5 Dakikalık Rehber (Testnet)

*English version: [TRY-IT.md](TRY-IT.md)*

**Prism nedir?** AI agent'lara güvenle harcama yetkisi veren, Stellar üzerinde çalışan
sınırlı bir hazine (bounded treasury): günlük limit + işlem-başı limit + payee whitelist'ini
**kontrat** uygular — model ne kadar "ikna edilirse edilsin" limit dışına para çıkamaz.

Aşağıdaki akış tamamen **testnet** üzerindedir: gerçek para yok, riskiniz sıfır.
Her adım cüzdanınızla imzalanır — non-custodial, fonlar hep sizin kontrolünüzde.

**Uygulama:** [prism-stellar.vercel.app](https://prism-stellar.vercel.app) → sağ üstte **Open app**

## Adımlar

1. **Cüzdan kur** — [Freighter](https://www.freighter.app/) tarayıcı eklentisini kur,
   ayarlarından ağı **Testnet**'e al. (Zaten Stellar cüzdanın varsa bu adımı atla.)
2. **Bağlan** — *Open app* → *Connect a wallet* → Freighter'ı seç.
3. **Ücretsiz testnet XLM al** — cüzdanın boşsa uygulama bunu fark eder ve
   **"Get free testnet XLM"** butonu gösterir; tek tıkla friendbot cüzdanını fonlar.
4. **Hazineni oluştur** — günlük ve işlem-başı limitlerini gir → *Create treasury* →
   cüzdanında imzala. Deploy bitince **"Copy ID" ile hazine kimliğini kopyala ve sakla** —
   başka tarayıcı/cihazdan aynı hazineyi bu ID ile açarsın.
5. **Fonla** — bir miktar XLM gir (ör. 20) → *Fund* → imzala.
6. **Payee whitelist'le** — ödeme yapılabilecek adresi ekle. İkinci bir adresin yoksa
   inputun altındaki **"use the sample vendor"** bağlantısına tıkla, örnek adresi kullan.
7. **Harca** — whitelist'lediğin adrese limit içinde bir ödeme gönder → on-chain işler ✓.
8. **Asıl gösteriyi izle** — şimdi bir de limit ÜSTÜ tutar dene, ya da whitelist dışı bir
   adrese göndermeyi dene: kontrat işlemi **on-chain reddeder**, para yerinden oynamaz.
   Bu red, ürünün ta kendisi. 🔴
9. **Hazineyi ajana devret (popup'lar bitsin)** — **Agent session** bölümünde harcama
   tavanı ve süre belirle → *Start agent session* (tek cüzdan onayı). Artık ödemeler
   session anahtarıyla imzalanır — **Run autonomous task**'a bas: 1 XLM, **sıfır cüzdan
   popup'ıyla** on-chain işler ve tüm limitler yine geçerlidir. *Revoke session* ile
   kontrolü anında geri alırsın.
10. **Sahip kontrolleri** — **Controls** bölümünde *Pause spending* (ajanı dondurur,
    withdraw çalışmaya devam eder), *Withdraw* ile paranı geri çek, *Update limits* ile
    limitleri anında güncelle — sahibin her zaman bir çıkışı var.

## Bir şey ters giderse

- Hata mesajları uygulama içinde açıklamalı gösterilir (bakiye yetersiz, imza reddedildi vb.).
- Sağ alttaki **Share feedback** butonu kısa bir Google Form açar — iki cümlelik geri
  bildirim yol haritasını doğrudan şekillendirir. 🙏

## Daha fazlası

- Ana [README](../README.md) — mimari, kontratlar, ZK confidential mode
- İzleyici demosu (cüzdan gerektirmez): ana sayfada **Launch live demo**

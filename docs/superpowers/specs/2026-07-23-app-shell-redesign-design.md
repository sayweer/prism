# App Shell Redesign — "gerçek ürün" dashboard mimarisi

**Tarih:** 2026-07-23 · **Durum:** Bekir onayı — kabuk + Overview + durum ekranları onaylandı (sohbet), alt sayfalar bu spec'le sunuldu
**Kapsam kaynağı:** Bekir: "Open app kısmı form gibi; gerçek bir ürün, mainnet'teymiş gibi kurgula." Wave 7 issue #13/#6/#10 bu işin içinde eriyor (Bekir kararı: hepsi bizde).

## Kısıtlar (Bekir'in çizdiği çerçeve)

- **İsim-bağımlı tema YOK.** "PRISM" geçici (testnet dönemi); mainnet'te isim değişecek (Seyit araştırıyor). Prizma/optik metaforu üzerine kurgu yapılmaz. Mevcut ◭ mark ve marka görselleri olduğu gibi kalır — sadece yeni isim-anlam yatırımı yapılmaz.
- **Görsel stil AYNEN devam:** koyu zemin, Stellar sarısı `#FDDA24` aksan, Fraunces display, mevcut kart/spacing dili, mevcut Background. Yeni component library / CSS framework YOK.
- **Bu bir yapı/UX işi:** bilgi mimarisi + layout + durum tasarımı. Kontrat, lib katmanı (activity/funnel/analytics/eventLedger/session) davranışı değişmez.
- Landing ve rehberli Demo (`#dashboard`, Dashboard.tsx) DOKUNULMAZ.

## Hedef kullanıcı + ton (Katman −1)

Kripto-native Stellar builder / agent geliştiricisi. Ton: **hassas bir enstrümanın başındaki operatör** — işletme-bankacılığı sakinliği değil, ama Bloomberg yoğunluğu da değil. Yoğunluk işlevsel, dil insan dili.

## Sahne planı

- **İlk 5 saniye inancı:** "Param bir kontratın koruması altında ve durumunu tek bakışta görüyorum." Form değil, durum.
- **TEK aha anı:** Overview hero'daki canlı limit enstrümanı — bugünkü harcama / günlük limit barı + policy durum çipleri ("kontrat nöbette"). Blocked olayının kırmızı düşüşü bu enstrümanın parçası.
- **Bilgi mimarisi (5 nav bölümü):** Overview · Payments (Send + Payees sekmeleri) · Agent · Activity · Settings.
  - Ayrı Analytics sayfası KALKAR → stat şeridi olarak Overview'a gömülür (lib/analytics + eventLedger aynen kullanılır).
  - Ayrı Wallet nav maddesi KALKAR → WalletChip menüsünden "Wallet details" olarak erişilir (`#wallet` route'u yaşar; landing linkleri kırılmaz).

## Kabuk (AppShell)

```
┌────────────┬──────────────────────────────────────────────┐
│ ◭ brand    │ [Treasury CBQQ…WCHZ ▾]        [G…TDQS ▾]     │  topbar: switcher (#10) + WalletChip
│            ├──────────────────────────────────────────────┤
│ ● Overview │                                              │
│   Payments │              AKTİF SAYFA                     │
│   Agent    │                                              │
│   Activity │                                              │
│   Settings │                                              │
│ ─────────  │                                              │
│ ⚠ Testnet  │                                              │
│ Docs ↗     │                                              │
└────────────┴──────────────────────────────────────────────┘
```

- Desktop ≥1024px: sabit sol sidebar 232px. Aktif madde: sarı aksan çubuğu + parlak metin. Altta kalıcı **Testnet badge** (mainnet'te tek satır siler) + Docs linki.
- Mobil <1024px: sidebar yok → üstte kompakt bar (brand + treasury kısa ad + WalletChip), altta **5'li bottom tab bar**. `landing.css`/`appnav.css` idiomuna uygun `shell.css` (media query'ler burada; komponent-içi inline style idiomu korunur).
- **Treasury switcher (#10):** topbar'da dropdown — local store (`treasuryStore`) ∪ on-chain registry (`discoverTreasuries`); registry kaynak-doğrusu, local-only kayıtlar "not registered" işaretli. Seçim değişince tüm bağımlı state reload'suz yenilenir. "Forget" sadece local siler.
- Bağlı değilken: topbar'da "Connect wallet" (chip'in mevcut davranışı); Activity herkese açık (platform feed'i sosyal kanıt), diğer sayfalar bağlantı kapısına düşer.

## Routing

- Hash routing devam: `#overview` `#payments` `#agent` `#activity` `#settings` (+ yaşayan `#wallet`, `#dashboard`, landing).
- **Geriye uyumluluk:** `#workspace` → `#overview` redirect (paylaşılmış link/doc kırılmaz).
- Funnel `page_view` + activity logging davranışı aynen.

## Overview — kahraman sayfa (onaylı wireframe)

```
┌─ HERO (viewport ~%55, asimetrik 7/5) ────────────────────────┐
│  BALANCE                        │  TODAY — POLICY LIVE       │
│  1,240.50 XLM  (Fraunces 56px)  │  daily  ████████░░  32/50  │
│  ● Active · Leash: none         │  per-payment ≤ 10 XLM      │
│  CBQQ…WCHZ [copy] [explorer ↗]  │  remaining today: 18 XLM   │
│                                 │  paused/blocked durumu     │
├─ QUICK ACTIONS ──────────────────────────────────────────────┤
│  [+ Fund]   [→ Send payment]   [⚡ Start Leash]              │
├─ ALT BÖLGE (asimetrik 7/5) ──────────────────────────────────┤
│  RECENT ACTIVITY (son 5)        │  STATS (24h)               │
│  ● pay 10 XLM → G…SGE   2m      │  payments 4 · spent 32     │
│  ● BLOCKED 150 XLM      1h      │  blocked 1 · payees 3      │
│  ● fund 200 XLM         3h      │  (eski Analytics verisi)   │
│  → View all                     │                            │
└──────────────────────────────────────────────────────────────┘
```

- Quick actions: Fund → butonun altında açılan inline panel (modal değil; mevcut fund akışı); Send → `#payments`; Start Leash → `#agent`.
- Motion: page-load stagger (hero → actions → alt bölge), balance sayı rulosu, limit barı soldan dolum; yeni blocked olayı kırmızı flaşla düşer. (framer-motion mevcut.)
- 3 katman: Background (atmosfer) + kart içerik + canlı bar/hover (etkileşim).

## Durum ekranları (onaylı)

1. **Bağlı değil:** ortalanmış kapı — marka + tek cümle vaat + [Connect wallet] + "watch the demo" ikincil link. Form yok.
2. **Bağlı, treasury yok → kurulum sihirbazı:** adım kartları — ⓪ friendbot kapısı (mevcut funding gate) → ① limitleri seç (insan dili: "agent'ın günde X'ten fazla harcaması matematiksel olarak imkânsız") → ② deploy (2 cüzdan onayının nedeni açıklanır). "Open existing treasury" ikincil yol.
3. **Treasury var, adımlar eksik:** hero üstünde ilerleme kartı: connect ✓ → deploy ✓ → fund → whitelist → first payment (#13 stepper). Gerçek ilerlemeden hesaplanır (balance>0, payee sayısı>0, pay olayı var mı); tamamlanınca kaybolur.

## Alt sayfalar

### Payments (Send | Payees sekmeleri)

```
[Send]  [Payees]
─ Send ───────────────────────────────
 To      [payee seçici ▾ | custom addr]
 Amount  [____]  · ≤10 XLM/payment · 18 XLM left today   ← canlı limit bağlamı
 imzacı çipi: "wallet signs" | "agent session signs — no popup"
 [Send payment]
─ Payment history ────────────────────
 ● 10 XLM → G…SGE   settled ✓  2m   tx↗
 ● 150 XLM → G…SGE  BLOCKED    1h
```

- Amount alanı canlı doğrular: per-task aşımı ve kalan-günlük uyarısı gönderMEDEN görünür (kontrat yine son söz).
- History: activity feed'in bu treasury + kind∈{pay, agent_pay, reject} filtresi.

```
─ Payees ─────────────────────────────
 G…KSGE   added 07-12   verified ✓   [remove]
 G…OMW4   added 07-03   verified ✓   [remove]
 [+ Add payee]  (sample vendor yardımcısı korunur)
```

- **Payee listesi türetme (kontratta enumeration YOK, sadece `is_payee`):** yeni `lib/payees.ts` — Supabase activity (action=whitelist/remove, bu treasury) ∪ localStorage cache ∪ optimistic ekleme; "verified" rozeti `is_payee` simülasyonuyla. Pure + vitest.
- Remove: mevcut `removePayee` (owner-signed) UI'a ilk kez bağlanır.

### Agent (Leash)

```
AKTİF:                                PASİF:
 Agent G…AB12 · key on this device     "Time-bound, spend-capped key…"
 cap  ███░░░ 8/25 XLM                  Cap [25]  Duration [24h]
 expires in 21h 14m (countdown)        [Start Leash]
 [Run autonomous task] [Revoke]
```

- Legacy (pre-M2) treasury: bilgi kartı (mevcut metin).
- "Key elsewhere" durumu mevcut mantıkla (revoke yönlendirmesi).

### Activity (#6 kapsamı)

- Mevcut 3-katman feed (Supabase geçmiş + Realtime + RPC, `mergeFeedEvents` korunur) + **kind filtre çipleri** + **"this treasury only" toggle** (bağlıyken) + load-more sayfalama. Filtre mantığı pure + test.

### Settings

- **Treasury:** tam ID + copy + explorer; registry durumu ("registered on-chain ✓" / değilse [Register] — deploy'da atlananlar için telafi).
- **Limits:** mevcut değerler prefilled + update formu (canlı geçerlilik: per-task ≤ daily).
- **Danger zone:** Pause/Resume + Withdraw (mevcut davranış, açıklamalı).

## Kesişen UI kararları (mainnet-grade cila)

- **Global tek status kutusu KALKAR** → aksiyonun yanında inline durum + tx sonuçları için kompakt toast ("Payment settled ✓ view tx↗"). Tek küçük Toast komponenti; mevcut Status mantığı taşınır.
- **Skeleton yükleme** ("Reading treasury…" metni yerine) + tasarlanmış **empty state'ler** (her boş liste bir sonraki adım CTA'sı taşır).
- Sayı formatı/etiketler mevcut `fmtUSDC`/`fmtXlm` ile; token etiketi her tutarın yanında.

## Komponent mimarisi (izolasyon)

- `TreasuryProvider` + `useTreasury()` — Workspace'teki state yumağı (address/treasuryId/state/lifecycle/session/busy/refresh) TEK context'e çıkar; tüm sayfalar aynı kaynağı okur. En kritik refactor budur.
- `AppShell.tsx` (+`shell.css`) — sidebar/topbar/bottom-bar + sayfa slotu.
- `pages/Overview.tsx` · `pages/Payments.tsx` · `pages/Agent.tsx` · `pages/ActivityPage.tsx` (mevcut ActivityFeed'i sarar) · `pages/Settings.tsx` · `pages/Setup.tsx` (sihirbaz + kapı).
- `lib/payees.ts` (türetme, pure) · `lib/onboarding.ts` (stepper ilerleme hesabı, pure).
- Workspace.tsx emekli olur (route redirect'le).

## Anayasa uygunluğu (app'e uyarlanmış)

- Tek kahraman: Overview hero ~%55 ✓ · asimetri 7/5 (iki bölgede) ✓ · section ritmi geniş→dar→grid ✓ · 3 katman ✓ · load stagger + scroll davranışı ✓.
- Tipo kontrastı: balance 56px / gövde 13-14px ≈ 4x — landing kuralı (≥5x) app yüzeyine bilinçli uyarlandı (dashboard'da 5x display pratik değil).
- Yasak kontrolü: "veri kategorisi başına eşit kart" yok — stat şeridi hero'ya tabi; 3+ ardışık eşit section yok.

## Test + doğrulama

- Pure mantık vitest: payees türetme, onboarding ilerleme, kalan-günlük hesabı, route map/redirect, activity filtre. Mevcut 107 test yeşil kalır.
- Manuel E2E (testnet, gerçek Freighter): deploy → fund → whitelist → pay → blocked → leash start/revoke → switcher.
- 375px mobil doğrulama + öncesi/sonrası screenshot (masaüstü + mobil).
- Ayna kapısı: screenshot "göz ilk nereye gidiyor / 100 AI-dashboard'undan ayırt edilir mi / 3+ eşit section var mı" testinden geçmeden Bekir'e gelmez.

## Rollout

- Branch: `feat/app-shell`; mantıksal birim başına commit (conventional commits).
- **Production deploy zamanlaması Bekir'in kararı** — 24 Tem etkinliğinde PRISM demosu var; etkinlik öncesi canlıyı değiştirmek ayrıca kararlaştırılır. Deploy manuel: `vercel --prod` (web/).
- Wave 7 tarafı (Bekir): #13/#6/#10 dashboard'dan çekilir/kapatılır; #8 (Leash expiry UX) ve #9 (mobil connect modal) AÇIK kalır — bu redesign onları kapsamaz.

## Kapsam dışı

- Kontrat değişikliği, ZK-pay (ayrı standing karar), prism-mcp, Landing/Demo revizyonu, #8/#9 issue'ları, yeni isim/marka işleri.

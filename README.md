# Y Pod saytı

Bir səhifəlik statik sayt: Vite, vanilla JS, Three.js (3D mikrofon) və GSAP (scroll animasiyası). Dillər: AZ (`/`), EN (`/en/`), RU (`/ru/`).

Dizayn mənbəyi (`design-handoff/`), biznes brifi (`CLAUDE.md`) və köhnə prototip (`arxiv/`) yalnız lokal kompüterdədir, repoya daxil deyil.

## Əmrlər

```bash
npm install        # bir dəfə
npm run dev        # http://localhost:5181, dəyişikliklər dərhal görünür
npm test           # qiymət məntiqinin testləri
npm run build      # dist/ qovluğuna hazır sayt
npm run preview    # dist/-i lokal göstərir
```

## Hər şey haradadır

| Nə | Harada |
|---|---|
| Səhifənin quruluşu (bir şablon, 3 dil) | `src/template.html` |
| Mətnlər | `src/i18n/az.json`, `en.json`, `ru.json` |
| Telefon, koordinat, Instagram endpoint, GLB yolu | `src/js/config.js` |
| Qiymətlər | `src/js/pricing.js` (+ `tests/pricing.test.mjs`) |
| Rənglər, ölçülər | `src/styles/tokens.css` |
| 3D mikrofon modeli | `src/js/mic-model.js` |
| Scroll animasiyası | `src/js/hero3d.js` |

`src/index.html`, `src/en/`, `src/ru/` avtomatik yaradılır (`scripts/render-pages.mjs`). Onları əl ilə dəyişmə, `template.html`-i və ya JSON-u dəyiş.

Qiymət dəyişəndə üç yer yenilənir: `src/js/pricing.js`, testdəki gözlənilən rəqəmlər və şablondakı ilkin rəqəmlər (JS işləməyəndə görünənlər).

## 3D hero necə işləyir

- İlk ekranda statik mikrofon şəkli (`src/assets/mic-hero.webp`) görünür. Bu şəkil 3D-nin ilk kadrından çəkilib, ona görə 3D gələndə keçid görünmür. Three.js və GSAP ilk toxunuş və ya scroll-da yüklənir.
- Mikrofonun modeli və ya işığı dəyişəndə şəkli yenidən çək: `scripts/capture-mic.mjs` (istifadə qaydası faylın başındadır).
- 3D bu hallarda söndürülür və statik hero qalır: `prefers-reduced-motion`, WebGL olmaması, zəif telefon (`hardwareConcurrency ≤ 4`).
- Hazır GLB modeli gələndə onu `public/models/mic.glb`-yə qoy və `config.js`-də `micModelUrl: 'models/mic.glb'` yaz. Model Draco ilə sıxılmalı və ≤ 1.5 MB olmalıdır.

## Instagram bölməsini qoşmaq

Hazırda bölmə gizlidir (`config.js`-də `instagram.demo: false`, `endpoint: null`). Aşağıdakı addımlarla worker qoşulub `endpoint` yazılanda bölmə özü görünəcək.

1. Instagram hesabı **Professional** (Business və ya Creator) olmalıdır.
2. [developers.facebook.com](https://developers.facebook.com)-da app yarat → "Instagram API with Instagram Login" əlavə et → @ypod.az-ı qoş → uzunmüddətli access token al.
3. Cloudflare-də pulsuz hesab aç, sonra `worker/` qovluğunda:
   ```bash
   npx wrangler login
   npx wrangler kv namespace create IG_KV     # çıxan id-ni wrangler.toml-a yaz
   npx wrangler secret put IG_TOKEN           # tokeni yapışdır
   npx wrangler deploy
   ```
4. `wrangler.toml`-da `ALLOW_ORIGIN`-ə saytın ünvanını yaz.
5. `src/js/config.js`-də `instagram.endpoint` = `https://ypod-instagram.<hesab>.workers.dev/api/instagram`.

Token həftədə bir dəfə avtomatik yenilənir. Worker cavabı 1 saat keşdə saxlayır.

## GitHub Pages-ə çıxarmaq

`.github/workflows/deploy.yml` `main` branch-ə hər push-da testləri işlədir, saytı build edir və Pages-ə yükləyir. Bir dəfəlik: repo → Settings → Pages → Source: **GitHub Actions**.

Domen (`ypod.az`) bağlananda: Settings → Variables → `SITE_URL=https://ypod.az` (hreflang və canonical üçün) və `public/CNAME` faylına `ypod.az` yaz.

## Doldurulmalı yerlər

| Yer | İndi |
|---|---|
| Google Maps profili | koordinatla axtarış linki (`config.js` → `mapsUrl`) |
| Podcast paneli | 16:10 foto/video yeri |
| Reels paneli | 9:16 video yeri |
| Brend loqoları | PAŞA Bank, ORZAX, alyars hələlik mətnlə |
| Instagram | bölmə gizlidir, worker qoşulmayıb |
| EN / RU | qaralama tərcümə, dil bilən biri yoxlamalıdır |
| OG şəkli | 1200×630, yoxdur |

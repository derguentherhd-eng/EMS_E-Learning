# Design Context (auto, edit freely)
stack: vanilla HTML/CSS/JS, no build; classic scripts via EM.define/EM.require (js/core/em.js), hash router
css: vanilla CSS, @layer reset,tokens,base,layout,components,utilities; BEM; one entry file per page (css/index.css)
priority: PC-FIRST (desktop/laptop, mouse + keyboard, 1280–2560px). Mobile is secondary (must work, not optimized). Targets: WCAG 2.5.8 min 24px for mouse; 48px touch only below 48rem. Judge layout use of wide screens, keyboard flow, hover/focus states.
grid: 8 | half-steps 4 allowed for ≤ 8px details
tokens: css/base/tokens.css (colors, --step-* type scale, --space-*, --radius-*, --layout-max 72rem, --measure 85ch – intentionally wide by user request, do not flag)
type: Lato (400/500/700, italic for links) | fluid scale ratio 1.25 (--step--1 … --step-4)
colors: design system #FFED00 yellow (primary action), #534495 purple (state/accent), #1E1E1E graphite, #000 masthead; dark default + light theme
breakpoints: 48rem (nav), 100rem/140rem (root font 112.5%/125%)
ui-paths: index.html, css/base, css/components, css/blocks, css/views, js/views, js/blocks, js/ui
ignore: css/editor, css/pages, editor.html, pruefen.html, tests.html, designsystem.html, content/inhalte.js
journeys:
1. Kurs starten: #/ (Start) → #/kapitel/<id>/1 → Weiter (gesperrt bis Übung gelöst) → Quiz → Ergebnis
2. Sicherheitsunterweisung: #/kapitel/05-arbeitssicherheit/1 → alle Seiten → Quiz → PDF-Nachweis
3. Abschluss: alle Sektoren bestanden → Zertifikat (Name eingeben, PDF)
4. Einstellungen/Sprache: Kopfleiste Helles Design / English → #/einstellungen (Zurücksetzen-Dialog)

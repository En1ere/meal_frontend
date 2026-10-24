0.0.9 - 10.24.2026 | 18:34 - Перенос в самостоятельный frontend workspace с единой установкой React и сохранением общих UI-примитивов.

0.0.8 - 12.10.2026 | 15:33 - AppShell и ServiceShell согласованы с React ref lifecycle: cleanup использует стабильный opener, а закрытие native dialog выполняется только обработчиком события, не во время render.

0.0.7 - 10.09.2026 | 20:45 - ServiceShell mobile drawer переведён на native dialog с modal focus containment, Escape/return-focus и корректным hidden closed-state; PublicShell actions и ThemeSwitcher select нормализованы до доступного touch-target не меньше 44px.

0.0.6 - 10.08.2026 | 15:03 - Все scroll-контейнеры используют общий scrollbar шириной 8 px без browser arrows и с отдельными track/thumb/hover tokens для четырёх тем.

0.0.5 - 10.08.2026 | 14:49 - AuthShell переключается в vertical art/card composition до 900 px, с полноширинной mobile card и согласованным overlap; семантическое правило цвета закреплено в README.

0.0.4 - 10.08.2026 | 14:32 - PublicShell разделяет обычную навигацию и CTA, переносит theme control в footer и использует responsive rows без overlap или обрезания действий на desktop/mobile landing.

0.0.3 - 10.08.2026 | 14:09 - Добавлены router-agnostic PublicShell, AuthShell и ServiceShell для публичных, auth и отдельных служебных поверхностей; routing, guards и бизнес-состояние остаются в приложениях.

0.0.2 - 10.08.2026 | 13:08 - Добавлены router-agnostic AppShell и AppIcon: desktop sidebar/topbar, collapsed-state, mobile dock, modal-sheet «Ещё», focus trap и reduced-motion стили.

0.0.1 - 10.08.2026 | 12:24 - Инициализирован локальный пакет Meal Planner Design System: четыре темы, семантические токены, theme switcher и loading primitives.

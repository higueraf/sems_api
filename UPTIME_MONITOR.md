# ══════════════════════════════════════════════════════════════════════
# SEMS — Monitor de disponibilidad (UptimeRobot / BetterUptime / cron)
# ══════════════════════════════════════════════════════════════════════
#
# El plan gratuito de Render suspende servicios tras 15 min de inactividad.
# Solución: un servicio externo hace ping cada 5-10 min, independientemente
# de si alguien tiene el frontend abierto.
#
# ── OPCIÓN A: UptimeRobot (RECOMENDADO — completamente gratis) ──────────
#
#  1. Crear cuenta en https://uptimerobot.com (plan gratuito)
#  2. Dashboard → Add New Monitor:
#
#     Monitor Type:   HTTP(s)
#     Friendly Name:  SEMS API
#     URL:            https://sems-api.onrender.com/api/health/ping
#     Monitoring Interval: 5 minutes   ← plan gratuito permite hasta 5 min
#
#  3. Alert Contacts → Add Email Alert:
#     → Ingrese su email para recibir notificación si el servicio cae
#
#  Resultado: ping cada 5 minutos, 24/7, desde los servidores de UptimeRobot.
#  El servicio NUNCA duerme. Sin costo.
#
# ── OPCIÓN B: cron-job.org (alternativa, también gratis) ───────────────
#
#  1. Crear cuenta en https://cron-job.org
#  2. Cronjobs → Create cronjob:
#
#     URL:      https://sems-api.onrender.com/api/health/ping
#     Schedule: Every 10 minutes  (*/10 * * * *)
#     Method:   GET
#
# ── OPCIÓN C: GitHub Actions (si ya usa GitHub) ────────────────────────
#
#  Crear archivo .github/workflows/keep-alive.yml con el contenido
#  del archivo keep-alive.yml incluido en este directorio.
#  GitHub Actions tiene 2.000 minutos/mes gratis en repos públicos
#  y 500 minutos/mes en repos privados.
#
# ── ENDPOINTS disponibles ──────────────────────────────────────────────
#
#  GET /api/health/ping  → { pong: true, ts: 1234567890 }  (ultra ligero)
#  GET /api/health       → { status, db, memory, uptime }  (diagnóstico completo)
#
# ══════════════════════════════════════════════════════════════════════

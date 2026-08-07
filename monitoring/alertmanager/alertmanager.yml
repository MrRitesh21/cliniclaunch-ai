# Alertmanager — Discord, Telegram and Email. No extra services required:
# discord_configs and telegram_configs are native since v0.25/v0.26.
global:
  resolve_timeout: 5m
  smtp_smarthost: "${SMTP_HOST}:${SMTP_PORT}"
  smtp_from: "${SMTP_FROM}"
  smtp_auth_username: "${SMTP_USER}"
  smtp_auth_password: "${SMTP_PASSWORD}"
  smtp_require_tls: true

templates:
  - /etc/alertmanager/templates/*.tmpl

route:
  receiver: default-all
  group_by: [alertname, component, severity]
  group_wait: 30s
  group_interval: 5m
  # Long repeat interval keeps a flapping dependency from becoming spam.
  repeat_interval: 4h
  routes:
    # Critical: every channel, fast, and repeated more often.
    - matchers:
        - severity = "critical"
      receiver: critical-all
      group_wait: 10s
      repeat_interval: 1h
      continue: false

    # Warnings: chat only, no email noise.
    - matchers:
        - severity = "warning"
      receiver: chat-only
      repeat_interval: 6h

    # Informational: Discord only.
    - matchers:
        - severity = "info"
      receiver: discord-only
      repeat_interval: 12h

inhibit_rules:
  # If the API is down, don't also page about its latency, errors or CPU.
  - source_matchers: [alertname = "ApiDown"]
    target_matchers: [component = "backend"]
    equal: [component]
  # A dead database explains slow queries.
  - source_matchers: [alertname = "DatabaseDown"]
    target_matchers: [alertname = "DatabaseSlow"]

receivers:
  - name: default-all
    discord_configs:
      - webhook_url: "${DISCORD_WEBHOOK_URL}"
        title: '{{ template "clinicx.title" . }}'
        message: '{{ template "clinicx.text" . }}'
        send_resolved: true

  - name: critical-all
    discord_configs:
      - webhook_url: "${DISCORD_WEBHOOK_URL}"
        title: '{{ template "clinicx.title" . }}'
        message: '{{ template "clinicx.text" . }}'
        send_resolved: true
    telegram_configs:
      - bot_token: "${TELEGRAM_BOT_TOKEN}"
        chat_id: ${TELEGRAM_CHAT_ID}
        parse_mode: HTML
        message: '{{ template "clinicx.telegram" . }}'
        send_resolved: true
    email_configs:
      - to: "${ALERT_EMAIL_TO}"
        headers:
          Subject: '{{ template "clinicx.title" . }}'
        html: '{{ template "clinicx.email" . }}'
        send_resolved: true

  - name: chat-only
    discord_configs:
      - webhook_url: "${DISCORD_WEBHOOK_URL}"
        title: '{{ template "clinicx.title" . }}'
        message: '{{ template "clinicx.text" . }}'
        send_resolved: true
    telegram_configs:
      - bot_token: "${TELEGRAM_BOT_TOKEN}"
        chat_id: ${TELEGRAM_CHAT_ID}
        parse_mode: HTML
        message: '{{ template "clinicx.telegram" . }}'
        send_resolved: true

  - name: discord-only
    discord_configs:
      - webhook_url: "${DISCORD_WEBHOOK_URL}"
        title: '{{ template "clinicx.title" . }}'
        message: '{{ template "clinicx.text" . }}'
        send_resolved: false

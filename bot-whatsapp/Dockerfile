# Puente de WhatsApp de Magic Collinn en Railway (copiado del de Camila/Paraíso).
# whatsapp-web.js maneja WhatsApp Web con un Chromium sin pantalla.
FROM node:20-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    ca-certificates \
    fonts-liberation \
    fonts-noto-color-emoji \
    tini \
  && rm -rf /var/lib/apt/lists/*

# Puppeteer usa el Chromium del sistema, no descarga el suyo.
ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    NODE_ENV=production \
    TZ=America/Mexico_City

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY . .

EXPOSE 3001

# `tini` como proceso 1: recoge los procesos de Chromium que mueren. Sin él,
# en Camila de Kora los «zombis» llenaron el tope de 1,000 procesos (21 sep 2026).
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "index.js"]

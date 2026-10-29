FROM node:22-bookworm-slim
# LibreOffice ליצירת PDF מקובץ Word, ופונטים עם תמיכה בעברית
RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice-writer fonts-liberation fonts-dejavu-core fonts-freefont-ttf \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY . .
ENV NODE_ENV=production DATA_DIR=/data PORT=3000
EXPOSE 3000
CMD ["node", "server.js"]

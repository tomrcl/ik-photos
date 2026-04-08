FROM node:20-alpine

WORKDIR /app

COPY . .
RUN npm install --os=linux --libc=musl --cpu=x64 sharp

EXPOSE 3004

CMD ["node", "index.js"]
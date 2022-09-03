FROM node:16-alpine as builder
WORKDIR /opt/app
ENV NODE_ENV production
COPY package.json package-lock.json ./
RUN npm install --production=false
COPY . .
RUN npm run build

FROM nginx:stable-alpine
COPY --from=builder /opt/app/dist /usr/share/nginx/html

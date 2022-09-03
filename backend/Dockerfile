FROM node:16-alpine
WORKDIR /opt/app
ENV NODE_ENV production

COPY package.json package-lock.json ./
RUN npm install --production=false
COPY . .
RUN npm run build && \
	npm install --production=true

CMD [ "npm", "run", "serve"]
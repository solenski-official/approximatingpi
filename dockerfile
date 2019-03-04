FROM node:8
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY src ./
COPY static ./
RUN npm run build
EXPOSE 8080
CMD ["live-server", "static"]

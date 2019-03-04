FROM node:8
COPY package*.json ./
RUN npm install
COPY src src
COPY static static
RUN npm run build
EXPOSE 8080
CMD ["npm", "start"]

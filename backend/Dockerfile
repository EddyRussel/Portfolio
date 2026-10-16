FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

# Mode développement (rechargement automatique avec tsx)
CMD ["npm", "run", "dev"]

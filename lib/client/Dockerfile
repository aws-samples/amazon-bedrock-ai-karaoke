FROM node:18 AS builder

ENV NODE_ENV production
# Add a work directory
WORKDIR /app
# Cache and Install dependencies
COPY package.json .
COPY package-lock.json .
RUN npm install
# Copy app files
COPY . .
# Build the app
RUN npm run build

# Bundle static assets with nginx
FROM nginx:stable as production
ENV NODE_ENV production
# Copy built assets from builder
COPY --from=builder /app/build /usr/share/nginx/html
HEALTHCHECK CMD curl --fail http://localhost:3000 || exit 1
# Add your nginx.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Expose port
EXPOSE 80
# Mount volume
RUN mkdir -p /usr/share/nginx/html/pics
VOLUME ["/usr/share/nginx/html/pics"]
# Start nginx
CMD ["nginx", "-g", "daemon off;"]
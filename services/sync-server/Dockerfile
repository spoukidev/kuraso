FROM node:22-alpine
WORKDIR /app
COPY server.mjs ./
ENV PORT=8787
ENV KURASO_DATA_DIR=/data
VOLUME ["/data"]
EXPOSE 8787
CMD ["node", "server.mjs"]

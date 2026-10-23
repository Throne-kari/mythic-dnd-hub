FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4780 HUB_MANAGER=0 HUB_RUNTIME_DIR=/app/runtime
COPY --chown=node:node . .
RUN mkdir -p /app/runtime && chown node:node /app/runtime
USER node
EXPOSE 4780
VOLUME ["/app/runtime"]
CMD ["node", "server.mjs", "--public-only"]

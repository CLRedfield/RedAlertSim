# Template only. This image was not built or deployed during delivery.
FROM node:22.22.3-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8787
COPY --chown=node:node web/ ./web/
COPY --chown=node:node server/ ./server/
COPY --chown=node:node LICENSE.txt ./LICENSE.txt
USER node
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s CMD node -e "fetch('http://127.0.0.1:8787/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "server/server.cjs"]

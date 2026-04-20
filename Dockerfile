FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /capstone
COPY agent/requirements.txt ./requirements.txt
RUN pip3 install --no-cache-dir --break-system-packages -r requirements.txt
COPY agent ./agent

WORKDIR /frontend
COPY oo-chat/package.json oo-chat/package-lock.json ./
# Ensure platform-specific optional native packages (e.g. lightningcss) are installed in Docker.
RUN npm ci --include=optional && \
    ARCH="$(dpkg --print-architecture)" && \
    if [ "$ARCH" = "arm64" ]; then \
      npm install --no-save lightningcss-linux-arm64-gnu@1.30.2 @tailwindcss/oxide-linux-arm64-gnu@4.1.18; \
    elif [ "$ARCH" = "amd64" ]; then \
      npm install --no-save lightningcss-linux-x64-gnu@1.30.2 @tailwindcss/oxide-linux-x64-gnu@4.1.18; \
    fi
COPY oo-chat/ .

ARG NEXT_PUBLIC_DEFAULT_AGENT_URL=http://localhost:8000
ARG NEXT_PUBLIC_OPENONION_API_URL=https://oo.openonion.ai
ENV NEXT_PUBLIC_DEFAULT_AGENT_URL=${NEXT_PUBLIC_DEFAULT_AGENT_URL}
ENV NEXT_PUBLIC_OPENONION_API_URL=${NEXT_PUBLIC_OPENONION_API_URL}
ENV CAPSTONE_ROOT=/capstone
ENV AGENT_PROJECT_PATH=/capstone
ENV AUTOMATION_CONFIG_PATH=/capstone/agent/automation/automation_config.json

RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["sh", "-c", "exec ./node_modules/.bin/next start -H 0.0.0.0 -p ${PORT:-3000}"]

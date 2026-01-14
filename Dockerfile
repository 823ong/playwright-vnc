# Based on Ubuntu image
FROM ubuntu:22.04

# Avoid interactive installation prompts
ENV DEBIAN_FRONTEND=noninteractive

# Set Node module path so startup scripts can find playwright
ENV NODE_PATH=/app/node_modules

# Install base dependencies, Node.js, VNC tools
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    gnupg \
    ca-certificates \
    build-essential \
    xvfb \
    fluxbox \
    x11vnc \
    git \
    python3 \
    python3-numpy \
    && rm -rf /var/lib/apt/lists/*

# Install latest noVNC (apt version is too old and causes compatibility issues)
RUN git clone --depth 1 https://github.com/novnc/noVNC.git /opt/novnc && \
    git clone --depth 1 https://github.com/novnc/websockify.git /opt/novnc/utils/websockify && \
    ln -s /opt/novnc/vnc_lite.html /opt/novnc/index.html

# Install Node.js 20.x
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

# Set npm mirror (optional, speeds up installation)
RUN npm config set registry https://registry.npmmirror.com/

# Create working directory
WORKDIR /app

# Install Playwright and related browsers
RUN npm init -y && \
    npm install playwright express http-proxy-middleware && \
    npx playwright install chromium && \
    npx playwright install-deps chromium

# Copy startup scripts
COPY start-vnc.sh /root/start-vnc.sh
COPY start-browser.js /root/start-browser.js
COPY gateway-server.js /root/gateway-server.js

# Set script permissions
RUN chmod +x /root/start-vnc.sh

# Create user data directory
RUN mkdir -p /app/profile

# Expose ports
# 8080: Unified gateway port (CDP/WS/API)
# 6080: noVNC Web interface
EXPOSE 8080 6080

# Startup script
CMD ["/root/start-vnc.sh"]

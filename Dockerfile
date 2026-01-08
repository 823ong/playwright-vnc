# 基于Ubuntu镜像
FROM ubuntu:22.04

# 避免交互式安装提示
ENV DEBIAN_FRONTEND=noninteractive

# 设置Node模块路径，使得启动脚本能找到playwright
ENV NODE_PATH=/app/node_modules

# 安装基础依赖、Node.js、VNC相关工具
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

# 安装最新版 noVNC (apt 版本太旧会导致兼容性问题)
RUN git clone --depth 1 https://github.com/novnc/noVNC.git /opt/novnc && \
    git clone --depth 1 https://github.com/novnc/websockify.git /opt/novnc/utils/websockify && \
    ln -s /opt/novnc/vnc_lite.html /opt/novnc/index.html

# 安装Node.js 20.x
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

# 设置npm镜像（可选，加速安装）
RUN npm config set registry https://registry.npmmirror.com/

# 创建工作目录
WORKDIR /app

# 安装Playwright和相关浏览器
RUN npm init -y && \
    npm install playwright express http-proxy-middleware && \
    npx playwright install chromium && \
    npx playwright install-deps chromium

# 复制启动脚本
COPY start-vnc.sh /root/start-vnc.sh
COPY start-browser.js /root/start-browser.js
COPY gateway-server.js /root/gateway-server.js

# 设置脚本权限
RUN chmod +x /root/start-vnc.sh

# 创建用户数据目录
RUN mkdir -p /app/profile

# 暴露端口
# 8080: 统一网关端口 (CDP/WS/API)
# 6080: noVNC Web 界面
EXPOSE 8080 6080

# 启动脚本
CMD ["/root/start-vnc.sh"]

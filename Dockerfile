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
    novnc \
    websockify \
    socat \
    && rm -rf /var/lib/apt/lists/*

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
    npm install playwright && \
    npx playwright install chromium && \
    npx playwright install-deps chromium

# 复制启动脚本
COPY start-vnc.sh /root/start-vnc.sh
COPY start-browser.js /root/start-browser.js

# 设置脚本权限
RUN chmod +x /root/start-vnc.sh

# 创建用户数据目录
RUN mkdir -p /app/profile

# 暴露端口
# 6080: noVNC (web界面访问VNC)
# 5900: VNC协议端口
# 9223: Chrome DevTools Protocol (CDP) 调试接口 (通过 socat 转发)
EXPOSE 6080 5900 9223

# 启动脚本
CMD ["/root/start-vnc.sh"]

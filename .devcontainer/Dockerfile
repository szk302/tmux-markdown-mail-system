FROM debian:12.11-slim

ARG TZ=Asia/Tokyo
ARG UID=1000
ARG GID=1000
ARG USER_NAME=dev
ARG ARCH=arm64
ARG KIRO_CLI_VERSION=latest
ARG CLAUDE_CODE_VERSION=2.0.25
ARG GEMINI_CLI_VERSION=0.19.1
ARG NODE_VERSION=24.14.0

LABEL maintainer="69619077+szk302@users.noreply.github.com" \
      description="tmms developer image" \
      version="0.1.0"

ENV DEVCONTAINER=true \
    LC_ALL=ja_JP.UTF-8 \
    LANG=ja_JP.UTF-8 \
    TZ="${TZ}" \
    PATH="/usr/local/bin:${PATH}" \
    HISTFILE="/commandhistory/.bash_history" \
    DEBIAN_FRONTEND=noninteractive \
    USER_NAME="${USER_NAME}"

SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# -------------------------------------------------------------------
# 基本ツール + ロケール
# -------------------------------------------------------------------
# hadolint ignore=DL3008
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        gnupg \
        gpgv \
        locales \
        build-essential \
        unzip \
        jq \
        less \
        git \
        gosu \
        sudo \
        xdg-utils \
        # Git SSH署名用
        openssh-client && \
    rm -rf /var/lib/apt/lists/* && \
    sed -i -E 's/# (ja_JP.UTF-8)/\1/' /etc/locale.gen && \
    locale-gen

# -------------------------------------------------------------------
# ユーザー作成
# -------------------------------------------------------------------
RUN groupadd --gid "${GID}" "${USER_NAME}" && \
    useradd --uid "${UID}" --gid "${GID}" --shell /bin/bash --create-home "${USER_NAME}" && \
    echo "${USER_NAME}:${USER_NAME}" | /usr/sbin/chpasswd && \
    echo "${USER_NAME} ALL=(ALL:ALL) ALL" | tee "/etc/sudoers.d/${USER_NAME}" && \
    chmod 0440 "/etc/sudoers.d/${USER_NAME}"

WORKDIR /tmp

# -------------------------------------------------------------------
# Node.js (実行)
# -------------------------------------------------------------------
ENV NPM_CONFIG_PREFIX="/home/${USER_NAME}/.npm-global" \
    PATH="/home/${USER_NAME}/.npm-global/bin:${PATH}"

RUN TMP_DIR=$(mktemp -d) && \
    # NODE_DISTRO="linux-x64" && \
    NODE_DISTRO="linux-${ARCH}" && \
    curl --proto '=https' --tlsv1.2 -fsSL "https://github.com/nodejs/release-keys/raw/HEAD/gpg/pubring.kbx" -o "${TMP_DIR}/pubring.kbx" && \
    curl --proto '=https' --tlsv1.2 -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-${NODE_DISTRO}.tar.gz" -o "${TMP_DIR}/node-v${NODE_VERSION}-${NODE_DISTRO}.tar.gz" && \
    curl --proto '=https' --tlsv1.2 -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/SHASUMS256.txt.asc" -o "${TMP_DIR}/SHASUMS256.txt.asc" && \
    gpgv --keyring="${TMP_DIR}/pubring.kbx" --output "${TMP_DIR}/SHASUMS256.txt" "${TMP_DIR}/SHASUMS256.txt.asc" && \
    grep "node-v${NODE_VERSION}-${NODE_DISTRO}.tar.gz" "${TMP_DIR}/SHASUMS256.txt" | sed "s|node-v|${TMP_DIR}/node-v|" | sha256sum -c - && \
    tar -xzf "${TMP_DIR}/node-v${NODE_VERSION}-${NODE_DISTRO}.tar.gz" -C /usr/local --strip-components=1 && \
    rm -rf "${TMP_DIR}" && \
    node --version && npm --version

# -------------------------------------------------------------------
# 開発ツール（ユーザ権限）
# -------------------------------------------------------------------
USER ${USER_NAME}
WORKDIR /home/${USER_NAME}
RUN mkdir -p .config && \
    chown "${USER_NAME}":"${USER_NAME}" .config

# -------------------------------------------------------------------
# aqua
# -------------------------------------------------------------------
ENV PATH="/home/${USER_NAME}/.local/share/aquaproj-aqua/bin/:${PATH}" \
    AQUA_GLOBAL_CONFIG="/home/${USER_NAME}/.config/aquaproj-aqua/aqua.yml"
RUN TMP_DIR=$(mktemp -d) && \
    curl --proto '=https' --tlsv1.2 -fsSL "https://raw.githubusercontent.com/aquaproj/aqua-installer/v4.0.4/aqua-installer" -o "${TMP_DIR}/aqua-installer" && \
    echo "acd21cbb06609dd9a701b0032ba4c21fa37b0e3b5cc4c9d721cc02f25ea33a28  ${TMP_DIR}/aqua-installer" | sha256sum -c && \
    chmod +x "${TMP_DIR}/aqua-installer" && \
    "${TMP_DIR}/aqua-installer" && \
    rm -rf "${TMP_DIR}" && \
    aqua --version
COPY aqua.yml /home/${USER_NAME}/.config/aquaproj-aqua/aqua.yml
RUN aqua i -a

# -------------------------------------------------------------------
# Amazon Kiro CLI
# -------------------------------------------------------------------
RUN TMP_DIR=$(mktemp -d) && \
    OS=$(uname -m) && \
    INSTALL_FILE_NAME="kirocli-${OS}-linux.tar.gz" && \
    curl --proto '=https' --tlsv1.2 -fsSL "https://desktop-release.q.us-east-1.amazonaws.com/${KIRO_CLI_VERSION}/${INSTALL_FILE_NAME}" -o "${TMP_DIR}/${INSTALL_FILE_NAME}" && \
    curl --proto '=https' --tlsv1.2 -fsSL "https://desktop-release.q.us-east-1.amazonaws.com/${KIRO_CLI_VERSION}/${INSTALL_FILE_NAME}.sig" -o "${TMP_DIR}/${INSTALL_FILE_NAME}.sig" && \
    mkdir -p "$HOME/.local" && \
    tar -xzf "${TMP_DIR}/${INSTALL_FILE_NAME}" -C "$HOME/.local" --strip-components=1 && \
    "$HOME/.local/bin/kiro-cli" setup --no-confirm && \
    rm -rf "${TMP_DIR}" && \
    source ~/.bashrc && \
    kiro-cli --version

# Claude Code CLI
COPY --chown=${USER_NAME}:${USER_NAME} .claude /home/${USER_NAME}/.claude

# Gemini CLI
RUN npm install -g "@google/gemini-cli" && \
    gemini --version

# -------------------------------------------------------------------
# エントリポイント
# -------------------------------------------------------------------
# hadolint ignore=DL3002
USER root
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]

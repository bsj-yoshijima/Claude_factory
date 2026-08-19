# Claude Factory — Cloud Run 用のイメージ。
#
#   ローカルで確かめる:
#     docker build -t claude-factory .
#     docker run --rm -p 8080:8080 \
#       -e DATABASE_URL='postgres://factory:factory@host.docker.internal:55432/factory' \
#       -e PUBLIC_URL='http://localhost:8080' claude-factory
#
# 依存は pg 1つだけなのでビルドは軽い。重いのはアセット(実行時に必要なぶんで46MB)で、
# 何を持ち込まないかは .dockerignore / .gcloudignore に書いてある。
FROM node:22-alpine

ENV NODE_ENV=production
# Cloud Run は PORT を注入してくるが、ローカルで docker run したときの既定も揃えておく
ENV PORT=8080

WORKDIR /app

# 依存だけ先に入れる。アセットを差し替えてもここのレイヤーは再利用される
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# アプリ本体。assets のうちクライアントが読まないもの(prop-src など35MB)は
# .dockerignore / .gcloudignore で除外しているので、ここは丸ごとコピーしてよい
COPY server ./server
COPY db ./db
COPY game ./game
COPY vendor ./vendor
COPY assets ./assets
COPY factory-phaser.html ./

# スキーマは当てない。当てるのは npm run db:migrate（オーナーの操作 / CI）だけで、
# サーバは起動時に世代を確認して合わなければ止まる（db/version.mjs）。
USER node

CMD ["node", "server/index.mjs"]

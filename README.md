# deno-hikkasay
# 0 non-std dependency

# env params
BOT_TOKEN=
OPENROUTERAPI_KEY=
OPENROUTER_TOKEN=
CHAT_ID=-1001242433481 # tdoh

DATA_DIR=/app/data

LOCALAPI_URL=

# run
deno run --allow-net --allow-env --env --allow-read --allow-write src/main.ts

docker compose up --build

# Build stage
FROM denoland/deno:latest AS builder
WORKDIR /app

COPY deno.json deno.lock* ./
RUN deno install

COPY src/ ./src/
COPY tests/ ./tests/
COPY types.ts ./

# RUN deno test --allow-all

RUN deno compile --allow-net --allow-env --allow-read --allow-write --output hikkasay src/main.ts
RUN mkdir -p /app/data

# Production stage
# FROM denoland/deno:latest
# WORKDIR /app

# COPY --from=builder /deno-dir /deno-dir
# COPY --from=builder /app/src ./src
# COPY --from=builder /app/deno.json .

# CMD ["run", "--allow-net", "--allow-env", "--env", "--allow-read=data", "--allow-write=data", "src/main.ts"]

FROM gcr.io/distroless/cc-debian12

WORKDIR /app

COPY --from=builder /etc/passwd /etc/passwd
COPY --from=builder /etc/group /etc/group

USER deno

COPY --from=builder /app/hikkasay .

COPY --from=builder --chown=1000:1000 /app/data /app/data

# процесс от UID напрямую
USER 1000:1000

CMD ["./hikkasay"]

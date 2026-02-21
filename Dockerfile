# Build stage
FROM denoland/deno:latest AS builder
WORKDIR /app

COPY deno.json deno.lock* ./
RUN deno install

COPY src/ ./src/

RUN deno compile --allow-net --allow-env --allow-read --allow-write --output hikkasay src/main.ts
RUN mkdir -p /app/data

FROM gcr.io/distroless/cc-debian12

WORKDIR /app
USER 1000:1000

COPY --from=builder /etc/passwd /etc/passwd
COPY --from=builder /etc/group /etc/group
COPY --from=builder --chown=1000:1000 /app/data /app/data
COPY --from=builder /app/hikkasay .

CMD ["./hikkasay"]

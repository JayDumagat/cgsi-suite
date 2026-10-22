FROM golang:1.26-alpine AS build

ARG SERVICE
WORKDIR /src/services
COPY backend/go.mod ./go.mod
COPY backend/ ./
RUN mkdir -p /out \
    && test -n "$SERVICE" \
    && CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/service "./${SERVICE}/cmd/${SERVICE}" \
    && CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/healthcheck ./healthcheck/cmd/healthcheck

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/service /service
COPY --from=build /out/healthcheck /healthcheck
USER nonroot:nonroot
ENTRYPOINT ["/service"]

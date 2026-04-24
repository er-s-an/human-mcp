#!/usr/bin/env bash
set -euo pipefail

SCRIPT_NAME=$(basename "$0")

usage() {
  cat <<USAGE
Usage:
  $SCRIPT_NAME check-env
  $SCRIPT_NAME smoke-read
  $SCRIPT_NAME verify-proof <proof_id>
  $SCRIPT_NAME complete-stamp <proof_id> <virtual_done|hardware_done|failed|skipped>

Required env:
  HUMAN_MCP_API_BASE_URL   Full API base URL ending in /api/v1
  HUMAN_MCP_AUTH_TOKEN     Bearer token value (raw token or Bearer-prefixed)

Optional env:
  HUMAN_MCP_DRY_RUN=1      Print curl commands instead of executing them
USAGE
}

log() {
  printf '[humanmcp-probe] %s\n' "$*"
}

fail() {
  printf '[humanmcp-probe] ERROR: %s\n' "$*" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "missing required command: $1"
}

normalize_bearer() {
  local token=$1
  if [[ $token == Bearer\ * || $token == bearer\ * ]]; then
    printf '%s' "$token"
  else
    printf 'Bearer %s' "$token"
  fi
}

require_env() {
  [[ -n ${HUMAN_MCP_API_BASE_URL:-} ]] || fail 'HUMAN_MCP_API_BASE_URL is not set'
  [[ -n ${HUMAN_MCP_AUTH_TOKEN:-} ]] || fail 'HUMAN_MCP_AUTH_TOKEN is not set'
}

build_headers() {
  AUTH_HEADER=$(normalize_bearer "$HUMAN_MCP_AUTH_TOKEN")
  API_KEY_HEADER=${AUTH_HEADER#Bearer }
  API_KEY_HEADER=${API_KEY_HEADER#bearer }
}

run_curl() {
  local method=$1
  local path=$2
  local body=${3:-}
  local url="${HUMAN_MCP_API_BASE_URL%/}${path}"
  local -a cmd=(curl -sS -X "$method" "$url" -H 'Accept: application/json' -H "Authorization: ${AUTH_HEADER}" -H "apikey: ${API_KEY_HEADER}")
  if [[ -n $body ]]; then
    cmd+=(-H 'Content-Type: application/json' --data "$body")
  fi

  if [[ ${HUMAN_MCP_DRY_RUN:-0} == 1 ]]; then
    printf '%q ' "${cmd[@]}"
    printf '\n'
    return 0
  fi

  local response
  response=$("${cmd[@]}" -w $'\nHTTP_STATUS:%{http_code}\n')
  printf '%s\n' "$response"
}

check_env() {
  require_env
  require_cmd curl
  build_headers
  [[ ${HUMAN_MCP_API_BASE_URL} == */api/v1 ]] || fail 'HUMAN_MCP_API_BASE_URL must end with /api/v1'
  [[ ${HUMAN_MCP_AUTH_TOKEN} != *$'\n'* ]] || fail 'HUMAN_MCP_AUTH_TOKEN must not contain a newline'
  log 'PASS env looks ready'
  log "API base: ${HUMAN_MCP_API_BASE_URL}"
  log 'Auth token: present (value hidden)'
}

smoke_read() {
  check_env
  log 'GET /humans?online=true'
  run_curl GET '/humans?online=true'
  log 'GET /tasks'
  run_curl GET '/tasks'
  log 'GET /proofs?status=pending'
  run_curl GET '/proofs?status=pending'
}

verify_proof() {
  local proof_id=${1:-}
  [[ -n $proof_id ]] || fail 'verify-proof requires <proof_id>'
  check_env
  log "POST /proofs/${proof_id}/verify"
  run_curl POST "/proofs/${proof_id}/verify" '{"operator":"openclaw","mode":"auto"}'
}

complete_stamp() {
  local proof_id=${1:-}
  local result=${2:-}
  [[ -n $proof_id ]] || fail 'complete-stamp requires <proof_id>'
  case "$result" in
    virtual_done)
      mode='virtual'
      ;;
    hardware_done)
      mode='hardware'
      ;;
    failed|skipped)
      mode='manual'
      ;;
    *)
      fail 'complete-stamp status must be one of: virtual_done, hardware_done, failed, skipped'
      ;;
  esac
  check_env
  log "POST /stamps/${proof_id}/complete (${result})"
  run_curl POST "/stamps/${proof_id}/complete" "{\"mode\":\"${mode}\",\"result\":\"${result}\",\"operator\":\"openclaw\"}"
}

main() {
  local cmd=${1:-}
  case "$cmd" in
    check-env)
      check_env
      ;;
    smoke-read)
      smoke_read
      ;;
    verify-proof)
      shift
      verify_proof "$@"
      ;;
    complete-stamp)
      shift
      complete_stamp "$@"
      ;;
    -h|--help|help|'')
      usage
      ;;
    *)
      fail "unknown command: ${cmd}"
      ;;
  esac
}

main "$@"

#!/usr/bin/env bash
set -euo pipefail

input="$(cat)"
tool="$(printf '%s' "$input" | node -e 'let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{try{let x=JSON.parse(s); console.log(x.tool_name||"")}catch{console.log("")}})')"
command="$(printf '%s' "$input" | node -e 'let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{try{let x=JSON.parse(s); let t=x.tool_input||{}; console.log(t.command||t.cmd||"")}catch{console.log("")}})')"

if [[ "$tool" == "runTerminalCommand" || "$tool" == "run_in_terminal" || "$tool" == "execute" ]]; then
  if printf '%s' "$command" | grep -Eiq '(^|[;&|[:space:]])(rm[[:space:]]+-rf[[:space:]]+(/|\$HOME)|git[[:space:]]+reset[[:space:]]+--hard|git[[:space:]]+clean[[:space:]]+-fdx|DROP[[:space:]]+TABLE|TRUNCATE[[:space:]]+TABLE)'; then
    printf '%s\n' '{"hookSpecificOutput":{"permissionDecision":"deny","permissionDecisionReason":"TITAN guardrail blocked a destructive command. Use a reversible, narrowly scoped operation instead."}}'
    exit 0
  fi
fi

printf '%s\n' '{"continue":true}'

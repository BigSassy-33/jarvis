#!/usr/bin/env bash
set -u

if [[ ! -f package.json ]]; then
  printf '%s\n' '{"continue":true,"systemMessage":"TITAN validation skipped: package.json is not present."}'
  exit 0
fi

lint_output="$(npm run lint 2>&1)"
lint_code=$?
if [[ $lint_code -ne 0 ]]; then
  printf '%s\n' "$(node -e 'console.log(JSON.stringify({continue:true,systemMessage:"TITAN stop validation: npm run lint failed. Review the terminal output before treating the work as complete."}))')"
  printf '%s\n' "$lint_output" >&2
  exit 0
fi

build_output="$(npm run build 2>&1)"
build_code=$?
if [[ $build_code -ne 0 ]]; then
  printf '%s\n' "$(node -e 'console.log(JSON.stringify({continue:true,systemMessage:"TITAN stop validation: npm run build failed. Review the terminal output before treating the work as complete."}))')"
  printf '%s\n' "$build_output" >&2
  exit 0
fi

printf '%s\n' '{"continue":true,"systemMessage":"TITAN stop validation passed: lint and build completed successfully."}'

// Generates the 1-Command Huawei P40 Native Super-Agent (Termux + Termux:API)
// Gives Pelo unrestricted real execution over /storage/emulated/0 files, background SIM SMS,
// direct calls, clipboard, torch, volume, brightness, notifications, and Android intents/shell.

function generateHuaweiP40AgentScript({ baseUrl, bridgeToken }) {
  const cleanUrl = String(baseUrl || 'https://pelo-lite-five.vercel.app').replace(/\/$/, '');

  return `#!/data/data/com.termux/files/usr/bin/bash
# ==============================================================================
# PELO SUPER-AGENT FOR HUAWEI P40 (EMUI / HarmonyOS · GMS-Free)
# Gives Pelo full native control: Delete/Organize Files, Direct SIM SMS, Calls,
# Hardware Sliders, Clipboard, Notifications & Shell Execution.
# ==============================================================================

set -u
PELO_URL="${cleanUrl}"
PELO_TOKEN="${bridgeToken}"
STORAGE_ROOT="$HOME/storage/shared"
if [ ! -d "$STORAGE_ROOT" ] && [ -d "/storage/emulated/0" ]; then
  STORAGE_ROOT="/storage/emulated/0"
fi
TRASH_DIR="$STORAGE_ROOT/.pelo-trash"

echo "✦ Initializing PELO Native Super-Agent for Huawei P40..."

# 1. Ensure required CLI packages exist in Termux
for cmd in curl jq; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "→ Installing $cmd..."
    pkg install -y "$cmd"
  fi
done

if [ ! -d "$STORAGE_ROOT" ]; then
  echo "→ Requesting Huawei P40 storage permission (Allow prompt on screen)..."
  termux-setup-storage
  sleep 3
  STORAGE_ROOT="$HOME/storage/shared"
fi

mkdir -p "$TRASH_DIR" "$HOME/.pelo"

# Acquire WakeLock so Huawei EMUI keeps agent responsive
command -v termux-wake-lock >/dev/null 2>&1 && termux-wake-lock

sync_phone_state() {
  local batt_pct=88
  local charging="false"
  if command -v termux-battery-status >/dev/null 2>&1; then
    local bjson
    bjson=$(termux-battery-status 2>/dev/null || echo "{}")
    batt_pct=$(echo "$bjson" | jq -r '.percentage // 88')
    local st
    st=$(echo "$bjson" | jq -r '.status // "DISCHARGING"')
    [ "$st" = "CHARGING" ] || [ "$st" = "FULL" ] && charging="true"
  fi

  # Collect top files from Download, Screenshots, Documents, Pictures
  local files_json="[]"
  if [ -d "$STORAGE_ROOT" ]; then
    files_json=$(find "$STORAGE_ROOT/Download" "$STORAGE_ROOT/DCIM/Screenshots" "$STORAGE_ROOT/Documents" "$STORAGE_ROOT/Pictures" \\
      -maxdepth 2 -type f 2>/dev/null | head -n 60 | while IFS= read -r fpath; do
        fname=$(basename "$fpath")
        fdir=$(basename "$(dirname "$fpath")")
        fsize=$(stat -c%s "$fpath" 2>/dev/null || echo 0)
        jq -n --arg p "$fpath" --arg n "$fname" --arg d "$fdir" --argjson s "$fsize" \\
          '{path:$p, name:$n, folder:$d, sizeBytes:$s, trashed:false}'
      done | jq -s '.')
  fi

  curl -sS -X POST "$PELO_URL/api/bridge/sync" \\
    -H "Content-Type: application/json" \\
    -d "$(jq -n \\
      --arg token "$PELO_TOKEN" \\
      --argjson batt "$batt_pct" \\
      --argjson chg "$charging" \\
      --argjson files "\${files_json:-[]}" \\
      '{token:$token, batteryLevel:$batt, charging:$chg, files:$files}')" >/dev/null 2>&1 || true
}

execute_command() {
  local cmd_json="$1"
  local id type payload
  id=$(echo "$cmd_json" | jq -r '.id')
  type=$(echo "$cmd_json" | jq -r '.commandType')
  payload=$(echo "$cmd_json" | jq -c '.payload // {}')
  local out_msg="Executed $type"
  local status="executed"

  case "$type" in
    file_delete)
      local target_path pattern permanent
      target_path=$(echo "$payload" | jq -r '.path // ""')
      pattern=$(echo "$payload" | jq -r '.pattern // ""')
      permanent=$(echo "$payload" | jq -r '.permanent // false')

      if [ -n "$target_path" ] && [ -e "$target_path" ]; then
        if [ "$permanent" = "true" ]; then
          rm -rf "$target_path"
          out_msg="Permanently deleted $target_path"
        else
          mv -f "$target_path" "$TRASH_DIR/$(basename "$target_path")"
          out_msg="Moved $target_path to .pelo-trash"
        fi
      elif [ -n "$pattern" ]; then
        local count=0
        while IFS= read -r match; do
          [ -z "$match" ] && continue
          if [ "$permanent" = "true" ]; then rm -rf "$match"; else mv -f "$match" "$TRASH_DIR/"; fi
          count=$((count + 1))
        done < <(find "$STORAGE_ROOT/Download" "$STORAGE_ROOT/DCIM/Screenshots" "$STORAGE_ROOT/Documents" -maxdepth 2 -iname "*$pattern*" -type f 2>/dev/null)
        out_msg="Deleted $count file(s) matching $pattern"
      fi
      sync_phone_state
      ;;

    file_restore)
      local fname
      fname=$(echo "$payload" | jq -r '.name // ""')
      if [ -n "$fname" ] && [ -e "$TRASH_DIR/$fname" ]; then
        mv -f "$TRASH_DIR/$fname" "$STORAGE_ROOT/Download/$fname"
        out_msg="Restored $fname to Download"
        sync_phone_state
      fi
      ;;

    file_empty_trash)
      rm -rf "$TRASH_DIR"/*
      out_msg="Emptied .pelo-trash permanently"
      ;;

    file_organize)
      mkdir -p "$STORAGE_ROOT/Download/Documents" "$STORAGE_ROOT/Download/Images" "$STORAGE_ROOT/Download/APKs" "$STORAGE_ROOT/Download/Archives"
      mv "$STORAGE_ROOT/Download"/*.pdf "$STORAGE_ROOT/Download"/*.docx "$STORAGE_ROOT/Download/Documents/" 2>/dev/null || true
      mv "$STORAGE_ROOT/Download"/*.jpg "$STORAGE_ROOT/Download"/*.png "$STORAGE_ROOT/Download"/*.webp "$STORAGE_ROOT/Download/Images/" 2>/dev/null || true
      mv "$STORAGE_ROOT/Download"/*.apk "$STORAGE_ROOT/Download/APKs/" 2>/dev/null || true
      mv "$STORAGE_ROOT/Download"/*.zip "$STORAGE_ROOT/Download"/*.rar "$STORAGE_ROOT/Download/Archives/" 2>/dev/null || true
      out_msg="Organized Huawei P40 Download folder by type"
      sync_phone_state
      ;;

    file_create)
      local fpath content
      fpath=$(echo "$payload" | jq -r '.path // ""')
      content=$(echo "$payload" | jq -r '.content // ""')
      [ -z "$fpath" ] && fpath="$STORAGE_ROOT/Documents/pelo-note.txt"
      mkdir -p "$(dirname "$fpath")"
      printf "%s\\n" "$content" > "$fpath"
      out_msg="Created file $fpath"
      sync_phone_state
      ;;

    send_sms_direct)
      local phone body
      phone=$(echo "$payload" | jq -r '.phone // ""')
      body=$(echo "$payload" | jq -r '.message // ""')
      if command -v termux-sms-send >/dev/null 2>&1 && [ -n "$phone" ]; then
        termux-sms-send -n "$phone" "$body"
        out_msg="Sent direct SIM SMS to $phone"
      else
        am start -a android.intent.action.SENDTO -d "sms:$phone" --es sms_body "$body" >/dev/null 2>&1 || true
        out_msg="Opened SMS composer for $phone"
      fi
      ;;

    read_sms_inbox)
      if command -v termux-sms-list >/dev/null 2>&1; then
        local sms_json
        sms_json=$(termux-sms-list -l 8 2>/dev/null || echo "[]")
        curl -sS -X POST "$PELO_URL/api/bridge/sync" \\
          -H "Content-Type: application/json" \\
          -d "$(jq -n --arg token "$PELO_TOKEN" --argjson sms "$sms_json" '{token:$token, inboxSms:$sms}')" >/dev/null 2>&1 || true
        out_msg="Synced latest SMS inbox messages"
      fi
      ;;

    send_whatsapp)
      local phone body enc
      phone=$(echo "$payload" | jq -r '.phone // ""' | tr -cd '0-9')
      body=$(echo "$payload" | jq -r '.message // ""')
      enc=$(jq -rn --arg v "$body" '$v|@uri')
      am start -a android.intent.action.VIEW -d "whatsapp://send?phone=$phone&text=$enc" >/dev/null 2>&1 || true
      out_msg="Dispatched WhatsApp chat to $phone"
      ;;

    call_direct)
      local phone
      phone=$(echo "$payload" | jq -r '.phone // ""')
      if command -v termux-telephony-call >/dev/null 2>&1; then
        termux-telephony-call "$phone"
      else
        am start -a android.intent.action.CALL -d "tel:$phone" >/dev/null 2>&1 || true
      fi
      out_msg="Dialed $phone on Huawei P40"
      ;;

    set_flashlight)
      local val
      val=$(echo "$payload" | jq -r '.value')
      if [ "$val" = "true" ]; then termux-torch on 2>/dev/null || true; else termux-torch off 2>/dev/null || true; fi
      ;;

    set_brightness)
      local val b255
      val=$(echo "$payload" | jq -r '.value // 75')
      b255=$(( val * 255 / 100 ))
      termux-brightness "$b255" 2>/dev/null || true
      ;;

    set_volume)
      local val v15
      val=$(echo "$payload" | jq -r '.value // 65')
      v15=$(( val * 15 / 100 ))
      termux-volume music "$v15" 2>/dev/null || true
      ;;

    clipboard_set)
      local txt
      txt=$(echo "$payload" | jq -r '.text // ""')
      termux-clipboard-set "$txt" 2>/dev/null || true
      out_msg="Copied text to Huawei P40 clipboard"
      ;;

    find_my_phone)
      termux-volume music 15 2>/dev/null || true
      termux-vibrate -d 1500 2>/dev/null || true
      termux-tts-speak "Hey! Your Huawei P40 is right here!" 2>/dev/null || true
      out_msg="Triggered Find My P40 siren & voice"
      ;;

    notify_phone)
      local txt
      txt=$(echo "$payload" | jq -r '.text // "Pelo Alert"')
      termux-notification --title "Pelo AI" --content "$txt" 2>/dev/null || true
      ;;

    shell_exec)
      local cmd_str
      cmd_str=$(echo "$payload" | jq -r '.command // ""')
      if [ -n "$cmd_str" ]; then
        out_msg=$(cd "$STORAGE_ROOT" && eval "$cmd_str" 2>&1 | head -c 1500)
      fi
      ;;
  esac

  echo "✓ [$id] $type -> $out_msg"
  curl -sS -X POST "$PELO_URL/api/bridge/ack" \\
    -H "Content-Type: application/json" \\
    -d "$(jq -n --arg token "$PELO_TOKEN" --argjson id "$id" --arg st "$status" --arg out "$out_msg" \\
      '{token:$token, ids:[$id], status:$st, result:{output:$out}}')" >/dev/null 2>&1 || true
}

sync_phone_state
echo "✦ PELO Super-Agent ONLINE! Listening for commands from $PELO_URL ..."

while true; do
  resp=$(curl -sS "$PELO_URL/api/bridge/poll?token=$PELO_TOKEN" 2>/dev/null || echo "")
  if [ -n "$resp" ]; then
    count=$(echo "$resp" | jq -r '.count // 0' 2>/dev/null || echo 0)
    if [ "$count" -gt 0 ] 2>/dev/null; then
      echo "$resp" | jq -c '.commands[]' | while IFS= read -r item; do
        execute_command "$item"
      done
    fi
  fi
  sleep 2.5
done
`;
}

module.exports = {
  generateHuaweiP40AgentScript
};
